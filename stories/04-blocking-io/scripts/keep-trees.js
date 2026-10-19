#!/usr/bin/env node
/**
 * Check out every usable repository at its commit and prune it to what
 * core-engine's walker reads, for rescan.js.
 *
 * Usage: KEEP=<dir> node scripts/keep-trees.js [--parallel N]
 *
 * Run this in a cloud workspace, never on a laptop: it fetches 237
 * repositories (about 10 GB before pruning, 2.7 GB after). Each repository is
 * fetched at depth 1 at its commit, `.git` and `node_modules` are removed, and
 * every regular file that is not JS/TS (.js .ts .jsx .tsx .mjs .cjs),
 * `schema.prisma` or `package.json` is deleted. The walker reads nothing
 * else, so a rescan of the pruned tree equals a scan of the checkout:
 * verified 2026-10-19 (round 0 rescanned: 10,861 findings, identical file,
 * line, rule and severity in all 237 repositories). Finished repositories are
 * marked with `.pruned` and skipped on a rerun.
 */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEEP = process.env.KEEP;
if (!KEEP) { console.error('set KEEP=<dir>'); process.exit(1); }
const usable = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'results', 'raw', '_usable.json'), 'utf8'));
const pi = process.argv.indexOf('--parallel');
const N = pi > 0 ? Number(process.argv[pi + 1]) : 1;
const KEEP_EXT = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);
const KEEP_NAME = new Set(['schema.prisma', 'package.json', '.done', '.pruned']);

function prune(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') { fs.rmSync(p, { recursive: true, force: true }); continue; }
      prune(p);
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } else if (!KEEP_EXT.has(path.extname(e.name)) && !KEEP_NAME.has(e.name)) fs.rmSync(p, { force: true });
  }
}

function fetchOne({ repo, commit }) {
  return new Promise((resolve) => {
    const dir = path.join(KEEP, repo.replace('/', '__'));
    if (fs.existsSync(path.join(dir, '.pruned'))) return resolve('skip');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    try {
      git('init', '-q');
      git('remote', 'add', 'origin', `https://github.com/${repo}`);
    } catch (e) { return resolve(`FAIL ${repo} init`); }
    const f = spawn('git', ['-C', dir, '-c', 'pack.threads=1', 'fetch', '-q', '--depth', '1', 'origin', commit], { stdio: 'ignore' });
    f.on('exit', (code) => {
      if (code) return resolve(`FAIL ${repo} fetch`);
      try {
        git('-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD');
        prune(dir);
        fs.writeFileSync(path.join(dir, '.pruned'), `${commit}\n`);
        resolve(`ok ${repo}`);
      } catch (e) { resolve(`FAIL ${repo} checkout`); }
    });
  });
}

(async () => {
  const queue = [...usable];
  const worker = async () => { while (queue.length) console.log(await fetchOne(queue.shift())); };
  await Promise.all(Array.from({ length: N }, worker));
})();
