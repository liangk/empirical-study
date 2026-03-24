import * as fs from 'fs';
import * as path from 'path';
import { loadCorpus, CorpusRepo } from './corpus';
import { detectLeaks, LeakFinding } from '../step4-static-analysis/detector/resource-leak-detector';
import { glob } from 'glob';

const REPOS_DIR = path.join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');

interface ScanError {
  index: number;
  repo: string;
  url: string;
  domain: string;
  errorType: 'clone_failed' | 'zero_files' | 'parse_error' | 'other';
  errorMessage: string;
  timestamp: string;
}

interface RepoFinding extends LeakFinding {
  repo: string;
  domain: string;
}

function writeFinding(stream: fs.WriteStream, finding: RepoFinding, isFirst: boolean): boolean {
  const serialized = JSON.stringify(finding);
  stream.write(isFirst ? serialized : `,\n${serialized}`);
  return false;
}

function cloneRepo(repo: CorpusRepo): string {
  const repoDir = path.join(REPOS_DIR, repo.repo.replace(/\//g, '__'));
  if (fs.existsSync(repoDir)) {
    console.log(`  Using existing clone`);
    return repoDir;
  }

  console.log(`  Cloning ${repo.url}...`);
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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const findingsFile = path.join(RESULTS_DIR, `findings-${timestamp}.json`);
  const errorLogFile = path.join(RESULTS_DIR, `scan-errors-${timestamp}.json`);
  const prevFile = path.join(RESULTS_DIR, `prevalence-${timestamp}.json`);

  const scanErrors: ScanError[] = [];
  const byPattern = new Map<string, number>();
  const byRepo = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  const reposWithFindings = new Set<string>();
  let totalFindings = 0;
  let isFirstFinding = true;

  const findingsStream = fs.createWriteStream(findingsFile, { encoding: 'utf8' });
  findingsStream.write('[\n');

  for (const repo of corpus) {
    console.log(`[${repo.index}] ${repo.repo}`);
    try {
      const repoDir = cloneRepo(repo);
      const files = findSourceFiles(repoDir);
      console.log(`  Found ${files.length} source file(s)`);

      // Log if zero files found
      if (files.length === 0) {
        scanErrors.push({
          index: repo.index,
          repo: repo.repo,
          url: repo.url,
          domain: repo.domain,
          errorType: 'zero_files',
          errorMessage: 'No source files found after filtering',
          timestamp: new Date().toISOString(),
        });
      }

      let repoFindings = 0;
      for (const file of files) {
        try {
          const findings = detectLeaks(file);
          for (const f of findings) {
            const repoFinding: RepoFinding = {
              ...f,
              file: path.relative(repoDir, f.file),
              repo: repo.repo,
              domain: repo.domain,
            };

            isFirstFinding = writeFinding(findingsStream, repoFinding, isFirstFinding);
            byPattern.set(repoFinding.patternType, (byPattern.get(repoFinding.patternType) ?? 0) + 1);
            byRepo.set(repoFinding.repo, (byRepo.get(repoFinding.repo) ?? 0) + 1);
            bySeverity.set(repoFinding.severity, (bySeverity.get(repoFinding.severity) ?? 0) + 1);
            reposWithFindings.add(repoFinding.repo);
            totalFindings++;
            repoFindings++;
          }
        } catch (parseErr: any) {
          // Log parse errors but continue with other files
          if (parseErr.message.includes('Duplicate declaration')) {
            scanErrors.push({
              index: repo.index,
              repo: repo.repo,
              url: repo.url,
              domain: repo.domain,
              errorType: 'parse_error',
              errorMessage: `Parse error in ${path.basename(file)}: ${parseErr.message.slice(0, 200)}`,
              timestamp: new Date().toISOString(),
            });
            // Stop processing this repo if we hit duplicate declaration errors
            console.warn(`  Error: ${parseErr.message.slice(0, 100)}`);
            break;
          }
        }
      }
      console.log(`  ${repoFindings} finding(s)`);
    } catch (err: any) {
      const errorMsg = (err as Error).message;
      console.warn(`  Error: ${errorMsg}`);
      
      // Categorize error
      let errorType: ScanError['errorType'] = 'other';
      if (errorMsg.includes('Clone failed')) {
        errorType = 'clone_failed';
      }
      
      scanErrors.push({
        index: repo.index,
        repo: repo.repo,
        url: repo.url,
        domain: repo.domain,
        errorType,
        errorMessage: errorMsg.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    }
  }

  findingsStream.write('\n]\n');
  await new Promise<void>((resolve, reject) => {
    findingsStream.end((err?: Error | null) => err ? reject(err) : resolve());
  });

  // Write error log
  fs.writeFileSync(errorLogFile, JSON.stringify(scanErrors, null, 2));

  // Prevalence summary
  const prevalence = {
    totalRepos: corpus.length,
    reposWithFindings: reposWithFindings.size,
    prevalenceRate: (reposWithFindings.size / corpus.length * 100).toFixed(1) + '%',
    totalFindings,
    byPattern: Object.fromEntries(byPattern),
    bySeverity: Object.fromEntries(bySeverity),
    byRepo: Object.fromEntries([...byRepo.entries()].sort((a, b) => b[1] - a[1])),
  };

  fs.writeFileSync(prevFile, JSON.stringify(prevalence, null, 2));

  console.log(`\nFindings:   ${findingsFile}`);
  console.log(`Prevalence: ${prevFile}`);
  console.log(`Error Log:  ${errorLogFile}`);
  console.log(`\nTotal findings: ${totalFindings} across ${corpus.length} repos`);
  console.log(`Repos with findings: ${reposWithFindings.size} (${prevalence.prevalenceRate})`);
  console.log(`Scan errors: ${scanErrors.length}`);
  console.log(`\nBy pattern:`);
  for (const [type, count] of byPattern) console.log(`  ${type}: ${count}`);
  console.log(`\nBy severity:`);
  for (const [sev, count] of bySeverity) console.log(`  ${sev}: ${count}`);
  
  // Summary of errors by type
  if (scanErrors.length > 0) {
    const errorsByType = new Map<string, number>();
    for (const e of scanErrors) {
      errorsByType.set(e.errorType, (errorsByType.get(e.errorType) ?? 0) + 1);
    }
    console.log(`\nScan errors by type:`);
    for (const [type, count] of errorsByType) console.log(`  ${type}: ${count}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
