/**
 * Study 03 — Step 1: Repository Scanner
 *
 * Clones public repos from the sample list, detects the framework (React, Vue,
 * or Angular), runs the appropriate memory leak detector on all component/service
 * files, and saves results.
 *
 * Usage:
 *   ts-node src/step1-repo-scan/scanner.ts [--limit N] [--output path] [--framework react|vue|angular]
 *
 * Adapted from Study 02's scanner with multi-detector routing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, extname, relative } from 'path';
import { parseCode } from './detector/parser';
import { detectReactLeaks } from './detector/react-detector';
import { detectVueLeaks } from './detector/vue-detector';
import { detectAngularLeaks } from './detector/angular-detector';
import { detectFramework } from './detector/framework-utils';
import { ScanResult, ScanIssue, Framework } from './detector/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLONE_DIR = join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = join(__dirname, '..', '..', 'results');
const REPO_LIST_PATH = join(__dirname, '..', '..', 'data', 'app-samples.md');
const DEFAULT_CHECKPOINT_PATH = join(RESULTS_DIR, 'scan-checkpoint.json');

/** Directories to skip during scanning. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
  'vendor', '__pycache__', '.cache', '.output', 'out', 'public', 'static',
  '.angular', '.svelte-kit', 'storybook-static',
]);

/** File extensions to scan. */
const SCAN_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.vue']);

/** Skip files larger than 500KB (generated/bundled). */
const MAX_FILE_SIZE = 500_000;

// ---------------------------------------------------------------------------
// Repo list parser
// ---------------------------------------------------------------------------

interface RepoEntry {
  url: string;
  name: string;
  category: string;
  framework: Framework;
}

interface CheckpointRepo {
  url: string;
  name: string;
  category: string;
  framework: Framework;
}

interface ScanCheckpoint {
  version: number;
  createdAt: string;
  updatedAt: string;
  currentIndex: number;
  options: {
    frameworkFilter: Framework | 'all';
    limit: number | 'all';
  };
  repos: CheckpointRepo[];
  results: ScanResult[];
}

function parseRepoList(filePath: string): RepoEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const repos: RepoEntry[] = [];
  let currentCategory = '';
  let currentFramework: Framework = 'unknown';

  for (const line of content.split('\n')) {
    // Category headers encode the framework
    const catMatch = line.match(/^## Category \d+:\s*(.+)/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      if (/react/i.test(currentCategory)) currentFramework = 'react';
      else if (/vue/i.test(currentCategory)) currentFramework = 'vue';
      else if (/angular/i.test(currentCategory)) currentFramework = 'angular';
      else currentFramework = 'unknown';
      continue;
    }

    // Table row: | # | repo | url | stars | description |
    const rowMatch = line.match(/^\|\s*\d+\s*\|\s*([^\|]+)\s*\|\s*(https?:\/\/[^\s|]+)/);
    if (rowMatch) {
      const name = rowMatch[1].trim();
      const url = rowMatch[2].trim().replace(/\s+$/, '');
      repos.push({ url, name, category: currentCategory, framework: currentFramework });
    }
  }

  return repos;
}

function reposToCheckpointEntries(repos: RepoEntry[]): CheckpointRepo[] {
  return repos.map(({ url, name, category, framework }) => ({ url, name, category, framework }));
}

function checkpointEntriesToRepos(entries: CheckpointRepo[]): RepoEntry[] {
  return entries.map(({ url, name, category, framework }) => ({ url, name, category, framework }));
}

function loadCheckpoint(path: string): ScanCheckpoint | null {
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as ScanCheckpoint;
    return data;
  } catch (err) {
    console.error(`Failed to load checkpoint ${path}:`, err);
    return null;
  }
}

function saveCheckpoint(path: string, checkpoint: ScanCheckpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(checkpoint, null, 2));
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        if (stat.size > MAX_FILE_SIZE) continue;
        if (!SCAN_EXTENSIONS.has(extname(entry).toLowerCase())) continue;
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// ---------------------------------------------------------------------------
// Cloning
// ---------------------------------------------------------------------------

async function cloneRepo(url: string, dest: string): Promise<void> {
  const simpleGit = (await import('simple-git')).default;
  const git = simpleGit();
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  await git.clone(url, dest, ['--depth', '1', '--single-branch']);
}

// ---------------------------------------------------------------------------
// Per-file scanning
// ---------------------------------------------------------------------------

function scanFile(filePath: string, repoFramework: Framework): ScanIssue[] {
  let sourceCode: string;
  try {
    sourceCode = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  // For .vue files, extract the <script> block for AST analysis
  let codeToAnalyse = sourceCode;
  if (filePath.endsWith('.vue')) {
    const scriptMatch = sourceCode.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      codeToAnalyse = scriptMatch[1];
    } else {
      return []; // No script block
    }
  }

  let ast: any;
  try {
    ast = parseCode(codeToAnalyse, filePath);
  } catch {
    return [];
  }

  // Determine framework: prefer repo-level hint, fall back to file-level detection
  const framework = repoFramework !== 'unknown'
    ? repoFramework
    : detectFramework(codeToAnalyse, filePath);

  const ctx = { sourceCode: codeToAnalyse, filePath, ast, framework };

  switch (framework) {
    case 'react':
      return detectReactLeaks(ast, ctx);
    case 'vue':
      return detectVueLeaks(ast, ctx);
    case 'angular':
      return detectAngularLeaks(ast, ctx);
    default:
      // Try all detectors and merge results for unknown framework
      return [
        ...detectReactLeaks(ast, ctx),
        ...detectVueLeaks(ast, ctx),
        ...detectAngularLeaks(ast, ctx),
      ];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const outputIdx = args.indexOf('--output');
  const frameworkFilterIdx = args.indexOf('--framework');
  const frameworkFilter = frameworkFilterIdx >= 0 ? args[frameworkFilterIdx + 1] as Framework : undefined;
  const checkpointIdx = args.indexOf('--checkpoint');
  const checkpointPath = checkpointIdx >= 0 ? args[checkpointIdx + 1] : DEFAULT_CHECKPOINT_PATH;
  const resume = args.includes('--resume');

  // Ensure directories exist
  if (!existsSync(CLONE_DIR)) mkdirSync(CLONE_DIR, { recursive: true });
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  if (!existsSync(REPO_LIST_PATH)) {
    console.error(`Repo list not found: ${REPO_LIST_PATH}`);
    process.exit(1);
  }

  if (checkpointIdx >= 0 && !args[checkpointIdx + 1]) {
    console.error('You must provide a path after --checkpoint');
    process.exit(1);
  }

  let repos: RepoEntry[] = [];
  let checkpoint: ScanCheckpoint | null = null;
  let allResults: ScanResult[] = [];
  let startIndex = 0;

  if (resume) {
    checkpoint = loadCheckpoint(checkpointPath);
    if (!checkpoint) {
      console.error(`No checkpoint found at ${checkpointPath}. Run without --resume to start a fresh scan.`);
      process.exit(1);
    }
    repos = checkpointEntriesToRepos(checkpoint.repos);
    allResults = checkpoint.results || [];
    startIndex = checkpoint.currentIndex || allResults.length || 0;
    if (startIndex > repos.length) startIndex = repos.length;
    if (frameworkFilter && frameworkFilter !== checkpoint.options.frameworkFilter && checkpoint.options.frameworkFilter !== 'all') {
      console.warn(`Warning: --framework ${frameworkFilter} differs from checkpoint filter ${checkpoint.options.frameworkFilter}. Using checkpoint configuration.`);
    }
    if (limitIdx >= 0) {
      console.warn('Warning: --limit is ignored when --resume is used.');
    }
    console.log(`\n=== Study 03: Memory Leak Scan (resuming) ===`);
    console.log(`Checkpoint: ${checkpointPath}`);
    console.log(`Repos remaining: ${repos.length - startIndex} of ${repos.length}`);
    console.log('');
  } else {
    repos = parseRepoList(REPO_LIST_PATH);
    if (frameworkFilter) {
      repos = repos.filter(r => r.framework === frameworkFilter);
    }
    if (limit < repos.length) {
      repos = repos.slice(0, limit);
    }

    checkpoint = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentIndex: 0,
      options: {
        frameworkFilter: frameworkFilter || 'all',
        limit: Number.isFinite(limit) ? limit : 'all',
      },
      repos: reposToCheckpointEntries(repos),
      results: [],
    };
    saveCheckpoint(checkpointPath, checkpoint);

    console.log(`\n=== Study 03: Memory Leak Scan ===`);
    console.log(`Repos to scan: ${repos.length}`);
    if (frameworkFilter) console.log(`Framework filter: ${frameworkFilter}`);
    console.log(`Checkpoint file: ${checkpointPath}`);
    console.log('');
  }

  const startTime = Date.now();

  for (let i = startIndex; i < repos.length; i++) {
    const repo = repos[i];
    const dest = join(CLONE_DIR, repo.name.replace(/\//g, '__'));
    console.log(`[${i + 1}/${repos.length}] ${repo.name} (${repo.framework})...`);

    try {
      await cloneRepo(repo.url, dest);
    } catch (err: any) {
      console.log(`  ⚠ Clone failed: ${err.message}`);
      allResults.push({
        repoUrl: repo.url,
        repoName: repo.name,
        framework: repo.framework,
        filesScanned: 0,
        issues: [],
        scanDurationMs: 0,
        error: err.message,
      });
      continue;
    }

    const scanStart = Date.now();
    const files = collectFiles(dest);
    const issues: ScanIssue[] = [];

    for (const file of files) {
      const relPath = `${repo.name}/${relative(dest, file).replace(/\\/g, '/')}`;
      const fileIssues = scanFile(file, repo.framework);
      for (const issue of fileIssues) {
        issue.filePath = relPath;
      }
      issues.push(...fileIssues);
    }

    const scanDurationMs = Date.now() - scanStart;

    const result: ScanResult = {
      repoUrl: repo.url,
      repoName: repo.name,
      framework: repo.framework,
      filesScanned: files.length,
      issues,
      scanDurationMs,
    };
    allResults.push(result);

    if (checkpoint) {
      checkpoint.currentIndex = i + 1;
      checkpoint.results = allResults;
      saveCheckpoint(checkpointPath, checkpoint);
    }

    console.log(`  ${files.length} files, ${issues.length} issues (${scanDurationMs}ms)`);

    // Clean up clone to save disk space
    try {
      rmSync(dest, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  }

  const totalDuration = Date.now() - startTime;

  if (checkpoint && existsSync(checkpointPath)) {
    try {
      rmSync(checkpointPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  // Summary
  const totalIssues = allResults.reduce((sum, r) => sum + r.issues.length, 0);
  const totalFiles = allResults.reduce((sum, r) => sum + r.filesScanned, 0);
  const reposWithIssues = allResults.filter(r => r.issues.length > 0).length;

  console.log(`\n=== Scan Complete ===`);
  console.log(`Total repos: ${allResults.length}`);
  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Total issues found: ${totalIssues}`);
  console.log(`Repos with issues: ${reposWithIssues} (${((reposWithIssues / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = outputIdx >= 0
    ? args[outputIdx + 1]
    : join(RESULTS_DIR, `scan-${timestamp}.json`);

  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      totalRepos: allResults.length,
      totalFilesScanned: totalFiles,
      totalIssues,
      reposWithIssues,
      durationMs: totalDuration,
      frameworkFilter: frameworkFilter || 'all',
      resumed: resume,
    },
    results: allResults,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
