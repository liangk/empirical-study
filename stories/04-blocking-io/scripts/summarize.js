#!/usr/bin/env node
/**
 * Step 1: summarise results/raw/*.json and reconcile Study 02's published
 * numbers (10,609 findings, 191 of 250 repositories, 76.4%).
 *
 * Usage:
 *   node scripts/summarize.js
 *
 * Writes results/summary-step1.json and prints the same tables.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'results', 'raw');
const [header, ...rows] = fs.readFileSync(path.join(ROOT, 'data', 'corpus.tsv'), 'utf8').trim().split(/\r?\n/);
const cols = header.split('\t');
const corpus = rows.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));

const results = fs.readdirSync(RAW).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')));
const by = new Map(results.map((r) => [r.repo, r]));
const distinct = corpus.filter((r) => !r.duplicate_of);
const missingRaw = distinct.filter((r) => !by.has(r.repo)).map((r) => r.repo);

const errors = results.filter((r) => r.error);
const ok = results.filter((r) => !r.error);
const pinned = ok.filter((r) => r.pinned);
// Every finding matches, file for file and line for line, but the walker's
// file count differs by a handful (the 500 KB limit, a symlink): as good as
// pinned for everything downstream, and counted with the pinned ones.
const sameFindings = (a) => a.missing === 0 && a.extra === 0;
const findingsExact = ok.filter((r) => !r.pinned && r.attempts.some(sameFindings));
const superset = ok.filter((r) => !r.pinned && !findingsExact.includes(r) && (r.superset || r.attempts[0].missing === 0));
const notPinned = ok.filter((r) => !r.pinned && !findingsExact.includes(r) && !superset.includes(r));
const usable = [...pinned, ...findingsExact];
const pinnedHow = {};
for (const r of pinned) {
  const a = r.attempts[r.attempts.length - 1];
  const k = a.side === 'candidate' ? 'candidate' : `${a.side} ${a.step}`;
  pinnedHow[k] = (pinnedHow[k] || 0) + 1;
}

const sum = (list, f) => list.reduce((a, r) => a + f(r), 0);
const published = 10609;
const dupFindings = sum(corpus.filter((r) => r.duplicate_of), (r) => Number(r.study02_findings));
const notPinnedFindings = sum(notPinned, (r) => r.expected.findings) + sum(errors, (r) => r.expected?.findings || 0);
const zeroFile = distinct.filter((r) => Number(r.study02_files) === 0).map((r) => r.repo);

const reconcile = [
  ['Study 02, published', published],
  [`Repositories listed twice, scanned and counted twice (${corpus.filter((r) => r.duplicate_of).map((r) => r.repo).join(', ')})`, -dupFindings],
  ['Superset at the candidate (every finding present, Study 02 saw far fewer files)', -sum(superset, (r) => r.expected.findings)],
  ['Not reproducible at any tried commit, or scan error', -notPinnedFindings],
];
let running = 0;
for (const row of reconcile) { running += row[1]; row.push(running); }

const withFinding = usable.filter((r) => r.old.findings.length > 0).length;
const denom = usable.filter((r) => r.old.files > 0).length;

// core-engine round 0, on pinned repositories only.
// core-engine 1.5.0's walker also skips these directories. The scans ran on
// 1.4.1; a skipped directory drops exactly the findings under it, so filtering
// by path gives what 1.5.0 would report without rescanning. WALKER=1.4.1
// reports the unfiltered numbers.
const WALKER_150 = /(^|\/)(test|tests|fixtures|__fixtures__|cypress|integration-tests)\//;
const walker = process.env.WALKER || '1.5.0';
const inScope = (f) => walker === '1.4.1' || !WALKER_150.test(f.file.replace(/\\/g, '/'));
for (const r of usable) r.new.findings = r.new.findings.filter(inScope);
const ruleCount = {};
let sameLine = 0, overlap = 0, newOnly = 0, oldOnly = 0;
const SKIP02 = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'vendor', '__pycache__', '.cache', '.output', 'out', 'public', 'static', 'test', 'tests', '__tests__', '__mocks__', 'fixtures', 'e2e']);
const newOnlyWhy = {};
for (const r of usable) {
  const seen = new Set();
  const oldKeys = new Set(r.old.findings.map((f) => `${f.file.slice(r.repo.length + 1)}:${f.line}`));
  const newKeys = new Set();
  for (const f of r.new.findings) {
    ruleCount[f.rule] = (ruleCount[f.rule] || 0) + 1;
    const file = f.file.replace(/\\/g, '/');
    const k = `${file}:${f.line}`;
    if (seen.has(k)) sameLine++; else seen.add(k);
    newKeys.add(k);
    if (oldKeys.has(k)) { overlap++; continue; }
    newOnly++;
    // Why Study 02 did not report it: its walker skipped the directory, or the
    // pattern is one Study 02 never had.
    const dir = file.split('/').slice(0, -1).find((s) => SKIP02.has(s));
    const why = dir ? `under ${dir}/ (Study 02 skips it)`
      : /\.(test|spec)\./.test(file) ? 'test/spec file'
      : f.rule.endsWith('database-operation') ? 'sync database rule (not in Study 02)'
      : /randomBytes/.test(f.title) ? 'randomBytes (not in Study 02)'
      : 'same directories, other cause';
    newOnlyWhy[why] = (newOnlyWhy[why] || 0) + 1;
  }
  for (const k of oldKeys) if (!newKeys.has(k)) oldOnly++;
}
const newTotal = sum(usable, (r) => r.new.findings.length);
const newRepos = usable.filter((r) => r.new.findings.length > 0).length;

const summary = {
  generatedAt: new Date().toISOString(),
  corpus: { rows: corpus.length, distinct: distinct.length, scanned: results.length, missingRaw },
  pinning: { pinned: pinned.length, how: pinnedHow,
    findingsExact: findingsExact.map((r) => ({ repo: r.repo, expected: r.expected, files: r.old.files })),
    superset: superset.map((r) => ({ repo: r.repo, expected: r.expected, atCandidate: r.attempts[0], extraSample: r.diff?.extra })), notPinned: notPinned.map((r) => ({ repo: r.repo, expected: r.expected, best: r.attempts.reduce((a, b) => (a.missing + a.extra <= b.missing + b.extra ? a : b)) })), errors: errors.map((r) => ({ repo: r.repo, error: r.error })) },
  reconcile,
  study02OnUsable: { repos: usable.length, findings: sum(usable, (r) => r.old.findings.length), files: sum(usable, (r) => r.old.files), parseErrors: sum(usable, (r) => r.old.parseErrors), reposWithFinding: withFinding, reposWithFiles: denom, zeroFileRowsInPublishedDenominator: zeroFile },
  coreEngineRound0: { walker, findings: newTotal, repos: newRepos, byRule: ruleCount, sameFileLineMoreThanOneCall: sameLine, sameFileLineAsStudy02: overlap, coreEngineOnly: newOnly, coreEngineOnlyWhy: newOnlyWhy, study02Only: oldOnly },
};
fs.writeFileSync(path.join(ROOT, 'results', 'summary-step1.json'), JSON.stringify(summary, null, 2));

console.log(`raw results ${results.length}/${distinct.length}${missingRaw.length ? `, missing: ${missingRaw.join(', ')}` : ''}`);
console.log(`pinned ${pinned.length}`, pinnedHow, `| superset ${superset.length} | not reproduced ${notPinned.length} | errors ${errors.length}`);
for (const r of superset) console.log(`  superset: ${r.repo} files ${r.attempts[0].files} vs ${r.expected.files}, findings ${r.attempts[0].findings} vs ${r.expected.findings}`);
for (const r of summary.pinning.notPinned) console.log(`  not reproduced: ${r.repo} expected ${r.expected.files} files/${r.expected.findings} findings, best ${r.best.commit.slice(0, 12)} ${r.best.files} files, missing ${r.best.missing}, extra ${r.best.extra}`);
for (const r of summary.pinning.errors) console.log(`  error: ${r.repo} ${r.error.split('\n')[0]}`);
console.log('\nReconcile');
for (const [label, delta, total] of reconcile) console.log(`  ${String(delta).padStart(7)}  ${String(total).padStart(7)}  ${label}`);
const s = summary.study02OnUsable;
console.log(`\nUsable = pinned + findings-exact: ${usable.length} repositories`);
for (const r of findingsExact) console.log(`  findings-exact: ${r.repo} ${r.expected.findings} findings, files ${r.old.files} vs ${r.expected.files}`);
console.log(`Study 02 detector on usable: ${s.findings} findings, ${s.files} files, ${s.parseErrors} files it could not parse (skipped silently in Study 02)`);
console.log(`  repositories with a finding ${s.reposWithFinding} of ${usable.length} (${(100 * s.reposWithFinding / usable.length).toFixed(1)}%), of ${s.reposWithFiles} with any file (${(100 * s.reposWithFinding / s.reposWithFiles).toFixed(1)}%)`);
console.log(`  zero-file rows in the published denominator: ${zeroFile.join(', ')}`);
const c = summary.coreEngineRound0;
console.log(`\ncore-engine round 0 on usable (walker ${walker}): ${c.findings} findings in ${c.repos} repositories`, c.byRule);
console.log(`  same file:line as a Study 02 finding ${c.sameFileLineAsStudy02}, core-engine only ${c.coreEngineOnly}, Study 02 only ${c.study02Only}`);
console.log('  core-engine only, why:', c.coreEngineOnlyWhy);
console.log(`  more than one call on the same line (mostly minified files): ${c.sameFileLineMoreThanOneCall}`);
