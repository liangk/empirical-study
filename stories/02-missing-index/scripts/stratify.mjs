#!/usr/bin/env node
/**
 * Stratify the corpus by schema size.
 *
 * Usage:
 *   node scripts/stratify.mjs
 *
 * Reads  data/results.tsv and data/corpus.tsv
 * Writes data/by-size.tsv and prints a markdown table
 *
 * Why this exists: the headline "X% of foreign keys have no index" is not a
 * stable number. A sample of the smallest schemas on GitHub gave 79%; a sample
 * skewed large gave 28%. Neither is wrong about its own sample and neither
 * describes Prisma projects in general, so the size breakdown is the result
 * rather than a robustness check on it.
 *
 * The prediction worth testing: small schemas are not badly maintained, they
 * are young. Indexes get added when a table gets big enough to hurt — which is
 * after there is production data in it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

const PARTITIONS = [
  '<1000', '1000..2000', '2000..4000', '4000..8000',
  '8000..16000', '16000..32000', '>32000',
];

const LABELS = {
  '<1000': 'under 1 KB',
  '1000..2000': '1–2 KB',
  '2000..4000': '2–4 KB',
  '4000..8000': '4–8 KB',
  '8000..16000': '8–16 KB',
  '16000..32000': '16–32 KB',
  '>32000': 'over 32 KB',
};

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
  for (const row of rows) lines.push(columns.map(c => String(row[c] ?? '')).join('\t'));
  writeFileSync(path, lines.join('\n') + '\n');
}

const pct = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
const num = n => Number(n) || 0;

/**
 * Median of per-schema unindexed ratios.
 *
 * The two pooled figures each have a bias, in opposite directions. The pooled
 * foreign-key percentage is dominated by the biggest schemas — the largest
 * bucket holds over half of all foreign keys. "Schemas with at least one
 * unindexed foreign key" is inflated by them instead: a schema with 84 foreign
 * keys almost certainly misses one. Taking each schema's own ratio and then
 * the median gives every schema one vote regardless of its size, which is
 * the figure that describes a typical project.
 */
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const ratioPct = r => Math.round(r * 1000) / 10;

const corpus = readTsv(join(DATA, 'corpus.tsv'));
const results = readTsv(join(DATA, 'results.tsv'));

const partitionOf = new Map(corpus.map(row => [row.repo, row.partition]));
const modelsOf = new Map(corpus.map(row => [row.repo, num(row.models)]));

const buckets = new Map(PARTITIONS.map(p => [p, {
  partition: p,
  label: LABELS[p],
  schemas: 0,
  models: 0,
  explicitIndexes: 0,
  foreignKeys: 0,
  foreignKeysIndexed: 0,
  schemasWithUnindexed: 0,
  schemasWithNoExplicitIndex: 0,
  ratios: [],
}]));

let unplaced = 0;

for (const row of results) {
  const partition = partitionOf.get(row.repo);
  const bucket = partition && buckets.get(partition);
  if (!bucket) { unplaced++; continue; }

  bucket.schemas++;
  bucket.models += num(row.models) || modelsOf.get(row.repo) || 0;
  bucket.explicitIndexes += num(row.explicitIndexes);
  bucket.foreignKeys += num(row.foreignKeys);
  bucket.foreignKeysIndexed += num(row.foreignKeysIndexed);
  if (num(row.foreignKeysUnindexed) > 0) bucket.schemasWithUnindexed++;
  if (num(row.explicitIndexes) === 0) bucket.schemasWithNoExplicitIndex++;
  if (num(row.foreignKeys) > 0) {
    bucket.ratios.push(num(row.foreignKeysUnindexed) / num(row.foreignKeys));
  }
}

if (unplaced > 0) {
  console.error(`warning: ${unplaced} result rows had no matching partition in corpus.tsv`);
}

const rows = PARTITIONS.map(p => {
  const b = buckets.get(p);
  const unindexed = b.foreignKeys - b.foreignKeysIndexed;
  return {
    ...b,
    foreignKeysUnindexed: unindexed,
    unindexedPct: pct(unindexed, b.foreignKeys),
    schemasWithUnindexedPct: pct(b.schemasWithUnindexed, b.schemas),
    noExplicitIndexPct: pct(b.schemasWithNoExplicitIndex, b.schemas),
    fksPerSchema: b.schemas === 0 ? 0 : Math.round((b.foreignKeys / b.schemas) * 10) / 10,
    medianUnindexedPct: ratioPct(median(b.ratios)),
  };
});

writeTsv(
  join(DATA, 'by-size.tsv'),
  ['partition', 'schemas', 'models', 'foreignKeys', 'foreignKeysIndexed', 'foreignKeysUnindexed',
   'unindexedPct', 'medianUnindexedPct', 'explicitIndexes', 'schemasWithNoExplicitIndex', 'noExplicitIndexPct', 'fksPerSchema'],
  rows,
);

// ---------------------------------------------------------------------------
// Markdown, ready to paste into the article
// ---------------------------------------------------------------------------

const totals = rows.reduce((acc, r) => ({
  schemas: acc.schemas + r.schemas,
  foreignKeys: acc.foreignKeys + r.foreignKeys,
  foreignKeysIndexed: acc.foreignKeysIndexed + r.foreignKeysIndexed,
  schemasWithNoExplicitIndex: acc.schemasWithNoExplicitIndex + r.schemasWithNoExplicitIndex,
}), { schemas: 0, foreignKeys: 0, foreignKeysIndexed: 0, schemasWithNoExplicitIndex: 0 });

const totalUnindexed = totals.foreignKeys - totals.foreignKeysIndexed;
const allRatios = rows.flatMap(r => r.ratios);
const overallMedian = ratioPct(median(allRatios));

console.log('');
console.log('| Schema size | Schemas | FKs | FKs per schema | Median unindexed per schema | Pooled unindexed % | No @@index at all |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  if (r.schemas === 0) continue;
  console.log(
    `| ${r.label} | ${r.schemas} | ${r.foreignKeys} | ${r.fksPerSchema} | ` +
    `${r.medianUnindexedPct}% | ${r.unindexedPct}% | ${r.schemasWithNoExplicitIndex} (${r.noExplicitIndexPct}%) |`
  );
}
console.log(
  `| **All** | **${totals.schemas}** | **${totals.foreignKeys}** | ` +
  `**${Math.round((totals.foreignKeys / totals.schemas) * 10) / 10}** | ` +
  `**${overallMedian}%** | **${pct(totalUnindexed, totals.foreignKeys)}%** | ` +
  `**${totals.schemasWithNoExplicitIndex} (${pct(totals.schemasWithNoExplicitIndex, totals.schemas)}%)** |`
);

console.log('');
console.log('Arithmetic check:');
const sumSchemas = rows.reduce((n, r) => n + r.schemas, 0);
const sumFks = rows.reduce((n, r) => n + r.foreignKeys, 0);
console.log(`  schemas across buckets: ${sumSchemas} (results.tsv rows: ${results.length})`);
console.log(`  ratios collected: ${allRatios.length} (must equal schemas, since every schema has a relation)`);
console.log(`  foreign keys across buckets: ${sumFks}`);
console.log(`  indexed + unindexed = ${totals.foreignKeysIndexed} + ${totalUnindexed} = ${totals.foreignKeysIndexed + totalUnindexed}`);
