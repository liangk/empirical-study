#!/usr/bin/env node
/**
 * Draw a stratified sample of unindexed foreign keys for manual verification.
 *
 * Usage:
 *   node scripts/sample-verify.mjs              # 2 per size bucket
 *   node scripts/sample-verify.mjs --per 3
 *
 * Writes data/verification.md — one entry per sampled foreign key, with the
 * full model block printed from the local schema copy, so each one can be
 * judged without opening a browser.
 *
 * Why stratified: 70% of foreign keys sit in the two largest buckets, so a
 * uniform sample would verify almost nothing from the small schemas, which is
 * where the highest unindexed rates are claimed.
 *
 * Why seeded: the same run must draw the same sample. A verification a reader
 * cannot repeat is a verification they have to take on trust.
 *
 * What counts as a false positive: the foreign key is the *leading* column of
 * any @@index, @@unique, @@id, or carries @id / @unique itself. Being the
 * second column of a composite does not count as covered — Postgres cannot
 * use that index for a lookup on this column alone.
 *
 * On links: collection recorded each schema's git *blob* SHA, which pins the
 * exact content and can be fetched by anyone from
 *   https://api.github.com/repos/<repo>/git/blobs/<sha>
 * but is not a commit, so it does not make a github.com/.../blob/<ref>/ URL.
 * The HEAD link below is for convenience and may have moved; the local copy
 * in data/schemas/ is the authoritative one.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

const PER = (() => {
  const i = process.argv.indexOf('--per');
  return i === -1 ? 2 : Number(process.argv[i + 1]);
})();

const SEED = 20260921;

const PARTITIONS = [
  '<1000', '1000..2000', '2000..4000', '4000..8000',
  '8000..16000', '16000..32000', '>32000',
];

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

/** mulberry32 — small, deterministic, good enough for sampling. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The `model X { ... }` block containing the given line, from the local copy. */
function modelBlock(schema, modelName) {
  const lines = schema.split('\n');
  const start = lines.findIndex(l => new RegExp(`^\\s*model\\s+${modelName}\\s*\\{`).test(l));
  if (start === -1) return null;
  let end = start;
  while (end < lines.length && !/^\s*\}/.test(lines[end])) end++;
  return { startLine: start + 1, text: lines.slice(start, end + 1).join('\n') };
}

const corpus = readTsv(join(DATA, 'corpus.tsv'));
const unindexed = readTsv(join(DATA, 'unindexed-fks.tsv'));
const byRepo = new Map(corpus.map(row => [row.repo, row]));

const random = rng(SEED);
const sample = [];

for (const partition of PARTITIONS) {
  const pool = unindexed.filter(row => byRepo.get(row.repo)?.partition === partition);
  // Fisher–Yates with the seeded generator, then take the first PER.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const row of shuffled.slice(0, PER)) sample.push({ ...row, partition });
}

const out = [];
out.push('# Manual verification sample');
out.push('');
out.push(`Seed ${SEED}, ${PER} per size bucket, ${sample.length} foreign keys.`);
out.push('');
out.push('For each: is the field the **leading** column of any `@@index`, `@@unique` or');
out.push('`@@id`, or marked `@id` / `@unique` itself? If yes, it is a false positive.');
out.push('');

let n = 0;
for (const row of sample) {
  n++;
  const entry = byRepo.get(row.repo);
  const schema = readFileSync(join(DATA, 'schemas', entry.file), 'utf8');
  const block = modelBlock(schema, row.model);

  out.push(`## ${n}. \`${row.model}.${row.field}\` — ${row.repo}`);
  out.push('');
  out.push(`- Size bucket: ${row.partition}`);
  out.push(`- Local copy: \`data/schemas/${entry.file}\` line ${row.line}`);
  out.push(`- Blob (pinned): https://api.github.com/repos/${row.repo}/git/blobs/${row.sha}`);
  out.push(`- HEAD (may have moved): https://github.com/${row.repo}/blob/HEAD/${entry.path}#L${row.line}`);
  out.push('');
  out.push('```prisma');
  out.push(block ? block.text : `// model ${row.model} not found in local copy`);
  out.push('```');
  out.push('');
  out.push('- [ ] Genuinely unindexed');
  out.push('- [ ] False positive — reason:');
  out.push('');
}

writeFileSync(join(DATA, 'verification.md'), out.join('\n'));
console.log(`Wrote ${sample.length} entries to data/verification.md`);
