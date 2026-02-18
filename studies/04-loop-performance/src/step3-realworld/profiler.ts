import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { loadCorpus } from './corpus';
import type { CorpusRepo } from './corpus';
import { detectIssues } from '../step4-static-analysis/detector/js-loop-detector';
import type { LoopIssue } from '../step4-static-analysis/detector/js-loop-detector';

const REPOS_DIR = join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = join(__dirname, '..', '..', 'results');

export interface HotLoopProfile {
  repoName: string;
  repoUrl: string;
  language: string;
  filePath: string;
  lineNumber: number;
  patternType: string;
  description: string;
  severity: string;
  snippet: string;
  confidence: 'high' | 'medium' | 'low';
  baselineTimeMs: number | null;
  optimizedTimeMs: number | null;
  speedupRatio: number | null;
  notes: string;
  gitBlame: GitBlameInfo | null;
  patchTracking: PatchTracking | null;
}

/** Git blame metadata extracted for §4.6 git history analysis. */
export interface GitBlameInfo {
  introducingCommit: string | null;
  commitDate: string | null;
  commitMessageKeywords: string[];
  introducedViaPR: boolean | null;
  prReviewCommentCount: number | null;
  reviewMentionedPerformance: boolean | null;
  survivorshipCount: number | null;
  functionTestCoverage: number | null;
  ageMonths: number | null;
}

/** PR tracking for §4.5 patch contribution campaign. */
export interface PatchTracking {
  patchPrepared: boolean;
  prUrl: string | null;
  submittedDate: string | null;
  status: 'pending' | 'submitted' | 'merged' | 'rejected' | 'modified' | 'closed';
  outcomeNotes: string | null;
}

export interface PrevalenceStats {
  totalInstances: number;
  byPattern: Record<string, number>;
  byDomain: Record<string, number>;
  byLanguage: Record<string, number>;
  prevalenceRate: Record<string, number>;
  densityPerKloc: Record<string, number>;
}

export interface CorpusResult {
  repo: CorpusRepo;
  cloned: boolean;
  cloneError: string | null;
  filesScanned: number;
  profiles: HotLoopProfile[];
}

async function cloneRepo(repo: CorpusRepo, targetDir: string): Promise<boolean> {
  if (existsSync(join(targetDir, '.git'))) {
    console.log(`  [${repo.name}] Already cloned — skipping.`);
    return true;
  }
  try {
    console.log(`  [${repo.name}] Cloning from ${repo.url}...`);
    const git = simpleGit();
    await git.clone(repo.url, targetDir, ['--depth', '1', '--single-branch']);
    console.log(`  [${repo.name}] Cloned.`);
    return true;
  } catch (err) {
    console.error(`  [${repo.name}] Clone failed: ${(err as Error).message}`);
    return false;
  }
}

/** Collect all .js/.ts files under a directory (non-recursive node_modules skip). */
function collectJsFiles(dir: string, exts = ['.js', '.ts', '.jsx', '.tsx', '.mjs']): string[] {
  const { readdirSync, statSync } = require('fs') as typeof import('fs');
  const { extname } = require('path') as typeof import('path');
  const files: string[] = [];
  function walk(d: string): void {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '.git' || e === 'dist' || e === 'build') continue;
      const full = join(d, e);
      try {
        const s = statSync(full);
        if (s.isDirectory()) walk(full);
        else if (exts.includes(extname(e))) files.push(full);
      } catch { /* skip unreadable */ }
    }
  }
  if (existsSync(dir)) walk(dir);
  return files;
}

/** Convert a LoopIssue from the AST detector into a HotLoopProfile. */
function issueToProfile(issue: LoopIssue, repo: CorpusRepo): HotLoopProfile {
  const confidence: 'high' | 'medium' | 'low' =
    issue.severity === 'high' ? 'high' :
    issue.severity === 'medium' ? 'medium' : 'low';
  return {
    repoName: repo.name,
    repoUrl: repo.url,
    language: repo.language,
    filePath: issue.file,
    lineNumber: issue.line,
    patternType: issue.kind,
    description: issue.description,
    severity: issue.severity,
    snippet: issue.snippet,
    confidence,
    baselineTimeMs: null,
    optimizedTimeMs: null,
    speedupRatio: null,
    notes: 'Detected by js-loop-detector. Manual review required to confirm TP vs FP.',
    gitBlame: {
      introducingCommit: null,
      commitDate: null,
      commitMessageKeywords: [],
      introducedViaPR: null,
      prReviewCommentCount: null,
      reviewMentionedPerformance: null,
      survivorshipCount: null,
      functionTestCoverage: null,
      ageMonths: null,
    },
    patchTracking: {
      patchPrepared: false,
      prUrl: null,
      submittedDate: null,
      status: 'pending',
      outcomeNotes: null,
    },
  };
}

/**
 * Run the JS/TS AST detector on the cloned repo directory.
 * Python repos: detection deferred to py-loop-detector.py (Phase 4.2).
 */
function detectHotLoops(repoDir: string, repo: CorpusRepo): { profiles: HotLoopProfile[]; filesScanned: number } {
  if (repo.language !== 'JS') {
    return {
      filesScanned: 0,
      profiles: [{
        repoName: repo.name,
        repoUrl: repo.url,
        language: repo.language,
        filePath: '(Python — pending py-loop-detector.py)',
        lineNumber: -1,
        patternType: 'pending',
        description: 'Python detection pending: run src/step4-static-analysis/detector/py-loop-detector.py',
        severity: 'medium',
        snippet: '',
        confidence: 'low',
        baselineTimeMs: null,
        optimizedTimeMs: null,
        speedupRatio: null,
        notes: 'Clone complete. Python AST detector not yet implemented.',
        gitBlame: null,
        patchTracking: null,
      }],
    };
  }

  const files = collectJsFiles(repoDir);
  const allIssues: LoopIssue[] = [];
  for (const f of files) {
    allIssues.push(...detectIssues(f));
  }
  return {
    filesScanned: files.length,
    profiles: allIssues.map(issue => issueToProfile(issue, repo)),
  };
}

async function profileRepo(repo: CorpusRepo): Promise<CorpusResult> {
  const repoDir = join(REPOS_DIR, repo.name.replace('/', '__'));
  mkdirSync(repoDir, { recursive: true });

  const cloned = await cloneRepo(repo, repoDir);
  if (!cloned) {
    return { repo, cloned: false, cloneError: 'Clone failed — see console', filesScanned: 0, profiles: [] };
  }

  const { profiles, filesScanned } = detectHotLoops(repoDir, repo);
  return { repo, cloned: true, cloneError: null, filesScanned, profiles };
}

/** Aggregate prevalence statistics across all corpus results (§4.3). */
function computePrevalence(results: CorpusResult[], corpus: CorpusRepo[]): PrevalenceStats {
  const byPattern: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const prevalenceProjects: Record<string, Set<string>> = {};
  let totalLoc = 0;

  for (const r of results) {
    const domain = corpus.find(c => c.name === r.repo.name)?.domain ?? 'unknown';
    for (const p of r.profiles) {
      if (p.patternType === 'pending') continue;
      byPattern[p.patternType] = (byPattern[p.patternType] ?? 0) + 1;
      byDomain[domain] = (byDomain[domain] ?? 0) + 1;
      byLanguage[p.language] = (byLanguage[p.language] ?? 0) + 1;
      if (!prevalenceProjects[p.patternType]) prevalenceProjects[p.patternType] = new Set();
      prevalenceProjects[p.patternType].add(r.repo.name);
    }
    totalLoc += r.filesScanned * 80;
  }

  const kloc = totalLoc / 1000;
  const prevalenceRate: Record<string, number> = {};
  const densityPerKloc: Record<string, number> = {};
  for (const [kind, count] of Object.entries(byPattern)) {
    prevalenceRate[kind] = (prevalenceProjects[kind]?.size ?? 0) / corpus.length;
    densityPerKloc[kind] = kloc > 0 ? count / kloc : 0;
  }

  return {
    totalInstances: Object.values(byPattern).reduce((a, b) => a + b, 0),
    byPattern,
    byDomain,
    byLanguage,
    prevalenceRate,
    densityPerKloc,
  };
}

async function main(): Promise<void> {
  const repos = loadCorpus();
  if (repos.length === 0) {
    console.error('No repos loaded from corpus.md');
    process.exit(1);
  }

  const limitArg = process.argv.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : repos.length;
  const langArg = process.argv.find(a => a.startsWith('--lang='))?.split('=')[1] as 'JS' | 'Python' | undefined;

  const filtered = repos
    .filter(r => !langArg || r.language === langArg)
    .slice(0, limit);

  console.log(`\n=== Study 04: Phase 4 — Real-World Corpus Profiling ===`);
  console.log(`Processing ${filtered.length} repos (lang=${langArg ?? 'all'})\n`);

  mkdirSync(RESULTS_DIR, { recursive: true });

  const results: CorpusResult[] = [];
  for (const repo of filtered) {
    console.log(`\n[${repo.index}/${repos.length}] ${repo.name}`);
    const result = await profileRepo(repo);
    results.push(result);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `realworld-${timestamp}.json`);

  const prevalence = computePrevalence(results, repos);
  const prevPath = join(RESULTS_DIR, `prevalence-${timestamp}.json`);

  const allFindings = results.flatMap(r => r.profiles.filter(p => p.patternType !== 'pending'));
  const findingsPath = join(RESULTS_DIR, `findings-${timestamp}.json`);

  writeFileSync(outPath, JSON.stringify(results, null, 2));
  writeFileSync(prevPath, JSON.stringify({ timestamp: new Date().toISOString(), ...prevalence }, null, 2));
  writeFileSync(findingsPath, JSON.stringify({ timestamp: new Date().toISOString(), total: allFindings.length, findings: allFindings }, null, 2));

  const cloned = results.filter(r => r.cloned).length;
  const failed = results.filter(r => !r.cloned).length;
  const totalFindings = allFindings.length;
  const highConf = allFindings.filter(f => f.confidence === 'high').length;

  console.log(`\n--- Summary ---`);
  console.log(`  Repos cloned   : ${cloned} / ${filtered.length}`);
  console.log(`  Clone failures : ${failed}`);
  console.log(`  JS files scanned: ${results.reduce((s, r) => s + r.filesScanned, 0)}`);
  console.log(`  Findings total : ${totalFindings} (${highConf} high-confidence)`);
  console.log(`  Prevalence     : ${prevPath}`);
  console.log(`  Findings DB    : ${findingsPath}`);
  console.log(`  Full output    : ${outPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review high-confidence findings manually: ${highConf} items`);
  console.log(`  2. Run Python detector: python src/step4-static-analysis/detector/py-loop-detector.py --path .repos/<repo>`);
  console.log(`  3. Select top 3 per pattern for §4.4 real-world measurement`);
}

main().catch(err => { console.error(err); process.exit(1); });
