#!/usr/bin/env node
/**
 * Score a Step 5 round against the labelled samples.
 *
 * Usage: node scripts/eval-round.js results/rounds/<round>.json [--list]
 *
 * The core-engine sample (eval/sample.json) was drawn from round 0, stratified
 * by round-0 severity. A later round reports a subset of round 0's findings
 * plus possibly some new ones, so each sampled finding is either still
 * reported (same repository, file and line, any blocking-io rule) or dropped.
 * Within each stratum h, with N_h findings and n_h sampled:
 *
 *   findings kept  K = sum N_h * kept_h / n_h
 *   tp kept        T = sum N_h * tpKept_h / n_h
 *   precision        = T / K   (ratio estimator)
 *
 * Findings the round reports that round 0 did not are counted separately as
 * "new, unlabelled": the sample says nothing about them.
 *
 * The hard check is recall against the labels: every location labelled `tp`
 * in either sample that round 0 reported must still be reported. A dropped
 * `tp` is listed by id. Study 02 `tp` locations that round 0 never reported
 * are listed once as the gap against Study 02.
 *
 * --list prints every labelled location the round dropped, with its label.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
const roundFile = process.argv[2];
const LIST = process.argv.includes('--list');
if (!roundFile) { console.error('usage: eval-round.js <round.json> [--list]'); process.exit(1); }

const round = read(roundFile).repos;
const usable = read('results/raw/_usable.json');
const sample = read('eval/sample.json');
const items = read('eval/to-label.json').items;
const [, ...rows] = fs.readFileSync(path.join(ROOT, 'eval', 'labels.tsv'), 'utf8').trim().split(/\r?\n/);
const label = new Map(rows.map((l) => l.split('\t')).map(([id, lab]) => [id, lab]));

const WALKER_150 = /(^|\/)(test|tests|fixtures|__fixtures__|cypress|integration-tests)\//;
const key = (repo, file, line) => `${repo}|${file.replace(/\\/g, '/')}|${line}`;

// A line can carry more than one finding (`existsSync(p) && readFileSync(p)`),
// so both sides are counted per line.
const r0 = new Map();
for (const r of usable) for (const f of r.findings) if (!WALKER_150.test(f.file)) { const k = key(r.repo, f.file, f.line); r0.set(k, (r0.get(k) || 0) + 1); }
const now = new Map();
let total = 0;
for (const [repo, r] of Object.entries(round)) for (const f of r.findings) { const k = key(repo, f.file, f.line); if (!now.has(k)) now.set(k, f); total++; }
const nowCount = new Map();
for (const [repo, r] of Object.entries(round)) for (const f of r.findings) { const k = key(repo, f.file, f.line); nowCount.set(k, (nowCount.get(k) || 0) + 1); }
let newOnes = 0;
for (const [k, c] of nowCount) newOnes += Math.max(0, c - (r0.get(k) || 0));
const locOf = new Map();
for (const it of items) for (const s of it.samples) locOf.set(s, it);

// Core-engine sample, by round-0 severity stratum.
const strata = {};
for (const f of sample.findings) {
  const it = locOf.get(f.id);
  const lab = label.get(it.id);
  const s = (strata[f.stratum] ||= { N: sample.strata[f.stratum].population, n: 0, kept: 0, tp: 0, tpKept: 0, unsureKept: 0, byNewSeverity: {} });
  const k = key(f.repo, f.file, f.line);
  const kept = now.has(k);
  s.n++;
  if (lab === 'tp') s.tp++;
  if (kept) {
    s.kept++;
    if (lab === 'tp') s.tpKept++;
    if (lab === 'unsure') s.unsureKept++;
    const sev = now.get(k).severity;
    const b = (s.byNewSeverity[sev] ||= { n: 0, tp: 0 });
    b.n++; if (lab === 'tp') b.tp++;
  }
}
let K = 0, T = 0, U = 0, T0 = 0;
for (const s of Object.values(strata)) {
  K += s.N * s.kept / s.n; T += s.N * s.tpKept / s.n; U += s.N * s.unsureKept / s.n; T0 += s.N * s.tp / s.n;
}

// Recall against every labelled tp location, from either sample.
const dropped = [];
const gap = [];
for (const it of items) {
  const lab = label.get(it.id);
  const k = key(it.repo, it.file, it.line);
  if (!r0.has(k)) { if (lab === 'tp') gap.push(it); continue; }
  if (!now.has(k)) dropped.push({ ...it, lab });
}
const tpDropped = dropped.filter((d) => d.lab === 'tp');

// Severity as a ranking: weighted tp rate by the round's severity.
const sev = {};
for (const s of Object.values(strata)) for (const [k, b] of Object.entries(s.byNewSeverity)) {
  const x = (sev[k] ||= { est: 0, estTp: 0, n: 0, tp: 0 });
  x.est += s.N * b.n / s.n; x.estTp += s.N * b.tp / s.n; x.n += b.n; x.tp += b.tp;
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;
const r = Math.round;
console.log(`round: ${roundFile}`);
console.log(`findings: ${total} (${total - newOnes} also in round 0, ${newOnes} new and unlabelled)`);
console.log(`estimated from the core-engine sample: ${r(K)} round-0 findings kept, ${r(T)} of them tp (round 0: ${r(T0)}); precision ${pct(T / K)}; ${r(T + U)} if every unsure is tp`);
console.log(`labelled tp locations still reported: ${items.filter((it) => label.get(it.id) === 'tp' && r0.has(key(it.repo, it.file, it.line))).length - tpDropped.length} of ${items.filter((it) => label.get(it.id) === 'tp' && r0.has(key(it.repo, it.file, it.line))).length}${tpDropped.length ? ` -- DROPPED: ${tpDropped.map((d) => d.id).join(' ')}` : ''}`);
console.log(`Study 02 tp locations round 0 never reported: ${gap.length}${gap.length ? ` (${gap.map((g) => g.id).join(' ')})` : ''}`);
console.log('\nby round severity (core-engine sample, weighted):');
for (const k of ['critical', 'high', 'medium', 'low', 'info']) {
  const x = sev[k]; if (!x) continue;
  console.log(`  ${k.padEnd(9)} est. ${String(r(x.est)).padStart(6)} findings, sample ${String(x.n).padStart(3)} (${x.tp} tp), tp rate ${pct(x.estTp / x.est)}`);
}
const byLab = {};
for (const d of dropped) byLab[d.lab] = (byLab[d.lab] || 0) + 1;
console.log(`\nlabelled locations dropped since round 0: ${dropped.length}`, byLab);
if (LIST) for (const d of dropped) console.log(`  ${d.id} ${d.lab.padEnd(15)} ${d.repo} ${d.file}:${d.line}`);

const out = { round: roundFile, findings: total, newUnlabelled: newOnes, keptEstimate: K, tpEstimate: T, tpEstimateRound0: T0, precision: T / K, upperUnsureAsTp: T + U, tpDropped: tpDropped.map((d) => d.id), gapVsStudy02: gap.map((g) => g.id), droppedByLabel: byLab, bySeverity: sev };
fs.writeFileSync(path.resolve(ROOT, roundFile.replace(/\.json$/, '.score.json')), JSON.stringify(out, null, 2));
