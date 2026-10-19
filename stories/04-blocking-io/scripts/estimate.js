#!/usr/bin/env node
/**
 * Step 2: estimate, from a labelled sample, how many findings block anything.
 * For Study 02 also how well its context classifier did; for core-engine,
 * how the label mix varies by severity and rule.
 *
 * Usage:
 *   node scripts/estimate.js            Study 02 sample (strata = context)
 *   node scripts/estimate.js --core     core-engine sample (strata = severity)
 *
 * Reads eval/study02-sample.json or eval/sample.json (strata, weights, ids),
 * eval/to-label.json (sample id -> location id) and eval/labels.tsv
 * (location id -> label). Writes results/estimate-study02.json or
 * results/estimate-core-engine.json and prints the tables.
 *
 * Stratified estimator: total = sum over strata of N_h * p_h, variance
 * sum of N_h^2 * p_h (1 - p_h) / n_h * (1 - n_h / N_h), 95% interval at
 * +-1.96 standard errors. `unsure` is never counted as tp; the upper bound
 * counts every unsure as tp.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EVAL = path.join(ROOT, 'eval');
const CORE = process.argv.includes('--core');
const sample = JSON.parse(fs.readFileSync(path.join(EVAL, CORE ? 'sample.json' : 'study02-sample.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(EVAL, 'to-label.json'), 'utf8')).items;
const [, ...rows] = fs.readFileSync(path.join(EVAL, 'labels.tsv'), 'utf8').trim().split(/\r?\n/);
const label = new Map(rows.map((l) => l.split('\t')).map(([id, lab]) => [id, lab]));
const locOf = new Map();
for (const it of items) for (const s of it.samples) locOf.set(s, it.id);

const LABELS = ['tp', 'fp-startup', 'fp-once', 'fp-tooling', 'fp-not-blocking', 'unsure'];
const AGREES = { request_path: ['tp'], background_path: ['tp'], startup_path: ['fp-startup', 'fp-once'], tooling_path: ['fp-tooling'] };

const strata = {};
const byRule = {};
const missing = [];
for (const f of sample.findings) {
  const lab = label.get(locOf.get(f.id));
  if (!lab) { missing.push(f.id); continue; }
  const s = (strata[f.stratum] ||= { N: sample.strata[f.stratum].population, n: 0, counts: Object.fromEntries(LABELS.map((l) => [l, 0])) });
  s.n++;
  s.counts[lab]++;
  if (CORE) (byRule[f.rule] ||= Object.fromEntries(LABELS.map((l) => [l, 0])))[lab]++;
}
if (missing.length) { console.error(`unlabelled sample items: ${missing.join(', ')}`); process.exit(1); }

const z = 1.96;
let total = 0, variance = 0, upper = 0, N = 0;
const out = { seed: sample.seed, strata: {} };
for (const [k, s] of Object.entries(strata)) {
  const p = s.counts.tp / s.n;
  const pu = (s.counts.tp + s.counts.unsure) / s.n;
  const est = s.N * p;
  const v = (s.N ** 2) * p * (1 - p) / s.n * (1 - s.n / s.N);
  total += est; variance += v; upper += s.N * pu; N += s.N;
  const agree = !CORE && AGREES[k] ? AGREES[k].reduce((a, l) => a + s.counts[l], 0) : null;
  out.strata[k] = { population: s.N, sampled: s.n, counts: s.counts, tpRate: p, tpEstimate: est, tpEstimateUpper: s.N * pu, contextAgrees: agree, contextAgreesRate: agree === null ? null : agree / s.n };
}
const se = Math.sqrt(variance);
if (CORE) out.sampleByRule = byRule;
out.overall = { population: N, tpEstimate: total, tpLow: Math.max(0, total - z * se), tpHigh: total + z * se, tpEstimateUpperUnsureAsTp: upper, tpShare: total / N };
fs.writeFileSync(path.join(ROOT, 'results', CORE ? 'estimate-core-engine.json' : 'estimate-study02.json'), JSON.stringify(out, null, 2));

const pct = (x) => `${(100 * x).toFixed(1)}%`;
console.log('stratum           N     n   ' + LABELS.map((l) => l.padStart(15)).join('') + '   tp rate   est. tp   context agrees');
for (const [k, s] of Object.entries(out.strata)) {
  console.log(`${k.padEnd(16)} ${String(s.population).padStart(5)} ${String(s.sampled).padStart(4)}   ${LABELS.map((l) => String(s.counts[l]).padStart(15)).join('')}   ${pct(s.tpRate).padStart(7)}   ${Math.round(s.tpEstimate).toString().padStart(7)}   ${s.contextAgrees === null ? '—' : `${s.contextAgrees}/${s.sampled} (${pct(s.contextAgreesRate)})`}`);
}
if (CORE) {
  console.log('\nsample counts by rule (unweighted)');
  for (const [r, c] of Object.entries(byRule)) console.log(`${r.padEnd(38)} ${LABELS.map((l) => `${l} ${c[l]}`).join('  ')}`);
}
const o = out.overall;
console.log(`\nEstimated findings that block concurrent work: ${Math.round(o.tpEstimate)} of ${o.population} (${pct(o.tpShare)}), 95% CI ${Math.round(o.tpLow)}-${Math.round(o.tpHigh)}; ${Math.round(o.tpEstimateUpperUnsureAsTp)} if every unsure is tp`);
