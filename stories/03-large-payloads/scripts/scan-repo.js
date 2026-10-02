#!/usr/bin/env node
/**
 * Scan one repository at the exact commit Study 09 scanned.
 *
 * Usage:
 *   node scripts/scan-repo.js <owner/name> <url> <commit>
 *
 * Env:
 *   CORE_ENGINE   path to a built @code-evolution/core-engine (dist/index.js)
 *   OLD_DETECTOR  Study 09's payload-detector.ts, compiled to CommonJS unchanged
 *   WORK          scratch directory for the checkout (deleted afterwards)
 *   KEEP          directory for the pruned source tree (see below)
 *
 * Writes results/raw/<owner>__<name>.json with:
 *   - every finding the Study 09 detector reports, with its source line, using
 *     Study 09's own file filter. This is the "before" — the data behind the
 *     published 52,010, which was never saved per finding.
 *   - every finding core-engine's payload rules report, using core-engine's
 *     own file walker, which is what the CLI ships.
 *
 * After scanning, the checkout is pruned to the JS/TS files that contain a
 * collection-finder call, and kept under KEEP. The payload rules decide
 * everything from inside a single file (imports, receivers, the call), so a
 * rescan of the pruned tree reports exactly what a rescan of the full tree
 * would. That is what lets each round of rule fixes rescan all 283
 * repositories without cloning them again. File counts are recorded before
 * pruning, so the denominators still describe the full repository.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [repo, url, commit] = process.argv.slice(2);
if (!repo || !url || !commit) {
  console.error('usage: scan-repo.js <owner/name> <url> <commit>');
  process.exit(2);
}

const slug = repo.replace('/', '__');
const WORK = process.env.WORK || '/tmp/p09-work';
const KEEP = process.env.KEEP;
const OUT = path.join(__dirname, '..', 'results', 'raw', `${slug}.json`);
const dir = path.join(WORK, slug);

const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });

function checkout() {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  git('init', '-q');
  git('remote', 'add', 'origin', url);
  git('fetch', '-q', '--depth', '1', 'origin', commit);
  git('-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD');
}

/** Study 09's scanner.ts file filter, reproduced exactly. */
function study09Files() {
  const { globSync } = require(require.resolve('glob', { paths: [process.env.OLD_NODE_MODULES || path.dirname(process.env.OLD_DETECTOR)] }));
  return globSync('**/*.{ts,js,tsx,jsx}', {
    cwd: dir,
    absolute: true,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**',
      '**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**',
      '**/.next/**', '**/.nuxt/**', '**/storybook-static/**',
    ],
  });
}

function runOld() {
  // OLD_DETECTOR is Study 09's payload-detector.ts compiled to JS as-is
  // (tsc --module commonjs), so no TypeScript toolchain runs per repository.
  const { detectInFile } = require(process.env.OLD_DETECTOR);
  const files = study09Files();
  const findings = [];
  const errors = [];
  for (const file of files) {
    try {
      // Study 09 aborted the whole repository on the first throw (EISDIR on a
      // directory named like a source file, a Babel duplicate declaration).
      // Here a throw is recorded and the scan carries on, so the "before" is
      // the detector's behaviour, not its crash rate.
      if (!fs.statSync(file).isFile()) { errors.push({ file: rel(file), error: 'not a file' }); continue; }
      for (const f of detectInFile(file)) {
        // The line is truncated: on a minified bundle it can run to megabytes.
        findings.push({ pattern: f.pattern, severity: f.severity, file: rel(f.file), line: f.line, code: String(f.code ?? '').slice(0, 200) });
      }
    } catch (e) {
      errors.push({ file: rel(file), error: String(e.message || e).slice(0, 200) });
    }
  }
  return { files: files.length, findings, errors };
}

function runNew() {
  const ce = require(process.env.CORE_ENGINE);
  const registry = new ce.RuleRegistry();
  registry.registerAll(ce.payloadRules);
  const report = ce.analyzeDirectory({ targetPath: dir }, registry);
  return {
    files: report.summary.filesScanned,
    findings: report.issues.map(i => ({ rule: i.rule, file: i.file, line: i.line, title: i.title, snippet: String(i.snippet ?? '').slice(0, 200) })),
  };
}

// Any mention of a collection finder's name. An earlier version required
// `(` straight after the name and silently dropped `repository.find<T>(...)`:
// rescanning the pruned trees lost 15 of kibana's and outline's findings, all
// with TypeScript type arguments. scripts/check-prune.js caught it.
const FINDER = /\b(findAll|findMany|find|getMany|findAndCountAll)\b/;
const SOURCE = /\.(m?js|jsx|ts|tsx)$/;

function prune() {
  if (!KEEP) return 0;
  const dest = path.join(KEEP, slug);
  fs.rmSync(dest, { recursive: true, force: true });
  let kept = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && SOURCE.test(e.name)) {
        const text = fs.readFileSync(p, 'utf8');
        // PRUNE_ALL=1 keeps every source file. Stage 2's cross-file pass needs
        // the route files, which mention no finder, and every definition of a
        // name to know whether the name is unique.
        if (!process.env.PRUNE_ALL && !FINDER.test(text)) continue;
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

const rel = f => path.relative(dir, f).split(path.sep).join('/');

// PRUNE_ONLY=1 rebuilds the pruned tree and leaves results/raw untouched.
if (process.env.PRUNE_ONLY) {
  try { checkout(); console.log(`${repo}\tkept=${prune()}`); }
  catch (e) { console.log(`${repo}\tERROR ${String(e.stderr || e.message).split('\n')[0]}`); }
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
}

const started = Date.now();
const result = { repo, url, commit, scannedAt: new Date().toISOString() };
try {
  checkout();
  result.old = runOld();
  result.new = runNew();
  result.keptFiles = prune();
} catch (e) {
  result.error = String(e.stderr || e.message || e).slice(0, 500);
}
result.seconds = Math.round((Date.now() - started) / 1000);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`${repo}\t${result.error ? 'ERROR ' + result.error.split('\n')[0] : `old=${result.old.findings.length} new=${result.new.findings.length}`}\t${result.seconds}s`);
