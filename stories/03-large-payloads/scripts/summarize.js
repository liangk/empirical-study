#!/usr/bin/env node
/**
 * Summarise results/raw/*.json against Study 09's published prevalence file.
 *
 * Usage: node scripts/summarize.js <study09 prevalence json> > results/summary.json
 *
 * Checks, per repository, that the Study 09 detector re-run at the pinned
 * commit reports the same count Study 09 recorded. Study 09's `byRepo` is only
 * trustworthy for repositories listed once in the corpus — a repository listed
 * twice had its entry overwritten by the second scan — so those are compared
 * against the second scan's count, which is the one that survived.
 */

const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, '..', 'results', 'raw');
const study09 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const rows = fs.readdirSync(RAW).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')));

const ok = rows.filter(r => !r.error);
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

const reproduction = { exact: 0, differs: [], notInStudy09: [] };
for (const r of ok) {
  const published = study09.byRepo[r.repo];
  const now = r.old.findings.length;
  if (published === undefined) {
    // Study 09 records only repositories with at least one finding, and none
    // that errored.
    if (now > 0) reproduction.notInStudy09.push({ repo: r.repo, now, oldErrors: r.old.errors.length });
    else reproduction.exact++;
  } else if (published === now) reproduction.exact++;
  else reproduction.differs.push({ repo: r.repo, published, now, oldErrors: r.old.errors.length });
}

const byPattern = {};
for (const r of ok) for (const f of r.old.findings) byPattern[f.pattern] = (byPattern[f.pattern] || 0) + 1;

const byRule = {};
let selectOnly = 0;
for (const r of ok) for (const f of r.new.findings) {
  byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  // "find() without field selection" with no "and a row limit": a limit is
  // present, only select is missing — out of scope as of 2026-09-23.
  if (/without field selection$/.test(f.title)) selectOnly++;
}

console.log(JSON.stringify({
  scanned: ok.length,
  errors: rows.filter(r => r.error).map(r => ({ repo: r.repo, error: r.error.split('\n')[0] })),
  reproduction: { ...reproduction, differsCount: reproduction.differs.length },
  study09Detector: {
    files: sum(ok, r => r.old.files),
    findings: sum(ok, r => r.old.findings.length),
    reposWithFindings: ok.filter(r => r.old.findings.length > 0).length,
    fileErrors: sum(ok, r => r.old.errors.length),
    byPattern,
  },
  coreEngine: {
    files: sum(ok, r => r.new.files),
    findings: sum(ok, r => r.new.findings.length),
    reposWithFindings: ok.filter(r => r.new.findings.length > 0).length,
    byRule,
    selectOnly,
  },
}, null, 2));
