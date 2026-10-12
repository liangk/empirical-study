#!/usr/bin/env node
/**
 * Step 1: scan one repository at the commit Study 02 scanned, and prove it.
 *
 * Usage:
 *   node scripts/scan-repo.js <owner/name> <url> <candidate-commit>
 *
 * Env:
 *   OLD_JS       Study 02's detector/ compiled to CommonJS unchanged
 *                (studies/02-blocking-io/node_modules/.old-js, so @babel resolves
 *                from Study 02's own node_modules and nothing is committed)
 *   CORE_ENGINE  a built @code-evolution/core-engine (dist/index.js)
 *   WORK         scratch directory for checkouts (deleted afterwards)
 *   PIN_WORK     the blobless bare clones pin-commits.js made; used to find
 *                neighbouring commits when the candidate does not reproduce
 *   NEIGHBOURS   how many distinct scan-relevant states to try on each side
 *                around the point in history where the walker's file
 *                count matches Study 02's (default 0 = candidate only)
 *   KEEP         optional: keep a pruned copy of the matched checkout here
 *
 * A repository is pinned when Study 02's detector, with Study 02's own file
 * walker, reproduces its published findings exactly: the same number of
 * files, and the same multiset of file + line + method. The candidate from
 * pin-commits.js is tried first. If it does not reproduce, earlier and later
 * commits on the same first-parent line are tried, nearest first, skipping
 * any commit whose diff touches no file the walker would scan (its result
 * cannot differ). Clones in Study 02 were reused across runs, so the real
 * commit can be days older than the cutoff.
 *
 * Writes results/raw/<owner>__<name>.json with every attempt, the Study 02
 * findings at the chosen commit, and core-engine's blocking-io findings there.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [repo, url, candidate] = process.argv.slice(2);
if (!repo || !url || !candidate) {
  console.error('usage: scan-repo.js <owner/name> <url> <candidate-commit>');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const STUDY_SCAN = path.join(ROOT, '..', '..', 'studies', '02-blocking-io', 'results', 'scan-2026-02-13T23-27-06-376Z.json');
const slug = repo.replace('/', '__');
const WORK = process.env.WORK || path.join(require('os').tmpdir(), 'b02-work');
const PIN_WORK = process.env.PIN_WORK || path.join(require('os').tmpdir(), 'b02-pin');
// Off by default since 2026-10-08. Each neighbour is another full depth-1
// fetch and checkout; on the largest monorepos (ToolJet, twenty, webiny, n8n)
// that meant 10-22 fetches of hundreds of MB each, two repositories at a
// time, and it exhausted the machine's memory. Opt in per repository.
const NEIGHBOURS = process.env.NEIGHBOURS === undefined ? 0 : Number(process.env.NEIGHBOURS);
const KEEP = process.env.KEEP;
const OUT = path.join(ROOT, 'results', 'raw', `${slug}.json`);
const dir = path.join(WORK, slug);
const bare = path.join(PIN_WORK, `${slug}.git`);

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString().trim();

// ---------------------------------------------------------------- Study 02 --

// studies/02-blocking-io/src/step1-repo-scan/scanner.ts, reproduced exactly.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
  'vendor', '__pycache__', '.cache', '.output', 'out', 'public', 'static',
  'test', 'tests', '__tests__', '__mocks__', 'fixtures', 'e2e',
]);
const SCAN_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);
const MAX_FILE_SIZE = 500_000;

function collectFiles(d, files = []) {
  let entries;
  try { entries = fs.readdirSync(d); } catch { return files; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(d, entry);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) collectFiles(full, files);
    else if (stat.isFile() && SCAN_EXTENSIONS.has(path.extname(entry)) && stat.size < MAX_FILE_SIZE) files.push(full);
  }
  return files;
}

/** Could a change to this path change Study 02's result? */
const relevant = (p) => SCAN_EXTENSIONS.has(path.posix.extname(p)) && !p.split('/').some((s) => SKIP_DIRS.has(s));

function runOld() {
  const { parseCode } = require(path.join(process.env.OLD_JS, 'parser.js'));
  const { detectBlockingIO } = require(path.join(process.env.OLD_JS, 'blocking-io-detector.js'));
  const files = collectFiles(dir);
  const findings = [];
  let parseErrors = 0;
  for (const file of files) {
    try {
      const sourceCode = fs.readFileSync(file, 'utf-8');
      const ast = parseCode(sourceCode);
      const relPath = `${repo}/${path.relative(dir, file).replace(/\\/g, '/')}`;
      for (const i of detectBlockingIO(ast, { sourceCode, filePath: relPath, ast })) {
        findings.push({
          file: i.filePath, line: i.lineNumber, method: i.method, type: i.type, severity: i.severity,
          context: i.context, contextDetail: i.contextDetail, matchedBy: i.matchedBy,
          enclosingFunction: i.enclosingFunction, code: String(i.code ?? '').slice(0, 200),
        });
      }
    } catch {
      parseErrors++; // Study 02 skipped these silently; count them here.
    }
  }
  return { files: files.length, parseErrors, findings };
}

const key = (f) => `${f.file}:${f.line}:${f.method}`;

function compare(expected, got) {
  const count = new Map();
  for (const f of expected.issues) count.set(key({ file: f.filePath, line: f.lineNumber, method: f.method }), (count.get(key({ file: f.filePath, line: f.lineNumber, method: f.method })) || 0) + 1);
  let extra = 0;
  for (const f of got.findings) {
    const k = key(f);
    if (count.get(k)) count.set(k, count.get(k) - 1); else extra++;
  }
  const missing = [...count.values()].reduce((a, b) => a + b, 0);
  const filesMatch = got.files === expected.filesScanned;
  return { files: got.files, findings: got.findings.length, missing, extra, exact: filesMatch && missing === 0 && extra === 0 };
}

/** Which keys differ, capped, for diagnosing a repository that never pins. */
function diffSample(expected, got, cap = 20) {
  const want = new Map();
  for (const f of expected.issues) { const k = key({ file: f.filePath, line: f.lineNumber, method: f.method }); want.set(k, (want.get(k) || 0) + 1); }
  const extra = [];
  for (const f of got.findings) { const k = key(f); if (want.get(k)) want.set(k, want.get(k) - 1); else if (extra.length < cap) extra.push(k); }
  const missing = [...want].filter(([, n]) => n > 0).map(([k]) => k).slice(0, cap);
  return { missing, extra };
}

// --------------------------------------------------------------- checkout --

function checkout(commit) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  sh(dir, 'init', '-q');
  sh(dir, 'config', 'core.longpaths', 'true');
  sh(dir, 'remote', 'add', 'origin', url);
  // Bound git's own memory: index-pack runs one thread per core by default,
  // each with its own window, which on a large pack is gigabytes.
  sh(dir, '-c', 'pack.threads=1', '-c', 'pack.windowMemory=256m', '-c', 'core.packedGitLimit=256m',
    'fetch', '-q', '--depth', '1', 'origin', commit);
  sh(dir, '-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD');
}

/** Files Study 02's walker would pick up at a commit, from the tree alone (no blobs). */
function treeCount(commit) {
  return sh(bare, 'ls-tree', '-r', commit).split('\n')
    .filter((l) => l.startsWith('100'))
    .map((l) => l.slice(l.indexOf('\t') + 1))
    .filter(relevant).length;
}

/**
 * Commits to try after the candidate fails, nearest first.
 *
 * Study 02 reused its clones across runs, so for an active repository the
 * real commit can be weeks before the cutoff (medusajs/medusa: 6,999 files
 * scanned, 8,967 at the candidate). Walking states one by one from the
 * candidate never gets there. Instead, find where in first-parent history the
 * walker's file count crosses Study 02's, by binary search on tree listings,
 * and try the distinct scan-relevant states around that point.
 *
 * The tree count ignores the 500 KB limit and symlinks, so it is calibrated
 * against the walker's real count at the candidate.
 */
function neighbours(candidateFiles, expectedFiles) {
  if (!NEIGHBOURS || !fs.existsSync(bare)) return [];
  const target = expectedFiles - (candidateFiles - treeCount(candidate));
  const before = sh(bare, 'rev-list', '--first-parent', '-n', '5000', candidate).split('\n').filter(Boolean);
  const after = sh(bare, 'rev-list', '--first-parent', '--reverse', `${candidate}..HEAD`).split('\n').filter(Boolean);
  // One line, oldest first, with the candidate at index `at`.
  const line = [...before.slice().reverse(), ...after];
  const at = before.length - 1;
  const memo = new Map();
  const count = (i) => { if (!memo.has(i)) memo.set(i, treeCount(line[i])); return memo.get(i); };

  // File counts mostly grow over time: find the last index whose count is
  // <= target. If the candidate already matches, the pivot is the candidate.
  let pivot = at;
  if (count(at) !== target) {
    let lo = count(at) > target ? 0 : at;
    let hi = count(at) > target ? at : line.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (count(mid) <= target) lo = mid; else hi = mid - 1;
    }
    pivot = lo;
  }

  // Distinct scan-relevant states outward from the pivot, both directions.
  const walk = (dir) => {
    const out = [];
    let prev = line[pivot];
    for (let i = pivot + dir; i >= 0 && i < line.length && out.length < NEIGHBOURS; i += dir) {
      if (sh(bare, 'diff', '--name-only', prev, line[i]).split('\n').some(relevant)) { out.push(i); prev = line[i]; }
    }
    return out;
  };
  const order = [];
  if (pivot !== at) order.push(pivot);
  const back = walk(-1);
  const fwd = walk(1);
  for (let k = 0; k < Math.max(back.length, fwd.length); k++) {
    if (back[k] !== undefined) order.push(back[k]);
    if (fwd[k] !== undefined) order.push(fwd[k]);
  }
  return order
    .filter((i) => i !== at)
    .map((i) => ({ commit: line[i], side: i < at ? 'before' : 'after', step: Math.abs(i - at), treeFiles: count(i), target }));
}

// ------------------------------------------------------------ core-engine --

function runNew() {
  const ce = require(process.env.CORE_ENGINE);
  const registry = new ce.RuleRegistry();
  registry.registerAll(ce.blockingIoRules);
  const report = ce.analyzeDirectory({ targetPath: dir }, registry);
  return {
    files: report.summary.filesScanned,
    findings: report.issues.map((i) => ({
      rule: i.rule, file: i.file, line: i.line, severity: i.severity, title: i.title,
      snippet: String(i.snippet ?? '').slice(0, 200),
    })),
  };
}

// Files that could hold a finding for either detector. Used only to make
// later rescans cheap; scripts/check-prune.js (to write) must confirm a
// rescan of the pruned tree reproduces the full one before any round uses it.
const MAYBE = /Sync\b|randomBytes/;
function prune() {
  if (!KEEP) return null;
  const dest = path.join(KEEP, slug);
  fs.rmSync(dest, { recursive: true, force: true });
  let kept = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && SCAN_EXTENSIONS.has(path.extname(e.name))) {
        const text = fs.readFileSync(p, 'utf8');
        if (!MAYBE.test(text)) continue;
        const to = path.join(dest, path.relative(dir, p));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, text);
        kept++;
      }
    }
  };
  walk(dir);
  return kept;
}

// ------------------------------------------------------------------- main --

const started = Date.now();
const study = JSON.parse(fs.readFileSync(STUDY_SCAN, 'utf8'));
const expected = study.find((r) => r.repoName === repo);
const result = { repo, url, candidate, scannedAt: new Date().toISOString(), expected: { files: expected.filesScanned, findings: expected.issues.length }, attempts: [] };

try {
  let best = null;
  const tryOne = (commit, side, step) => {
    checkout(commit);
    const old = runOld();
    const cmp = compare(expected, old);
    result.attempts.push({ commit, side, step, ...cmp });
    if (!best || cmp.missing + cmp.extra < best.cmp.missing + best.cmp.extra) best = { commit, old, cmp };
    return cmp.exact;
  };
  let ok = tryOne(candidate, 'candidate', 0);
  // Every Study 02 finding is present at the candidate and only extras
  // differ: the commit is right and Study 02's run saw fewer files (medusajs/
  // medusa: 6,999 files against 8,967, all 103 findings present, 93 extra).
  // Other commits cannot fix that, so do not search.
  result.superset = !ok && result.attempts[0].missing === 0;
  if (!ok && !result.superset) {
    for (const n of neighbours(result.attempts[0].files, expected.filesScanned)) {
      if ((ok = tryOne(n.commit, n.side, n.step))) break;
      Object.assign(result.attempts[result.attempts.length - 1], { treeFiles: n.treeFiles, target: n.target });
    }
  }

  result.pinned = ok;
  result.commit = best.commit;
  result.old = best.old;
  if (!ok) result.diff = diffSample(expected, best.old);
  if (best.commit !== result.attempts[result.attempts.length - 1].commit) checkout(best.commit);
  result.new = runNew();
  result.keptFiles = prune();
} catch (e) {
  // e.stderr is a Buffer when git fails, and an empty Buffer is truthy, so
  // `e.stderr || e.message` gave "" for medusajs/medusa. Keep both.
  result.error = [e.message, e.stderr && String(e.stderr).trim()].filter(Boolean).join(' | ').slice(0, 500) || String(e);
}
result.seconds = Math.round((Date.now() - started) / 1000);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));

const last = result.attempts[result.attempts.length - 1];
const status = result.error
  ? `ERROR ${result.error.split('\n')[0]}`
  : result.pinned
    ? `pinned (${last.side}${last.step ? ' ' + last.step : ''})`
    : result.superset
      ? `SUPERSET at candidate: all ${result.expected.findings} Study 02 findings present, ${result.attempts[0].extra} extra, files ${result.attempts[0].files} vs ${result.expected.files}`
      : `NOT reproduced after ${result.attempts.length} tries, best missing=${Math.min(...result.attempts.map((a) => a.missing))} extra=${Math.min(...result.attempts.map((a) => a.extra))}`;
const counts = result.old && result.new ? `old=${result.old.findings.length}/${result.expected.findings} new=${result.new.findings.length}` : '';
console.log([repo, status, counts, `${result.seconds}s`].join('\t'));
