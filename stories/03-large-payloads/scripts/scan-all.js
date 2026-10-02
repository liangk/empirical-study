#!/usr/bin/env node
/**
 * Scan every pinned, non-duplicate repository in data/corpus.tsv.
 *
 * Usage:
 *   node scripts/scan-all.js [--parallel N] [--prune-only]
 *
 * Env: as for scan-repo.js (CORE_ENGINE, OLD_DETECTOR, OLD_NODE_MODULES, WORK, KEEP).
 *
 * Default: scan, writing results/raw/<slug>.json. Resumable — a repository
 * with a results file is skipped.
 * --prune-only: rebuild every pruned tree under KEEP and leave results/raw
 * untouched (scan-repo.js with PRUNE_ONLY=1). Nothing is skipped.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const pruneOnly = args.includes('--prune-only');
const pIdx = args.indexOf('--parallel');
const parallel = pIdx >= 0 ? Number(args[pIdx + 1]) : 2;

const [header, ...rows] = fs.readFileSync(path.join(ROOT, 'data', 'corpus.tsv'), 'utf8').trim().split(/\r?\n/);
const cols = header.split('\t');
const at = name => cols.indexOf(name);
const queue = rows
  .map(line => line.split('\t'))
  .filter(c => c[at('study09_commit')] && !c[at('duplicate_of')])
  .map(c => ({ repo: c[at('repo')], url: c[at('url')], commit: c[at('study09_commit')] }))
  .filter(r => pruneOnly || !fs.existsSync(path.join(ROOT, 'results', 'raw', `${r.repo.replace('/', '__')}.json`)));

const env = pruneOnly ? { ...process.env, PRUNE_ONLY: '1' } : process.env;
const runOne = r => new Promise(resolve => {
  const child = spawn(process.execPath, [path.join(__dirname, 'scan-repo.js'), r.repo, r.url, r.commit], { env, stdio: 'inherit' });
  child.on('close', resolve);
});

(async () => {
  let next = 0;
  const worker = async () => { while (next < queue.length) await runOne(queue[next++]); };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
})();
