/**
 * Study 02 — Step 1: Repository Scanner
 *
 * Clones public repos from the sample list, scans all .js/.ts files
 * for blocking I/O patterns using AST analysis, and saves results.
 *
 * Usage:
 *   ts-node src/step1-repo-scan/scanner.ts [--limit N] [--output path]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, extname, relative } from 'path';
import { parseCode } from './detector/parser';
import { detectBlockingIO } from './detector/blocking-io-detector';
import { ScanResult, ScanIssue } from './detector/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLONE_DIR = join(__dirname, '..', '..', '.repos');  // temp clone directory
const RESULTS_DIR = join(__dirname, '..', '..', 'results');
const REPO_LIST_PATH = join(__dirname, '..', '..', 'data', 'repo-samples.md');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
  'vendor', '__pycache__', '.cache', '.output', 'out', 'public', 'static',
  'test', 'tests', '__tests__', '__mocks__', 'fixtures', 'e2e',
]);

const SCAN_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);
const MAX_FILE_SIZE = 500_000; // 500KB — skip very large generated/bundled files

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRepoList(filePath: string): Array<{ url: string; name: string; category: string }> {
  // The repo list is Markdown; we intentionally parse with lightweight regex
  // instead of adding a full Markdown table parser dependency.
  const content = readFileSync(filePath, 'utf-8');
  const repos: Array<{ url: string; name: string; category: string }> = [];
  let currentCategory = '';

  for (const line of content.split('\n')) {
    // Category is useful metadata in reports and downstream sampling.
    const catMatch = line.match(/^## Category \d+:\s*(.+)/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }

    // Extract canonical repo URL and owner/name identifier.
    const urlMatch = line.match(/https:\/\/github\.com\/([^\s|]+)/);
    if (urlMatch) {
      const fullUrl = `https://github.com/${urlMatch[1].replace(/\s+$/, '')}`;
      const name = urlMatch[1].replace(/\s+$/, '');
      repos.push({ url: fullUrl, name, category: currentCategory });
    }
  }

  return repos;
}

function collectFiles(dir: string, files: string[] = []): string[] {
  // Recursive DFS over repository tree.
  // Errors are swallowed to keep large scans resilient to permission/symlink issues.
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    // Skip known heavy/noisy directories to improve scan speed and signal quality.
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(entry)) && stat.size < MAX_FILE_SIZE) {
      // Only include source-like files and ignore oversized artifacts.
      files.push(fullPath);
    }
  }

  return files;
}

async function cloneRepo(url: string, dest: string): Promise<boolean> {
  // Use simple-git for shallow clone (depth 1) to reduce I/O and runtime.
  const simpleGit = (await import('simple-git')).default;
  const git = simpleGit();

  try {
    await git.clone(url, dest, ['--depth', '1', '--single-branch']);
    return true;
  } catch (err: any) {
    console.error(`  ✗ Clone failed: ${err.message}`);
    return false;
  }
}

function scanRepo(repoDir: string, repoName: string): { issues: ScanIssue[]; filesScanned: number } {
  // File-level scan loop: parse -> detect -> append issues.
  const files = collectFiles(repoDir);
  const allIssues: ScanIssue[] = [];

  for (const filePath of files) {
    try {
      const sourceCode = readFileSync(filePath, 'utf-8');
      const ast = parseCode(sourceCode);
      // Store paths as repo-relative + forward slashes so output is cross-platform stable.
      const relPath = `${repoName}/${relative(repoDir, filePath).replace(/\\/g, '/')}`;
      const issues = detectBlockingIO(ast, { sourceCode, filePath: relPath, ast });
      allIssues.push(...issues);
    } catch {
      // Skip files that fail to parse (binary, malformed, etc.)
    }
  }

  return { issues: allIssues, filesScanned: files.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  // Optional arguments allow quick local iteration without editing source.
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

  // Ensure directories exist
  if (!existsSync(CLONE_DIR)) mkdirSync(CLONE_DIR, { recursive: true });
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  // Parse curated sample list and optionally truncate by --limit.
  const repos = parseRepoList(REPO_LIST_PATH);
  const toScan = repos.slice(0, limit);

  console.log(`\n📋 Loaded ${repos.length} repos, scanning ${toScan.length}\n`);

  const results: ScanResult[] = [];

  for (let i = 0; i < toScan.length; i++) {
    const repo = toScan[i];
    const repoDir = join(CLONE_DIR, repo.name.replace('/', '__'));
    const progress = `[${i + 1}/${toScan.length}]`;

    console.log(`${progress} ${repo.name}`);

    // Per-repo stopwatch lets us surface outliers and clone/scan bottlenecks.
    const start = performance.now();
    let result: ScanResult;

    try {
      // Clone once; reuse local checkout when rerunning scans.
      if (existsSync(repoDir)) {
        console.log(`  ↪ Already cloned, reusing`);
      } else {
        const ok = await cloneRepo(repo.url, repoDir);
        if (!ok) {
          result = { repoUrl: repo.url, repoName: repo.name, filesScanned: 0, issues: [], scanDurationMs: 0, error: 'clone_failed' };
          results.push(result);
          continue;
        }
      }

      // Run AST detection across all eligible files in this repository.
      const { issues, filesScanned } = scanRepo(repoDir, repo.name);
      const duration = Math.round(performance.now() - start);

      result = { repoUrl: repo.url, repoName: repo.name, filesScanned, issues, scanDurationMs: duration };

      // Lightweight context distribution preview for quick CLI diagnostics.
      const issuesByCtx = issues.reduce((acc, iss) => {
        acc[iss.context] = (acc[iss.context] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`  ✓ ${filesScanned} files, ${issues.length} issues (${JSON.stringify(issuesByCtx)}) — ${duration}ms`);
    } catch (err: any) {
      result = { repoUrl: repo.url, repoName: repo.name, filesScanned: 0, issues: [], scanDurationMs: 0, error: err.message };
      console.error(`  ✗ Error: ${err.message}`);
    }

    results.push(result);

    // Optional cleanup for low-disk environments.
    // Left commented because keeping clones speeds up iterative scanner tuning.
    // try { rmSync(repoDir, { recursive: true, force: true }); } catch {}
  }

  // Persist raw per-repo scan results for later aggregation and audit.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = outputPath || join(RESULTS_DIR, `scan-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${outPath}`);

  // CLI summary is intentionally brief; full analytics happen in aggregate-results.ts.
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
  const reposWithIssues = results.filter(r => r.issues.length > 0).length;
  console.log(`\n📊 Summary: ${totalIssues} issues across ${reposWithIssues}/${results.length} repos (${((reposWithIssues / results.length) * 100).toFixed(1)}% prevalence)`);
}

main().catch(console.error);
