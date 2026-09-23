#!/usr/bin/env node
/**
 * Cross-check our schema parser against Prisma's own, on every schema.
 *
 * Usage:
 *   npm install @prisma/prisma-schema-wasm      # once, in this directory
 *   node scripts/crosscheck-prisma.mjs
 *
 * Writes data/crosscheck.tsv        one row per schema: agree / disagree / prisma-rejected
 *        data/crosscheck-diffs.tsv  one row per disagreement, with what each side saw
 *
 * Why this exists. Manual sampling found two parser bugs (bracketless
 * `@@index(field)`, unindented fields) and a corpus arithmetic check found a
 * third. A sample can only find bugs in rows it draws, and a foreign key the
 * parser silently drops never reaches unindexed-fks.tsv to be drawn at all.
 * Prisma's parser is the ground truth for what a schema declares, and it is
 * entirely independent of ours \u2014 which the manual verification was not,
 * since the same person wrote the parser and checked its output.
 *
 * Prisma's validator is taken from the npm package directly rather than the
 * CLI, which downloads engine binaries it does not need for this.
 *
 * What is compared, per schema: the set of models, the set of foreign keys
 * (model + ordered columns), and whether each foreign key is covered by an
 * index whose leading columns are exactly that key. The coverage rule is
 * applied identically to both sides, so any difference comes from what the
 * two parsers *read*, not from how coverage is judged.
 *
 * Fulltext indexes are excluded on the Prisma side. They are not b-tree
 * indexes and cannot serve a foreign-key lookup, and our parser ignores
 * `@@fulltext` for the same reason.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseSchema, foreignKeyCoverage } from '@code-evolution/core-engine';

const require = createRequire(import.meta.url);
let wasm;
try {
  wasm = require('@prisma/prisma-schema-wasm');
} catch {
  console.error('Missing @prisma/prisma-schema-wasm. Run: npm install @prisma/prisma-schema-wasm');
  process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

function writeTsv(path, columns, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [columns.join('\t')];
  for (const row of rows) lines.push(columns.map(c => String(row[c] ?? '').replace(/[\t\n]/g, ' ')).join('\t'));
  writeFileSync(path, lines.join('\n') + '\n');
}

/**
 * Current Prisma rejects connection URLs in the schema file (they moved to
 * prisma.config.ts in Prisma 7). Every schema written for Prisma 6 or earlier
 * has one, and that has nothing to do with models or indexes, so they are
 * stripped before validation. `=` is required, so a model field named `url`
 * is untouched.
 */
function prepareForPrisma(schema) {
  return schema.replace(/^\s*(url|directUrl|shadowDatabaseUrl)\s*=.*$/gm, '');
}

/** Coverage rule, identical to foreignKeyCoverage: an index leads with exactly the key's columns. */
function covered(indexes, columns) {
  const wanted = new Set(columns);
  return indexes.some(cols => {
    if (cols.length < wanted.size) return false;
    for (let i = 0; i < wanted.size; i++) if (!wanted.has(cols[i])) return false;
    return true;
  });
}

/**
 * Names declared as `view` blocks. Prisma lists views alongside models in the
 * DMMF, with their relation fields, but a view has no foreign-key constraint
 * in the database and a non-materialised one cannot be indexed. Our parser
 * skips them deliberately, so they are removed from Prisma's side too.
 */
function viewNames(schema) {
  return new Set([...schema.matchAll(/^\s*view\s+(\w+)\s*\{/gm)].map(m => m[1]));
}

function prismaView(schema) {
  const params = JSON.stringify({ prismaSchema: [['schema.prisma', schema]], noColor: true });
  const dmmf = JSON.parse(wasm.get_dmmf(params));
  const views = viewNames(schema);

  const indexesByModel = new Map();
  for (const idx of dmmf.datamodel.indexes ?? []) {
    if (idx.type === 'fulltext') continue;
    const list = indexesByModel.get(idx.model) ?? [];
    list.push(idx.fields.map(f => f.name));
    indexesByModel.set(idx.model, list);
  }

  const models = new Set();
  const fks = new Map();
  for (const model of dmmf.datamodel.models) {
    if (views.has(model.name)) continue;
    models.add(model.name);
    const indexes = indexesByModel.get(model.name) ?? [];
    for (const field of model.fields) {
      const cols = field.relationFromFields ?? [];
      if (cols.length === 0) continue;
      fks.set(`${model.name}(${cols.join(',')})`, covered(indexes, cols));
    }
  }
  return { models, fks };
}

function ourView(schema) {
  const parsed = parseSchema(schema);
  // `@@ignore` models are absent from Prisma's model list, and
  // foreignKeyCoverage already leaves their foreign keys out.
  const models = new Set([...parsed.values()].filter(m => !m.ignored).map(m => m.name));
  const fks = new Map();
  for (const fk of foreignKeyCoverage(parsed)) {
    fks.set(`${fk.model}(${fk.columns.join(',')})`, fk.indexed);
  }
  return { models, fks };
}

const corpus = readTsv(join(DATA, 'corpus.tsv'));
const perSchema = [];
const diffs = [];
const rejectReasons = new Map();

let n = 0;
for (const entry of corpus) {
  n++;
  if (n % 250 === 0) console.error(`  checked ${n} / ${corpus.length}`);

  let schema;
  try {
    schema = readFileSync(join(DATA, 'schemas', entry.file), 'utf8');
  } catch {
    perSchema.push({ repo: entry.repo, status: 'missing-file' });
    continue;
  }

  let theirs;
  try {
    theirs = prismaView(prepareForPrisma(schema));
  } catch (err) {
    // A schema Prisma cannot parse cannot be compared: typically a multi-file
    // schema whose models reference types defined in another file, or
    // version-specific syntax. Record the first error line so the reasons
    // can be counted rather than guessed.
    const msg = String(err?.message ?? err);
    const reason = (msg.match(/error: ([^\n]+)/)?.[1] ?? msg).slice(0, 120);
    const bucket = reason.replace(/"[^"]*"/g, '"\u2026"').replace(/`[^`]*`/g, '`\u2026`');
    rejectReasons.set(bucket, (rejectReasons.get(bucket) ?? 0) + 1);
    perSchema.push({ repo: entry.repo, status: 'prisma-rejected', detail: reason });
    continue;
  }

  const ours = ourView(schema);
  let disagreements = 0;

  for (const m of theirs.models) {
    if (!ours.models.has(m)) { diffs.push({ repo: entry.repo, kind: 'model-missed', key: m }); disagreements++; }
  }
  for (const m of ours.models) {
    if (!theirs.models.has(m)) { diffs.push({ repo: entry.repo, kind: 'model-extra', key: m }); disagreements++; }
  }

  for (const [key, theirIndexed] of theirs.fks) {
    if (!ours.fks.has(key)) {
      diffs.push({ repo: entry.repo, kind: 'fk-missed', key, prisma: theirIndexed ? 'indexed' : 'unindexed' });
      disagreements++;
    } else if (ours.fks.get(key) !== theirIndexed) {
      diffs.push({
        repo: entry.repo, kind: 'coverage-differs', key,
        prisma: theirIndexed ? 'indexed' : 'unindexed',
        ours: ours.fks.get(key) ? 'indexed' : 'unindexed',
      });
      disagreements++;
    }
  }
  for (const key of ours.fks.keys()) {
    if (!theirs.fks.has(key)) {
      diffs.push({ repo: entry.repo, kind: 'fk-extra', key, ours: ours.fks.get(key) ? 'indexed' : 'unindexed' });
      disagreements++;
    }
  }

  perSchema.push({
    repo: entry.repo,
    status: disagreements === 0 ? 'agree' : 'disagree',
    prismaModels: theirs.models.size,
    ourModels: ours.models.size,
    prismaFks: theirs.fks.size,
    ourFks: ours.fks.size,
    disagreements,
  });
}

writeTsv(
  join(DATA, 'crosscheck.tsv'),
  ['repo', 'status', 'prismaModels', 'ourModels', 'prismaFks', 'ourFks', 'disagreements', 'detail'],
  perSchema,
);
writeTsv(join(DATA, 'crosscheck-diffs.tsv'), ['repo', 'kind', 'key', 'prisma', 'ours'], diffs);

// ---------------------------------------------------------------------------

const count = s => perSchema.filter(r => r.status === s).length;
const compared = count('agree') + count('disagree');
const kinds = {};
for (const d of diffs) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;

const prismaFkTotal = perSchema.reduce((s, r) => s + (Number(r.prismaFks) || 0), 0);
const fkProblems = (kinds['fk-missed'] ?? 0) + (kinds['coverage-differs'] ?? 0) + (kinds['fk-extra'] ?? 0);

console.log('');
console.log(`schemas: ${corpus.length}`);
console.log(`  compared:         ${compared}`);
console.log(`  agree:            ${count('agree')} (${compared ? Math.round((count('agree') / compared) * 1000) / 10 : 0}% of compared)`);
console.log(`  disagree:         ${count('disagree')}`);
console.log(`  prisma-rejected:  ${count('prisma-rejected')}`);
console.log(`  missing-file:     ${count('missing-file')}`);
console.log('');
console.log(`foreign keys Prisma found in compared schemas: ${prismaFkTotal}`);
console.log(`  disagreements touching a foreign key: ${fkProblems}` +
  (prismaFkTotal ? ` (${Math.round((fkProblems / prismaFkTotal) * 10000) / 100}%)` : ''));
console.log('');
console.log('disagreements by kind:');
for (const [kind, c] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${kind.padEnd(18)} ${c}`);
if (rejectReasons.size > 0) {
  console.log('');
  console.log('top reasons Prisma rejected a schema:');
  for (const [reason, c] of [...rejectReasons].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(c).padStart(5)}  ${reason}`);
  }
}
