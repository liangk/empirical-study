#!/usr/bin/env node
// Score a scan run against the manually-verified ground truth.
// Usage: node score.js <results-dir> [label]
const fs = require('fs');
const path = require('path');

const labels = JSON.parse(fs.readFileSync(path.join(__dirname, 'labels.json'), 'utf8'));
const resultsDir = process.argv[2];
const runLabel = process.argv[3] || path.basename(resultsDir);

// scan-repo.sh writes <owner>_<repo>.json; the copies kept in ../results use
// dashes. Accept either so this can be pointed at a fresh run or at the
// published results folder.
const FILE_FOR_REPO = {
  'outline/outline': ['outline_outline.json', 'outline-outline.json'],
  'calcom/cal.com': ['calcom_cal.com.json', 'calcom-cal.com.json'],
  'immich-app/immich': ['immich-app_immich.json', 'immich-immich.json', 'immich_immich.json'],
};

function resolveResultFile(dir, repo) {
  for (const name of FILE_FOR_REPO[repo]) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let totalRaw = 0, totalTP = 0, totalFP = 0, totalMissed = 0;
const rows = [];
const detail = {};

for (const [repo, spec] of Object.entries(labels)) {
  if (repo.startsWith('_')) continue;
  const file = resolveResultFile(resultsDir, repo);
  if (!file) {
    console.error(`missing results file for ${repo} in ${resultsDir}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const genuine = spec.genuine;

  // Accepts both shapes: the CLI's full output (summary/files/detectors) and the
  // trimmed per-repo files kept in ../results, which hold only N+1 findings.
  const reported = [];
  if (Array.isArray(data.files)) {
    for (const f of data.files) {
      for (const det of f.detectors) {
        if (det.name !== 'N+1 Query Detector') continue;
        for (const iss of det.issues) {
          reported.push({ loc: f.filePath + ':' + iss.lineNumber, sev: iss.severity, desc: iss.description, code: (iss.codeBefore || '').slice(0, 160) });
        }
      }
    }
  } else {
    for (const iss of data.findings || []) {
      reported.push({ loc: iss.file + ':' + iss.line, sev: iss.severity, desc: iss.description, code: (iss.codeBefore || '').slice(0, 160) });
    }
  }

  // A finding matches a label when the label is a suffix of its path, so the
  // same labels work against absolute scan paths and trimmed relative ones.
  const labelFor = (loc) => genuine.find((g) => loc.endsWith(g)) || null;

  const tp = reported.filter((r) => labelFor(r.loc));
  const fp = reported.filter((r) => !labelFor(r.loc));
  const missed = genuine.filter((g) => !reported.some((r) => r.loc.endsWith(g)));

  totalRaw += reported.length;
  totalTP += tp.length;
  totalFP += fp.length;
  totalMissed += missed.length;

  rows.push({
    repo,
    raw: reported.length,
    tp: tp.length,
    fp: fp.length,
    missed: missed.length,
    fpRate: reported.length ? ((fp.length / reported.length) * 100).toFixed(1) + '%' : 'n/a',
    recall: genuine.length ? ((tp.length / genuine.length) * 100).toFixed(1) + '%' : 'n/a',
  });

  detail[repo] = { fp, missed };
}

console.log(`\n=== ${runLabel} ===`);
console.table(rows);
const fpRate = totalRaw ? (totalFP / totalRaw) * 100 : 0;
const recall = (totalTP / (totalTP + totalMissed)) * 100;
console.log(`TOTAL raw=${totalRaw} truePositives=${totalTP} falsePositives=${totalFP} missed=${totalMissed}`);
console.log(`FALSE-POSITIVE RATE: ${fpRate.toFixed(1)}%   RECALL: ${recall.toFixed(1)}%`);

if (process.argv.includes('--detail')) {
  for (const [repo, d] of Object.entries(detail)) {
    console.log(`\n--- ${repo}: remaining false positives (${d.fp.length}) ---`);
    d.fp.forEach((f) => {
      const m = f.desc.match(/\((.*?)\) inside/);
      console.log(`  ${f.loc} [${m ? m[1] : '?'}]`);
      console.log(`      ${f.code.replace(/\n/g, ' ').slice(0, 130)}`);
    });
    if (d.missed.length) {
      console.log(`--- ${repo}: MISSED genuine findings (${d.missed.length}) ---`);
      d.missed.forEach((m) => console.log(`  ${m}`));
    }
  }
}
