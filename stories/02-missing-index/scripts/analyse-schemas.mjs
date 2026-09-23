#!/usr/bin/env node
/**
 * Analyse the collected schemas with the shipped detector.
 *
 * Usage:
 *   node scripts/analyse-schemas.mjs
 *
 * Reads  data/corpus.tsv and data/schemas/*.prisma
 * Writes data/results.tsv        one row per schema, with its foreign-key counts
 *        data/unindexed-fks.tsv  one row per unindexed foreign key
 *        data/summary.json       the corpus-level figures the article quotes
 *
 * This imports `parseSchema` and the foreign-key logic from
 * @code-evolution/core-engine rather than parsing schemas here. A study that
 * reimplements the thing it is measuring can disagree with the tool it is
 * about, and nobody notices until a reader runs the tool and gets a different
 * answer.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchema, foreignKeyCoverage } from '@code-evolution/core-engine';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORY = join(HERE, '..');
const DATA = join(STORY, 'data');

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

function writeTsv(path, columns, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [columns.join('\t')];
  for (const row of rows) lines.push(columns.map(c => String(row[c] ?? '')).join('\t'));
  writeFileSync(path, lines.join('\n') + '\n');
}

const corpus = readTsv(join(DATA, 'corpus.tsv'));
const perSchema = [];
const unindexed = [];

/**
 * Identical schemas, by git blob SHA — which is a hash of the content, so
 * equal SHAs mean byte-identical files. The fork filter only catches GitHub
 * forks; copying a project by creating a new repository and pushing to it
 * leaves no trace in the metadata. In this corpus that meant 79 rows, mostly
 * the same few schemas appearing up to five times.
 *
 * Each distinct schema is counted once. The repository kept is the first one
 * in corpus.tsv, and every dropped duplicate is written out so the decision
 * can be checked.
 */
const seenSha = new Map();
const duplicates = [];

/**
 * Snapshots of someone else's project taken by AI code-review benchmarks, e.g.
 * `code-review-benchmark/cal_dot_com__cal.com__copilot-v2__PR10967__20260624`.
 * Not forks and not templates, so neither earlier filter catches them, and
 * not independent schemas either.
 *
 * 5 rows on this corpus, four of them byte-identical copies of the same
 * cal.com snapshot. (An earlier note said 2: that count was taken from the
 * deduplicated results, after the identical copies had already been removed,
 * so it saw only the survivors.)
 */
const PR_SNAPSHOT = /__pr\d+__/i;

/**
 * Schemas that are test fixtures or vendored copies of another project, by
 * path. Found during manual verification: Prisma's own test fixture at
 * `.../packages/client/fixtures/enums/prisma/schema.prisma`, vendored into a
 * benchmark dataset and pushed to someone's repository. The detection on it
 * was correct; it just isn't anybody's application.
 *
 * Measured before adding the rule: 1 schema. Precise, so it is applied.
 */
const NOT_AN_APPLICATION = /(^|\/)(fixtures?|__tests__|tests?|node_modules|vendor)\//i;

/**
 * Schemas Prisma's own validator rejects, from scripts/crosscheck-prisma.mjs.
 *
 * A schema Prisma cannot parse cannot generate a client, so it is not a
 * working schema — typically a relation missing its opposite side, a model
 * defined twice, or syntax from an older Prisma. Excluding them makes one
 * claim hold without qualification: every schema analysed was accepted by
 * Prisma, and on every one of them our parser reads exactly what Prisma
 * reads. The cross-check has to run first; without its output the analysis
 * would silently include schemas nobody verified.
 */
const CROSSCHECK = join(DATA, 'crosscheck.tsv');
if (!existsSync(CROSSCHECK)) {
  console.error('data/crosscheck.tsv not found. Run scripts/crosscheck-prisma.mjs first.');
  process.exit(1);
}

/**
 * Refuse to run without the schema files. This script overwrites
 * results.tsv, unindexed-fks.tsv, exclusions.tsv and summary.json, and it
 * used to skip a missing file and carry on — so running it after data/schemas/
 * had been deleted replaced every result with an empty table and reported
 * nothing wrong. Checked up front, before anything is written.
 */
const missingFiles = corpus.filter(entry => !existsSync(join(DATA, 'schemas', entry.file)));
if (missingFiles.length > 0) {
  console.error(`${missingFiles.length} of ${corpus.length} schema files are missing from data/schemas/.`);
  console.error('Nothing has been written. Restore them with: node scripts/restore-schemas.mjs');
  process.exit(1);
}
const prismaRejected = new Set(
  readTsv(CROSSCHECK).filter(row => row.status === 'prisma-rejected').map(row => row.repo),
);

for (const entry of corpus) {
  if (prismaRejected.has(entry.repo)) {
    duplicates.push({ repo: entry.repo, sha: entry.sha, reason: 'prisma-rejected', duplicateOf: '' });
    continue;
  }

  if (NOT_AN_APPLICATION.test(entry.path)) {
    duplicates.push({ repo: entry.repo, sha: entry.sha, reason: 'fixture-or-vendored', duplicateOf: '' });
    continue;
  }

  if (PR_SNAPSHOT.test(entry.repo)) {
    duplicates.push({ repo: entry.repo, sha: entry.sha, reason: 'pr-snapshot', duplicateOf: '' });
    continue;
  }

  const first = seenSha.get(entry.sha);
  if (first) {
    duplicates.push({ repo: entry.repo, sha: entry.sha, reason: 'identical-sha', duplicateOf: first });
    continue;
  }
  seenSha.set(entry.sha, entry.repo);

  let schema;
  try {
    schema = readFileSync(join(DATA, 'schemas', entry.file), 'utf8');
  } catch (err) {
    // Checked for up front; reaching this means the file vanished mid-run.
    console.error(`could not read schema for ${entry.repo}: ${err.message}`);
    process.exit(1);
  }

  const models = parseSchema(schema);
  const coverage = foreignKeyCoverage(models);

  // @@ignore models are left out of every count, matching foreignKeyCoverage
  // and Prisma's own model list.
  let modelCount = 0;
  let explicitIndexes = 0;
  for (const model of models.values()) {
    if (model.ignored) continue;
    modelCount++;
    explicitIndexes += model.indexes.filter(i => i.source === 'index').length;
  }

  const foreignKeys = coverage.length;
  const foreignKeysIndexed = coverage.filter(fk => fk.indexed).length;

  for (const fk of coverage) {
    if (fk.indexed) continue;
    unindexed.push({
      repo: entry.repo,
      sha: entry.sha,
      model: fk.model,
      field: fk.columns.join(','),
      line: fk.line,
    });
  }

  perSchema.push({
    repo: entry.repo,
    stars: entry.stars,
    sha: entry.sha,
    models: modelCount,
    explicitIndexes,
    foreignKeys,
    foreignKeysIndexed,
    foreignKeysUnindexed: foreignKeys - foreignKeysIndexed,
  });
}

// ---------------------------------------------------------------------------
// Corpus-level figures
// ---------------------------------------------------------------------------

const totalForeignKeys = perSchema.reduce((n, s) => n + s.foreignKeys, 0);
const totalIndexed = perSchema.reduce((n, s) => n + s.foreignKeysIndexed, 0);
const schemasWithAny = perSchema.filter(s => s.foreignKeysUnindexed > 0).length;
const schemasFullyIndexed = perSchema.filter(s => s.foreignKeys > 0 && s.foreignKeysUnindexed === 0).length;
const schemasWithNoExplicitIndex = perSchema.filter(s => s.explicitIndexes === 0).length;

const pct = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

const summary = {
  schemasCollected: corpus.length,
  excludedAtAnalysis: duplicates.length,
  schemas: perSchema.length,
  models: perSchema.reduce((n, s) => n + s.models, 0),
  explicitIndexes: perSchema.reduce((n, s) => n + s.explicitIndexes, 0),

  foreignKeys: totalForeignKeys,
  foreignKeysIndexed: totalIndexed,
  foreignKeysUnindexed: totalForeignKeys - totalIndexed,
  foreignKeysUnindexedPct: pct(totalForeignKeys - totalIndexed, totalForeignKeys),

  schemasWithUnindexedForeignKey: schemasWithAny,
  schemasWithUnindexedForeignKeyPct: pct(schemasWithAny, perSchema.length),
  schemasFullyIndexed,
  schemasWithNoExplicitIndex,
  schemasWithNoExplicitIndexPct: pct(schemasWithNoExplicitIndex, perSchema.length),
};

writeTsv(
  join(DATA, 'results.tsv'),
  ['repo', 'stars', 'sha', 'models', 'explicitIndexes', 'foreignKeys', 'foreignKeysIndexed', 'foreignKeysUnindexed'],
  perSchema,
);
writeTsv(join(DATA, 'unindexed-fks.tsv'), ['repo', 'sha', 'model', 'field', 'line'], unindexed);
writeTsv(join(DATA, 'exclusions.tsv'), ['repo', 'sha', 'reason', 'duplicateOf'], duplicates);
writeFileSync(join(DATA, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

const byReason = {};
for (const row of duplicates) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;

console.log(summary);
console.log('');
console.log(`${summary.schemasCollected} collected, ${summary.excludedAtAnalysis} excluded at analysis, ${summary.schemas} analysed`);
for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(20)} ${n}`);
}
console.log('');
console.log(`${summary.foreignKeysUnindexed} of ${summary.foreignKeys} foreign keys have no index (${summary.foreignKeysUnindexedPct}%)`);
console.log(`${summary.schemasWithUnindexedForeignKey} of ${summary.schemas} schemas have at least one (${summary.schemasWithUnindexedForeignKeyPct}%)`);
console.log(`${summary.schemasWithNoExplicitIndex} of ${summary.schemas} schemas declare no @@index at all (${summary.schemasWithNoExplicitIndexPct}%)`);
