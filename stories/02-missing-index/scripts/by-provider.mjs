#!/usr/bin/env node
/**
 * Split the results by database provider.
 *
 * Usage:
 *   node scripts/by-provider.mjs
 *
 * Reads  data/results.tsv, data/providers.tsv, data/corpus.tsv
 * Writes data/by-provider.tsv
 *
 * Prints three things:
 *   1. the results per provider
 *   2. the headline, restricted to schemas where a missing @@index is a
 *      missing index in the database \u2014 everything except MySQL with foreign-key
 *      constraints, where InnoDB creates the index itself
 *   3. the size gradient for that same restricted set
 *
 * Unknown and unavailable providers are kept in the restricted set rather
 * than dropped, and counted separately so their weight is visible.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

const num = n => Number(n) || 0;
const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);
function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const medPct = v => Math.round(median(v) * 1000) / 10;

const results = readTsv(join(DATA, 'results.tsv'));
const providers = new Map(readTsv(join(DATA, 'providers.tsv')).map(r => [r.repo, r]));
const partitions = new Map(readTsv(join(DATA, 'corpus.tsv')).map(r => [r.repo, r.partition]));

/**
 * Every figure below depends on these columns existing under exactly these
 * names. A header read with a trailing \r (Git for Windows converting line
 * endings on checkout) once made `foreignKeysUnindexed` read as undefined —
 * and `Number(undefined) || 0` turned that into a table of zeros that passed
 * every check that did not look at that column.
 */
for (const col of ['repo', 'foreignKeys', 'foreignKeysUnindexed']) {
  if (results.length > 0 && !(col in results[0])) {
    console.error(`results.tsv has no '${col}' column (found: ${Object.keys(results[0]).join(', ')})`);
    process.exit(1);
  }
}

/** The totals here must reproduce the ones analyse-schemas.mjs wrote. */
const summary = JSON.parse(readFileSync(join(DATA, 'summary.json'), 'utf8'));
const totalFks = results.reduce((n, r) => n + num(r.foreignKeys), 0);
const totalUnindexed = results.reduce((n, r) => n + num(r.foreignKeysUnindexed), 0);
if (results.length !== summary.schemas || totalFks !== summary.foreignKeys || totalUnindexed !== summary.foreignKeysUnindexed) {
  console.error('results.tsv does not match summary.json:');
  console.error(`  schemas     ${results.length} vs ${summary.schemas}`);
  console.error(`  FKs         ${totalFks} vs ${summary.foreignKeys}`);
  console.error(`  unindexed   ${totalUnindexed} vs ${summary.foreignKeysUnindexed}`);
  process.exit(1);
}

const missing = results.filter(r => !providers.has(r.repo));
if (missing.length > 0) {
  console.error(`${missing.length} analysed schemas have no provider recorded. Run fetch-providers.mjs to completion first.`);
  process.exit(1);
}

/** Only MySQL with real foreign-key constraints gets an index from the database. */
const autoIndexed = p => p.provider === 'mysql' && p.relationMode === 'foreignKeys';

const rows = results.map(r => {
  const p = providers.get(r.repo);
  return {
    repo: r.repo,
    provider: p.provider,
    relationMode: p.relationMode,
    autoIndexed: autoIndexed(p),
    partition: partitions.get(r.repo),
    fks: num(r.foreignKeys),
    unindexed: num(r.foreignKeysUnindexed),
  };
});

function summarise(set) {
  const fks = set.reduce((n, r) => n + r.fks, 0);
  const unindexed = set.reduce((n, r) => n + r.unindexed, 0);
  return {
    schemas: set.length,
    fks,
    unindexed,
    median: medPct(set.filter(r => r.fks > 0).map(r => r.unindexed / r.fks)),
    pooled: pct(unindexed, fks),
    withAny: pct(set.filter(r => r.unindexed > 0).length, set.length),
    withAnyCount: set.filter(r => r.unindexed > 0).length,
  };
}

// 1. Per provider
const groups = new Map();
for (const r of rows) {
  const key = r.provider === 'mysql' ? `mysql (relationMode ${r.relationMode})` : r.provider;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const table = [...groups]
  .map(([key, set]) => ({ key, auto: set[0].autoIndexed, ...summarise(set) }))
  .sort((a, b) => b.schemas - a.schemas);

writeFileSync(
  join(DATA, 'by-provider.tsv'),
  ['provider\tschemas\tforeignKeys\tunindexedInSchema\tmedianUnindexedPct\tpooledUnindexedPct\tschemasWithAnyPct\tdatabaseCreatesIndex',
   ...table.map(t => [t.key, t.schemas, t.fks, t.unindexed, t.median, t.pooled, t.withAny, t.auto ? 'yes' : 'no'].join('\t'))]
    .join('\n') + '\n',
);

console.log('');
console.log('| Provider | Schemas | FKs | Median unindexed | Pooled | \u22651 unindexed | DB creates the index |');
console.log('|---|---:|---:|---:|---:|---:|---|');
for (const t of table) {
  console.log(`| ${t.key} | ${t.schemas} | ${t.fks} | ${t.median}% | ${t.pooled}% | ${t.withAny}% | ${t.auto ? 'yes' : 'no'} |`);
}

// 2. Restricted headline
const real = rows.filter(r => !r.autoIndexed);
const s = summarise(real);
const auto = rows.length - real.length;
console.log('');
console.log(`MySQL with foreign-key constraints: ${auto} of ${rows.length} schemas (${pct(auto, rows.length)}%) \u2014 excluded below.`);
console.log(`Where a missing @@index is a missing index in the database:`);
console.log(`  ${s.schemas} schemas, ${s.fks} foreign keys, ${s.unindexed} unindexed`);
console.log(`  median per schema ${s.median}%, pooled ${s.pooled}%, \u22651 unindexed ${s.withAnyCount} (${s.withAny}%)`);

// 3. Restricted size gradient
const ORDER = ['<1000', '1000..2000', '2000..4000', '4000..8000', '8000..16000', '16000..32000', '>32000'];
const LABEL = {
  '<1000': 'under 1 KB', '1000..2000': '1\u20132 KB', '2000..4000': '2\u20134 KB', '4000..8000': '4\u20138 KB',
  '8000..16000': '8\u201316 KB', '16000..32000': '16\u201332 KB', '>32000': 'over 32 KB',
};
console.log('');
console.log('| Schema size | Schemas | FKs | Median unindexed | Pooled |');
console.log('|---|---:|---:|---:|---:|');
let checkSchemas = 0;
let checkFks = 0;
let checkUnindexed = 0;
for (const p of ORDER) {
  const set = real.filter(r => r.partition === p);
  if (set.length === 0) continue;
  const b = summarise(set);
  checkSchemas += b.schemas;
  checkFks += b.fks;
  checkUnindexed += b.unindexed;
  console.log(`| ${LABEL[p]} | ${b.schemas} | ${b.fks} | ${b.median}% | ${b.pooled}% |`);
}
console.log('');
console.log(`Arithmetic check: buckets sum to ${checkSchemas} schemas (expect ${s.schemas}), ` +
  `${checkFks} FKs (expect ${s.fks}), ${checkUnindexed} unindexed (expect ${s.unindexed})`);
console.log(`  totals match summary.json: ${results.length} schemas, ${totalFks} FKs, ${totalUnindexed} unindexed`);
