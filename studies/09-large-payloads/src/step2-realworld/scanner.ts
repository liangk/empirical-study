// Real-world corpus scanner for Study 09: Large Payload Anti-Patterns
// Patterned after Study 08's scanner.ts

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { glob } from 'glob';
import { parseCorpus, getCorpusPath, CorpusRepo } from './corpus';
import { detectInFile, Finding } from '../step3-static-analysis/detector/payload-detector';

const REPOS_DIR = path.join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');
const CORPUS_PATH = getCorpusPath();

interface ScanError { repo: string; error: string; }

interface PrevalenceResult {
  totalRepos: number;
  reposWithFindings: number;
  prevalenceRate: number;
  totalFindings: number;
  byPattern: Record<string, number>;
  bySeverity: { high: number; medium: number; low: number };
  byDomain: Record<string, number>;
  byRepo: Record<string, number>;
  scannedAt: string;
}

function parseOwnerRepo(repo: CorpusRepo): { owner: string; name: string } {
  const parts = repo.name.split('/');
  return { owner: parts[0] || repo.name, name: parts[1] || repo.name };
}

async function cloneOrUpdate(repo: CorpusRepo): Promise<string> {
  const { owner, name } = parseOwnerRepo(repo);
  const repoDir = path.join(REPOS_DIR, owner, name);
  if (fs.existsSync(repoDir)) return repoDir;
  fs.mkdirSync(path.dirname(repoDir), { recursive: true });
  await simpleGit().clone(repo.url, repoDir, ['--depth', '1', '--single-branch']);
  return repoDir;
}

function findSourceFiles(repoDir: string): string[] {
  return glob.sync('**/*.{ts,js,tsx,jsx}', {
    cwd: repoDir,
    absolute: true,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**',
      '**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**',
      '**/.next/**', '**/.nuxt/**', '**/storybook-static/**',
    ],
  });
}

async function main() {
  const corpus = parseCorpus(CORPUS_PATH);
  console.log(`Scanning ${corpus.length} repos from corpus...`);

  fs.mkdirSync(REPOS_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const errorsPath = path.join(RESULTS_DIR, `scan-errors-${ts}.json`);

  // NOTE: findingsStream is disabled to prevent memory exhaustion.
  // Writing every finding to a stream keeps the stream buffer and JSON
  // strings in memory. With 300 repos and thousands of findings, this
  // accumulates faster than the write can flush, causing Node.js heap
  // overflow (FATAL ERROR: Ineffective mark-compacts near heap limit).
  // We keep prevalence stats in memory instead, which is bounded.
  // const findingsPath = path.join(RESULTS_DIR, `findings-${ts}.jsonl`);
  // const findingsStream = fs.createWriteStream(findingsPath);

  const prevalence: PrevalenceResult = {
    totalRepos: corpus.length,
    reposWithFindings: 0,
    prevalenceRate: 0,
    totalFindings: 0,
    byPattern: {},
    bySeverity: { high: 0, medium: 0, low: 0 },
    byDomain: {},
    byRepo: {},
    scannedAt: new Date().toISOString(),
  };
  const errors: ScanError[] = [];

  for (let i = 0; i < corpus.length; i++) {
    const repo = corpus[i];
    const tag = `[${i + 1}/${corpus.length}] ${repo.name}`;
    process.stdout.write(`${tag} ... `);

    try {
      const repoDir = await cloneOrUpdate(repo);
      const files = findSourceFiles(repoDir);
      let repoFindings = 0;

      for (const file of files) {
        const findings: Finding[] = detectInFile(file);
        for (const f of findings) {
          // findingsStream disabled — see comment above
          // const serialized = JSON.stringify({ repo: repo.name, ...f });
          // findingsStream.write(serialized + '\n');
          repoFindings++;
          prevalence.totalFindings++;
          prevalence.byPattern[f.pattern] = (prevalence.byPattern[f.pattern] ?? 0) + 1;
          prevalence.bySeverity[f.severity]++;
          prevalence.byDomain[repo.domain] = (prevalence.byDomain[repo.domain] ?? 0) + 1;
        }
      }

      if (repoFindings > 0) {
        prevalence.reposWithFindings++;
        prevalence.byRepo[repo.name] = repoFindings;
      }
      console.log(`${repoFindings} findings`);
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ repo: repo.name, error: err.message });
    }
  }

  // findingsStream.end();
  // await new Promise<void>(resolve => findingsStream.on('finish', () => resolve()));

  prevalence.prevalenceRate = prevalence.totalRepos > 0
    ? Math.round((prevalence.reposWithFindings / prevalence.totalRepos) * 1000) / 10
    : 0;

  const prevalencePath = path.join(RESULTS_DIR, `prevalence-${ts}.json`);
  fs.writeFileSync(prevalencePath, JSON.stringify(prevalence, null, 2));
  fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));

  console.log(`\n--- Summary ---`);
  console.log(`Repos scanned:    ${prevalence.totalRepos}`);
  console.log(`Repos with finds: ${prevalence.reposWithFindings} (${prevalence.prevalenceRate}%)`);
  console.log(`Total findings:   ${prevalence.totalFindings}`);
  console.log(`Scan errors:      ${errors.length}`);
  console.log(`\nBy pattern:`);
  for (const [pattern, count] of Object.entries(prevalence.byPattern).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern}: ${count}`);
  }
  console.log(`\nResults written to results/`);
}

main().catch(err => { console.error(err); process.exit(1); });
