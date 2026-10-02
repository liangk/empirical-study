#!/usr/bin/env node
/**
 * Population estimates for a round, weighted by sampling stratum.
 *
 * Usage: node scripts/estimate.js <round>.json
 *
 * Every finding in the round is placed in the stratum it was sampled from in
 * round 1 (by repository, file and line). Within each stratum, the labels of the
 * sampled findings that are still reported give the rates; each stratum's rates
 * are applied to that stratum's count of findings in the round.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
const S = read('eval/sample.json').sample;
const L = read('eval/labels.json');
const C = read('eval/round1-strata.json'); // round-1 findings with their stratum
const R = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const key = (repo, file, line) => `${repo}\u0000${file}\u0000${line}`;
const stratumOf = new Map();
for (const c of C) {
  stratumOf.set(key(c.repo, c.file, c.line), c.cls === 'rest' || c.cls === 'missing-file' ? 'rest' : c.cls);
}

// The unit is the finding, as the tool reports it. Several findings can share
// a line (a minified bundle has hundreds on line 1), so counting locations
// would weight strata by something the reader never sees.
const N = new Map();
let unplaced = 0;
for (const [repo, fs_] of Object.entries(R)) {
  for (const x of fs_) {
    let st = stratumOf.get(key(repo, x.file, x.line));
    if (st === undefined) { unplaced++; st = 'rest'; }
    N.set(st, (N.get(st) || 0) + 1);
  }
}

const live = new Set();
for (const [repo, fs_] of Object.entries(R)) for (const x of fs_) live.add(key(repo, x.file, x.line));
const lab = new Map();
const seen = new Set();
for (const s of S) {
  const loc = key(s.repo, s.file, s.line);
  if (live.has(loc) && !seen.has(loc)) {
    seen.add(loc);
    const c = lab.get(s.stratum) || {};
    const l = L[s.id][0];
    c[l] = (c[l] || 0) + 1;
    lab.set(s.stratum, c);
  }
}

let tp = 0, unsure = 0;
const rows = [];
for (const [st, n] of N) {
  const c = lab.get(st) || {};
  const k = Object.values(c).reduce((a, v) => a + v, 0);
  if (k === 0) { rows.push([st, n, 0, '-', '-']); continue; }
  tp += n * (c.tp || 0) / k;
  unsure += n * (c.unsure || 0) / k;
  rows.push([st, n, k, c.tp || 0, c.unsure || 0]);
}
const total = [...N.values()].reduce((a, v) => a + v, 0);
const pad = (v, w) => String(v).padStart(w);
console.log(`findings: ${total}  (not in round 1: ${unplaced}, counted as 'rest')`);
for (const [st, n, k, t, u] of rows) {
  console.log(`  stratum ${st.padEnd(16)} findings ${pad(n, 4)}  sampled-still-reported ${pad(k, 3)}  tp ${pad(t, 3)}  unsure ${pad(u, 3)}`);
}
console.log(`estimated tp ${Math.round(tp)}, unsure ${Math.round(unsure)}, ` +
  `precision among decided ${(100 * tp / (total - unsure)).toFixed(1)}%, ` +
  `if every unsure were tp ${(100 * (tp + unsure) / total).toFixed(1)}%`);
