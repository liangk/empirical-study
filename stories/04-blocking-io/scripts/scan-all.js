#!/usr/bin/env node
/**
 * Step 1: run scan-repo.js over every non-duplicate repository in
 * data/corpus.tsv, at the candidate commits in data/study02-commits.tsv.
 *
 * Usage:
 *   node scripts/scan-all.js [--parallel N] [--only owner/name,...] [--redo] [--retry-errors]
 *
 * Env: as for scan-repo.js (OLD_JS, CORE_ENGINE, WORK, PIN_WORK, NEIGHBOURS, KEEP), plus
 *   HEAP_MB  heap cap for each scan-repo.js process (default 4096)
 *
 * Resumable: a repository that already has results/raw/<slug>.json is
 * skipped unless --redo is given, or --retry-errors and that result is an
 * error.
 *
 * 2026-10-08: at --parallel 4 the large monorepos in Study 02's "SSR
 * frameworks" category (next.js, nuxt, astro, sveltekit, gatsby) sit together
 * in the list, ran at the same time and exhausted the machine's memory: git
 * could not allocate a few MB and node could not start, which killed the
 * whole run. Each child now has a heap cap, a crashed child is logged and the
 * run carries on, and a failed spawn is retried once after a pause.
 *
 * The real load was the neighbour search in scan-repo.js, now off by
 * default, and the default parallelism is 1.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'results', 'raw');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const parallel = Number(opt('--parallel') || 1);
const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
const redo = args.includes('--redo');
const retryErrors = args.includes('--retry-errors');
const HEAP_MB = Number(process.env.HEAP_MB || 4096);

const tsv = (file) => {
  const [header, ...rows] = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8').trim().split(/\r?\n/);
  const cols = header.split('\t');
  return rows.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
};

const rawOf = (repo) => path.join(RAW, `${repo.replace('/', '__')}.json`);
const needsRun = (repo) => {
  if (redo || !fs.existsSync(rawOf(repo))) return true;
  if (!retryErrors) return false;
  try { return Boolean(JSON.parse(fs.readFileSync(rawOf(repo), 'utf8')).error); } catch { return true; }
};

const commits = new Map(tsv('study02-commits.tsv').map((r) => [r.repo, r]));
const queue = tsv('corpus.tsv')
  .filter((r) => !r.duplicate_of && (!only || only.has(r.repo)))
  .map((r) => ({ repo: r.repo, url: r.url, commit: commits.get(r.repo)?.candidate_commit }))
  .filter((r) => {
    if (!r.commit) { console.log(`${r.repo}\tskip: no candidate commit`); return false; }
    return needsRun(r.repo);
  });

console.log(`${queue.length} to scan, parallel ${parallel}, heap cap ${HEAP_MB} MB`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function spawnOnce(r) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, path.join(__dirname, 'scan-repo.js'), r.repo, r.url, r.commit], { stdio: 'inherit' });
    } catch (e) {
      return resolve({ spawnError: e });
    }
    child.on('error', (e) => resolve({ spawnError: e }));
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

async function runOne(r) {
  let res = await spawnOnce(r);
  if (res.spawnError) {
    console.log(`${r.repo}\tspawn failed (${res.spawnError.code || res.spawnError.message}), retrying in 30s`);
    await sleep(30_000);
    res = await spawnOnce(r);
  }
  if (res.spawnError) console.log(`${r.repo}\tSKIPPED: spawn failed twice (${res.spawnError.code || res.spawnError.message})`);
  else if (res.code !== 0) console.log(`${r.repo}\tCRASHED: exit ${res.code}${res.signal ? ' ' + res.signal : ''}, no result written`);
}

(async () => {
  let next = 0;
  const worker = async () => { while (next < queue.length) await runOne(queue[next++]); };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  console.log('done');
})();
