import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { loadCorpus, CorpusRepo } from './corpus';
import { detectLeaks, LeakFinding } from '../step4-static-analysis/detector/resource-leak-detector';
import { glob } from 'glob';

const REPOS_DIR = path.join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');

interface RepoFinding extends LeakFinding {
  repo: string;
  domain: string;
}

function cloneRepo(repo: CorpusRepo): string {
  const repoDir = path.join(REPOS_DIR, repo.repo.replace(/\//g, '__'));
  if (fs.existsSync(repoDir)) return repoDir;

  console.log(`  Cloning ${repo.url}...`);
  const git = simpleGit();
  // Synchronous-style clone via execSync for simplicity
  const { execSync } = require('child_process');
  try {
    execSync(`git clone --depth 1 --single-branch ${repo.url} "${repoDir}"`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
  } catch (err: any) {
    throw new Error(`Clone failed: ${err.message?.slice(0, 200)}`);
  }
  return repoDir;
}

function findSourceFiles(repoDir: string): string[] {
  const pattern = path.join(repoDir, '**/*.{ts,js,mts,mjs,cts,cjs}').replace(/\\/g, '/');
  return glob.sync(pattern, {
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
      '**/coverage/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*',
      '**/__tests__/**', '**/__mocks__/**', '**/fixtures/**', '**/test/**',
    ],
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const corpus = loadCorpus();
  console.log(`Scanning ${corpus.length} repos from corpus...\n`);

  const allFindings: RepoFinding[] = [];

  for (const repo of corpus) {
    console.log(`[${repo.index}] ${repo.repo}`);
    try {
      const repoDir = cloneRepo(repo);
      const files = findSourceFiles(repoDir);
      console.log(`  Found ${files.length} source file(s)`);

      let repoFindings = 0;
      for (const file of files) {
        const findings = detectLeaks(file);
        for (const f of findings) {
          allFindings.push({
            ...f,
            file: path.relative(repoDir, f.file),
            repo: repo.repo,
            domain: repo.domain,
          });
          repoFindings++;
        }
      }
      console.log(`  ${repoFindings} finding(s)`);
    } catch (err) {
      console.warn(`  Error: ${(err as Error).message}`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const findingsFile = path.join(RESULTS_DIR, `findings-${timestamp}.json`);
  fs.writeFileSync(findingsFile, JSON.stringify(allFindings, null, 2));

  // Prevalence summary
  const byPattern = new Map<string, number>();
  const byRepo = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const f of allFindings) {
    byPattern.set(f.patternType, (byPattern.get(f.patternType) ?? 0) + 1);
    byRepo.set(f.repo, (byRepo.get(f.repo) ?? 0) + 1);
    bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  }

  const reposWithFindings = new Set(allFindings.map(f => f.repo)).size;
  const prevalence = {
    totalRepos: corpus.length,
    reposWithFindings,
    prevalenceRate: (reposWithFindings / corpus.length * 100).toFixed(1) + '%',
    totalFindings: allFindings.length,
    byPattern: Object.fromEntries(byPattern),
    bySeverity: Object.fromEntries(bySeverity),
    byRepo: Object.fromEntries([...byRepo.entries()].sort((a, b) => b[1] - a[1])),
  };

  const prevFile = path.join(RESULTS_DIR, `prevalence-${timestamp}.json`);
  fs.writeFileSync(prevFile, JSON.stringify(prevalence, null, 2));

  console.log(`\nFindings:   ${findingsFile}`);
  console.log(`Prevalence: ${prevFile}`);
  console.log(`\nTotal findings: ${allFindings.length} across ${corpus.length} repos`);
  console.log(`Repos with findings: ${reposWithFindings} (${prevalence.prevalenceRate})`);
  console.log(`\nBy pattern:`);
  for (const [type, count] of byPattern) console.log(`  ${type}: ${count}`);
  console.log(`\nBy severity:`);
  for (const [sev, count] of bySeverity) console.log(`  ${sev}: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });
