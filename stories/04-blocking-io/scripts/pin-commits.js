#!/usr/bin/env node
/**
 * Recover the commit Study 02 scanned for each repository.
 *
 * Study 02 cloned with --depth 1 into studies/02-blocking-io/.repos/ and that
 * directory no longer exists, so unlike Study 09 there is no HEAD to read.
 * The scan started at 2026-02-13T22:29:31Z (first finding id in
 * scan-2026-02-13T22-35-21-741Z.json is 1771021771639). The clones were made
 * at or before that, so each repository's candidate is the last commit on its
 * default branch committed before the cutoff.
 *
 * This is a candidate, not a pin. Committer date is not push date, a default
 * branch can be renamed, and history can be rewritten. Step 1 confirms each
 * candidate: a repository is pinned only when Study 02's detector, run at that
 * commit, reproduces its published findings file for file and line for line.
 *
 * Usage:
 *   node scripts/pin-commits.js [--limit N] [--parallel N]
 *
 * Env:
 *   WORK   scratch directory for blobless bare clones (default /tmp/b02-pin)
 *
 * Writes data/study02-commits.tsv:
 *   repo, branch, candidate_commit, committed_at, commits_after_cutoff, status
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const run = promisify(execFile);

const CUTOFF = '2026-02-13T22:29:31Z';
const WORK = process.env.WORK || '/tmp/b02-pin';
const CORPUS = path.join(__dirname, '..', 'data', 'corpus.tsv');
const OUT = path.join(__dirname, '..', 'data', 'study02-commits.tsv');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const LIMIT = opt('--limit', Infinity);
const PARALLEL = opt('--parallel', 4);

const [header, ...lines] = fs.readFileSync(CORPUS, 'utf8').trim().split('\n');
const cols = header.split('\t');
const corpus = lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])))
  .filter((r) => !r.duplicate_of)
  .slice(0, LIMIT);

const git = (cwd, ...a) => run('git', a, { cwd, maxBuffer: 1 << 26 }).then((r) => r.stdout.trim());

async function pin(row) {
  const dir = path.join(WORK, row.repo.replace('/', '__') + '.git');
  try {
    if (!fs.existsSync(dir)) {
      await run('git', ['clone', '-q', '--bare', '--filter=blob:none', '--single-branch', row.url, dir], { maxBuffer: 1 << 26 });
    }
    const branch = await git(dir, 'symbolic-ref', '--short', 'HEAD');
    const commit = await git(dir, 'rev-list', '-1', `--before=${CUTOFF}`, 'HEAD');
    if (!commit) return [row.repo, branch, '', '', '', 'no_commit_before_cutoff'];
    const at = await git(dir, 'log', '-1', '--format=%cI', commit);
    const after = await git(dir, 'rev-list', '--count', `${commit}..HEAD`);
    return [row.repo, branch, commit, at, after, 'candidate'];
  } catch (e) {
    const msg = String(e.stderr || e.message).split('\n')[0].slice(0, 120);
    return [row.repo, '', '', '', '', `clone_failed: ${msg}`];
  }
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const out = new Array(corpus.length);
  let next = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (next < corpus.length) {
      const i = next++;
      out[i] = await pin(corpus[i]);
      console.log(`${i + 1}/${corpus.length} ${out[i][0]} ${out[i][5]} ${out[i][2].slice(0, 12)}`);
    }
  }));
  const head = ['repo', 'branch', 'candidate_commit', 'committed_at', 'commits_after_cutoff', 'status'];
  fs.writeFileSync(OUT, [head, ...out].map((r) => r.join('\t')).join('\n') + '\n');
  const ok = out.filter((r) => r[5] === 'candidate').length;
  console.log(`candidates ${ok}/${out.length}; wrote ${path.relative(process.cwd(), OUT)}`);
})();
