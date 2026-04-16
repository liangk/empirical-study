import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { glob } from 'glob';
import { loadCorpus, CorpusRepo } from './corpus';
import { detectBloat, BloatFinding } from '../step3-static-analysis/detector/bundle-bloat-detector';

interface ScanError { repo: string; error: string; }

interface PrevalenceResult {
  totalRepos: number;
  reposWithFindings: number;
  prevalenceRate: number;
  totalFindings: number;
  byPattern: Record<string, number>;
  bySeverity: { high: number; medium: number };
  byRepo: Record<string, number>;
  scannedAt: string;
}

const REPOS_DIR = path.join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');
const CORPUS_PATH = path.join(__dirname, '..', '..', 'data', 'corpus.md');

async function cloneOrUpdate(repo: CorpusRepo): Promise<string> {
  const repoDir = path.join(REPOS_DIR, repo.owner, repo.name);
  if (fs.existsSync(repoDir)) return repoDir;

  fs.mkdirSync(path.dirname(repoDir), { recursive: true });
  const git = simpleGit();
  await git.clone(repo.url, repoDir, ['--depth', '1', '--single-branch']);
  return repoDir;
}

function findSourceFiles(repoDir: string): string[] {
  return glob.sync('**/*.{ts,tsx,js,jsx,mts,mjs}', {
    cwd: repoDir,
    absolute: true,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**',
      '**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**',
      '**/storybook-static/**', '**/.next/**', '**/.nuxt/**',
    ],
  });
}

async function main() {
  const corpus = loadCorpus(CORPUS_PATH);
  console.log(`Scanning ${corpus.length} repos from corpus...`);

  fs.mkdirSync(REPOS_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const findingsPath = path.join(RESULTS_DIR, `findings-${ts}.json`);
  const errorsPath = path.join(RESULTS_DIR, `scan-errors-${ts}.json`);

  const findingsStream = fs.createWriteStream(findingsPath);
  findingsStream.write('[\n');
  let firstFinding = true;

  const prevalence: PrevalenceResult = {
    totalRepos: corpus.length, reposWithFindings: 0, prevalenceRate: 0,
    totalFindings: 0, byPattern: {}, bySeverity: { high: 0, medium: 0 }, byRepo: {},
    scannedAt: new Date().toISOString(),
  };
  const errors: ScanError[] = [];

  for (let i = 0; i < corpus.length; i++) {
    const repo = corpus[i];
    const tag = `[${i + 1}/${corpus.length}] ${repo.owner}/${repo.name}`;
    process.stdout.write(`${tag} ... `);

    try {
      const repoDir = await cloneOrUpdate(repo);
      const files = findSourceFiles(repoDir);
      let repoFindings = 0;

      for (const file of files) {
        const findings = detectBloat(file);
        for (const f of findings) {
          const serialized = JSON.stringify({ ...f, repo: `${repo.owner}/${repo.name}` });
          findingsStream.write((firstFinding ? '' : ',\n') + serialized);
          firstFinding = false;
          repoFindings++;
          prevalence.totalFindings++;
          prevalence.byPattern[f.category] = (prevalence.byPattern[f.category] ?? 0) + 1;
          prevalence.bySeverity[f.severity]++;
        }
      }

      if (repoFindings > 0) {
        prevalence.reposWithFindings++;
        prevalence.byRepo[`${repo.owner}/${repo.name}`] = repoFindings;
      }
      console.log(`${repoFindings} findings`);
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ repo: `${repo.owner}/${repo.name}`, error: err.message });
    }
  }

  findingsStream.write('\n]');
  findingsStream.end();
  await new Promise<void>(resolve => findingsStream.on('finish', () => resolve()));

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
    const pct = ((count / prevalence.totalFindings) * 100).toFixed(1);
    console.log(`  ${pattern}: ${count} (${pct}%)`);
  }
  console.log(`\nResults written to results/`);
}

main().catch(err => { console.error(err); process.exit(1); });
