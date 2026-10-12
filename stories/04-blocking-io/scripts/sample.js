#!/usr/bin/env node
/**
 * Step 2 / Step 4: draw the labelling samples (eval/criteria.md, "Sampling").
 *
 * Usage:
 *   node scripts/sample.js
 *
 * Population: the 237 usable repositories (pinned, or findings-exact) from
 * results/raw/. core-engine findings are taken with the 1.5.0 walker applied
 * by path, as in summarize.js.
 *
 * - Study 02: 400 findings stratified by `context`. Not proportional: at
 *   proportional allocation background_path (139 of 10,058) would get about
 *   six, which estimates nothing. Each stratum gets a floor; estimates are
 *   weighted back by stratum size.
 * - core-engine: 400 stratified by severity, same reasoning; every critical
 *   is taken.
 * - A finding both detectors report (same repository, file, line and method)
 *   is labelled once: eval/to-label.json lists each distinct location once,
 *   with which samples it belongs to.
 *
 * Seeded and deterministic: the population is sorted before drawing, so the
 * same results/raw/ always gives the same samples.
 *
 * Writes eval/study02-sample.json, eval/sample.json, eval/to-label.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'results', 'raw');
const EVAL = path.join(ROOT, 'eval');
const SEED = 20261012;

const STUDY02_ALLOC = { unknown_path: 160, tooling_path: 70, startup_path: 70, request_path: 70, background_path: 30 };
const CORE_ALLOC = { critical: Infinity, high: 80, medium: 140, low: null }; // low takes the remainder of 400
const SAMPLE_SIZE = 400;
const WALKER_150 = /(^|\/)(test|tests|fixtures|__fixtures__|cypress|integration-tests)\//;

// mulberry32: small, seedable, good enough for sampling.
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
const rand = rng(SEED);
function draw(list, n) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
}

const norm = (p) => String(p).replace(/\\/g, '/');
const link = (f) => `https://github.com/${f.repo}/blob/${f.commit}/${f.file}#L${f.line}`;
const locKey = (f) => `${f.repo}|${f.file}|${f.line}|${f.method}`;
const byKey = (a, b) => (a.repo + a.file).localeCompare(b.repo + b.file) || a.line - b.line || a.method.localeCompare(b.method);

// ------------------------------------------------------------- population --
const study02 = [];
const core = [];
for (const name of fs.readdirSync(RAW).filter((f) => f.endsWith('.json')).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(RAW, name), 'utf8'));
  if (r.error || !r.old || !r.new) continue;
  const usable = r.pinned || (r.attempts || []).some((a) => a.missing === 0 && a.extra === 0);
  if (!usable) continue;
  for (const f of r.old.findings) {
    study02.push({
      repo: r.repo, commit: r.commit, file: f.file.slice(r.repo.length + 1), line: f.line, method: f.method,
      stratum: f.context, type: f.type, severity: f.severity, contextDetail: f.contextDetail, code: f.code,
    });
  }
  for (const f of r.new.findings) {
    const file = norm(f.file);
    if (WALKER_150.test(file)) continue;
    core.push({
      repo: r.repo, commit: r.commit, file, line: f.line, method: (f.title.split(': ')[1] || '').trim(),
      stratum: f.severity, rule: f.rule, title: f.title, code: f.snippet,
    });
  }
}
study02.sort(byKey);
core.sort(byKey);

function stratified(pop, alloc) {
  const groups = {};
  for (const f of pop) (groups[f.stratum] ||= []).push(f);
  const fixed = Object.entries(alloc).filter(([, n]) => n !== null);
  const rest = Object.entries(alloc).filter(([, n]) => n === null).map(([k]) => k);
  const taken = {};
  let used = 0;
  for (const [k, n] of fixed) { taken[k] = Math.min(n, (groups[k] || []).length); used += taken[k]; }
  for (const k of rest) taken[k] = Math.min(SAMPLE_SIZE - used, (groups[k] || []).length);
  const strata = {};
  const sample = [];
  for (const [k, n] of Object.entries(taken)) {
    const picked = draw(groups[k] || [], n);
    strata[k] = { population: (groups[k] || []).length, sampled: picked.length, weight: picked.length ? (groups[k].length / picked.length) : 0 };
    sample.push(...picked);
  }
  const unplanned = Object.keys(groups).filter((k) => !(k in alloc));
  if (unplanned.length) throw new Error(`strata with no allocation: ${unplanned.join(', ')}`);
  return { strata, sample };
}

const s02 = stratified(study02, STUDY02_ALLOC);
const sce = stratified(core, CORE_ALLOC);

// ------------------------------------------------------ one label per spot --
const allCoreKeys = new Set(core.map(locKey));
const allStudyKeys = new Set(study02.map(locKey));
const items = new Map();
const add = (f, which) => {
  const k = locKey(f);
  if (!items.has(k)) items.set(k, { repo: f.repo, commit: f.commit, file: f.file, line: f.line, method: f.method, url: link(f), code: f.code, samples: [] });
  items.get(k).samples.push(which);
};
s02.sample.forEach((f, i) => { f.id = `S${String(i + 1).padStart(3, '0')}`; f.url = link(f); f.alsoCoreEngine = allCoreKeys.has(locKey(f)); add(f, f.id); });
sce.sample.forEach((f, i) => { f.id = `C${String(i + 1).padStart(3, '0')}`; f.url = link(f); f.alsoStudy02 = allStudyKeys.has(locKey(f)); add(f, f.id); });
const toLabel = [...items.values()].map((x, i) => ({ id: `L${String(i + 1).padStart(3, '0')}`, ...x, label: null, note: '' }));

const meta = (name, src) => ({ seed: SEED, drawnAt: new Date().toISOString(), population: name, strata: src.strata });
fs.mkdirSync(EVAL, { recursive: true });
fs.writeFileSync(path.join(EVAL, 'study02-sample.json'), JSON.stringify({ ...meta('Study 02 detector, 237 usable repositories', s02), findings: s02.sample }, null, 2));
fs.writeFileSync(path.join(EVAL, 'sample.json'), JSON.stringify({ ...meta('core-engine round 0, 1.5.0 walker, 237 usable repositories', sce), findings: sce.sample }, null, 2));
const out = path.join(EVAL, 'to-label.json');
if (fs.existsSync(out) && JSON.parse(fs.readFileSync(out, 'utf8')).items?.some((x) => x.label)) {
  console.error('eval/to-label.json already has labels; not overwriting it. Move it aside to redraw.');
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify({ seed: SEED, criteria: 'eval/criteria.md', labels: ['tp', 'fp-startup', 'fp-once', 'fp-tooling', 'fp-not-blocking', 'unsure'], items: toLabel }, null, 2));

// ------------------------------------------------------------------ print --
const show = (title, src) => {
  console.log(`\n${title}`);
  for (const [k, v] of Object.entries(src.strata)) console.log(`  ${k.padEnd(16)} population ${String(v.population).padStart(5)}  sampled ${String(v.sampled).padStart(3)}  weight ${v.weight.toFixed(1)}`);
  console.log(`  total sampled ${src.sample.length}`);
};
show(`Study 02 (population ${study02.length})`, s02);
show(`core-engine 1.5.0 walker (population ${core.length})`, sce);
const both = toLabel.filter((x) => x.samples.some((s) => s[0] === 'S') && x.samples.some((s) => s[0] === 'C')).length;
console.log(`\nDistinct locations to label: ${toLabel.length} (${both} drawn into both samples)`);
console.log(`Study 02 sample items also reported by core-engine: ${s02.sample.filter((f) => f.alsoCoreEngine).length}`);
console.log(`core-engine sample items also reported by Study 02: ${sce.sample.filter((f) => f.alsoStudy02).length}`);
