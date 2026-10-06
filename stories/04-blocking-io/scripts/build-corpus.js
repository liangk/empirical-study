#!/usr/bin/env node
/**
 * Build data/corpus.tsv from Study 02's own inputs and outputs.
 *
 * Usage:
 *   node scripts/build-corpus.js
 *
 * Reads:
 *   studies/02-blocking-io/data/repo-samples.md   the curated list (category, row order)
 *   studies/02-blocking-io/results/scan-2026-02-13T23-27-06-376Z.json
 *     the last of three identical scans (10,609 findings each) behind the
 *     published article
 *
 * Writes data/corpus.tsv: one row per scan result, in scan order, with
 * Study 02's file and finding counts and a duplicate_of column for
 * repositories listed (and scanned, and counted) more than once.
 */

const fs = require('fs');
const path = require('path');

const STUDY = path.join(__dirname, '..', '..', '..', 'studies', '02-blocking-io');
const SCAN = path.join(STUDY, 'results', 'scan-2026-02-13T23-27-06-376Z.json');
const LIST = path.join(STUDY, 'data', 'repo-samples.md');
const OUT = path.join(__dirname, '..', 'data', 'corpus.tsv');

// Same parse as Study 02's scanner.ts: category headings, then any github URL.
const category = new Map();
let current = '';
for (const line of fs.readFileSync(LIST, 'utf8').split(/\r?\n/)) {
  const cat = line.match(/^## Category \d+:\s*(.+)/);
  if (cat) { current = cat[1].trim(); continue; }
  const url = line.match(/https:\/\/github\.com\/([^\s|]+)/);
  if (url && !category.has(url[1].toLowerCase())) category.set(url[1].toLowerCase(), current);
}

const scan = JSON.parse(fs.readFileSync(SCAN, 'utf8'));
const firstIndex = new Map();
const rows = [['index', 'repo', 'url', 'category', 'study02_files', 'study02_findings', 'duplicate_of']];

scan.forEach((r, i) => {
  const key = r.repoName.toLowerCase();
  const dup = firstIndex.has(key) ? String(firstIndex.get(key)) : '';
  if (!dup) firstIndex.set(key, i + 1);
  rows.push([i + 1, r.repoName, r.repoUrl, category.get(key) || '', r.filesScanned, r.issues.length, dup]);
});

fs.writeFileSync(OUT, rows.map((r) => r.join('\t')).join('\n') + '\n');

const body = rows.slice(1);
const sum = (k) => body.reduce((a, r) => a + Number(r[k]), 0);
console.log(`rows ${body.length}, distinct ${firstIndex.size}, duplicates ${body.filter((r) => r[6]).length}`);
console.log(`files ${sum(4)}, findings ${sum(5)}, zero-file rows ${body.filter((r) => r[4] === 0).length}`);
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
