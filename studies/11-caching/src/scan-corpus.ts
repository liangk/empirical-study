import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { scanDirectory, CacheFinding } from './scanner';

interface CorpusRepo {
  url: string;
  owner: string;
  repo: string;
}

interface CorpusScanRecord {
  url: string;
  localPath?: string;
  status: 'scanned' | 'missing' | 'cloned' | 'clone-error' | 'error';
  findings: number;
  error?: string;
}

interface ScanOptions {
  corpusPath: string;
  reposDir: string;
  outputDir: string;
  aggregateOutput: string;
  skipClone: boolean;
  cloneDepth: number;
  maxRepos?: number;
}

function parseCorpus(corpusPath: string): CorpusRepo[] {
  const content = fs.readFileSync(corpusPath, 'utf8');
  const seen = new Set<string>();
  const repos: CorpusRepo[] = [];
  const regex = /https:\/\/github\.com\/([^/\s]+)\/([^/\s)#]+)/g;

  for (const match of content.matchAll(regex)) {
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const url = `https://github.com/${owner}/${repo}`;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push({ url, owner, repo });
  }

  return repos;
}

function candidatePaths(reposDir: string, repo: CorpusRepo): string[] {
  return [
    path.join(reposDir, repo.repo),
    path.join(reposDir, `${repo.owner}__${repo.repo}`),
    path.join(reposDir, `${repo.owner}-${repo.repo}`),
    path.join(reposDir, repo.owner, repo.repo),
  ];
}

function findLocalRepo(reposDir: string, repo: CorpusRepo): string | undefined {
  return candidatePaths(reposDir, repo).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

function cloneTargetPath(reposDir: string, repo: CorpusRepo): string {
  return path.join(reposDir, `${repo.owner}__${repo.repo}`);
}

function runGitClone(repo: CorpusRepo, targetPath: string, depth: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['clone', '--depth', String(depth), repo.url, targetPath];
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `git clone exited with code ${code}`));
    });
  });
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }
  return parsed;
}

function parseOptions(args: string[]): ScanOptions {
  const maxReposValue = getArgValue(args, '--max-repos');
  return {
    corpusPath: path.resolve(getArgValue(args, '--corpus') || 'data/corpus.md'),
    reposDir: path.resolve(getArgValue(args, '--repos-dir') || '.repos'),
    outputDir: path.resolve(getArgValue(args, '--output-dir') || 'results/corpus'),
    aggregateOutput: path.resolve(getArgValue(args, '--aggregate-output') || 'results/cache-opportunities-corpus.json'),
    skipClone: hasFlag(args, '--skip-clone'),
    cloneDepth: parsePositiveInteger(getArgValue(args, '--clone-depth'), 1),
    maxRepos: maxReposValue ? parsePositiveInteger(maxReposValue, 1) : undefined,
  };
}

async function ensureLocalRepo(repo: CorpusRepo, options: ScanOptions): Promise<{ localPath?: string; cloned: boolean; error?: string }> {
  const existingPath = findLocalRepo(options.reposDir, repo);
  if (existingPath) return { localPath: existingPath, cloned: false };
  if (options.skipClone) return { cloned: false };

  const targetPath = cloneTargetPath(options.reposDir, repo);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  console.log(`  cloning ${repo.url} -> ${targetPath}`);

  try {
    await runGitClone(repo, targetPath, options.cloneDepth);
    return { localPath: targetPath, cloned: true };
  } catch (error: any) {
    return { cloned: false, error: error?.message || String(error) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseOptions(args);

  if (!fs.existsSync(options.corpusPath)) {
    throw new Error(`Corpus file not found: ${options.corpusPath}`);
  }

  const allRepos = parseCorpus(options.corpusPath);
  const repos = options.maxRepos ? allRepos.slice(0, options.maxRepos) : allRepos;
  fs.mkdirSync(options.reposDir, { recursive: true });
  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(options.aggregateOutput), { recursive: true });

  const records: CorpusScanRecord[] = [];
  const aggregateFindings: CacheFinding[] = [];

  for (const [index, repo] of repos.entries()) {
    console.log(`[${index + 1}/${repos.length}] ${repo.owner}/${repo.repo}`);
    const localRepo = await ensureLocalRepo(repo, options);
    const localPath = localRepo.localPath;

    if (!localPath) {
      records.push({
        url: repo.url,
        status: localRepo.error ? 'clone-error' : 'missing',
        findings: 0,
        error: localRepo.error,
      });
      continue;
    }

    const outputPath = path.join(options.outputDir, `${repo.owner}__${repo.repo}.json`);
    try {
      const findings = await scanDirectory(localPath, outputPath);
      aggregateFindings.push(...findings);
      records.push({ url: repo.url, localPath, status: localRepo.cloned ? 'cloned' : 'scanned', findings: findings.length });
    } catch (error: any) {
      records.push({
        url: repo.url,
        localPath,
        status: 'error',
        findings: 0,
        error: error?.message || String(error),
      });
    }
  }

  fs.writeFileSync(options.aggregateOutput, JSON.stringify(aggregateFindings, null, 2), 'utf8');
  fs.writeFileSync(path.join(options.outputDir, 'manifest.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    corpusPath: options.corpusPath,
    reposDir: options.reposDir,
    aggregateOutput: options.aggregateOutput,
    skipClone: options.skipClone,
    cloneDepth: options.cloneDepth,
    totalReposInCorpus: allRepos.length,
    totalReposSelected: repos.length,
    scannedRepos: records.filter((record) => record.status === 'scanned' || record.status === 'cloned').length,
    clonedRepos: records.filter((record) => record.status === 'cloned').length,
    missingRepos: records.filter((record) => record.status === 'missing').length,
    cloneErrorRepos: records.filter((record) => record.status === 'clone-error').length,
    errorRepos: records.filter((record) => record.status === 'error').length,
    totalFindings: aggregateFindings.length,
    records,
  }, null, 2), 'utf8');

  console.log(`Corpus repos listed: ${allRepos.length}`);
  console.log(`Repos selected: ${repos.length}`);
  console.log(`Repos scanned: ${records.filter((record) => record.status === 'scanned' || record.status === 'cloned').length}`);
  console.log(`Repos cloned: ${records.filter((record) => record.status === 'cloned').length}`);
  console.log(`Repos missing locally: ${records.filter((record) => record.status === 'missing').length}`);
  console.log(`Repos with clone errors: ${records.filter((record) => record.status === 'clone-error').length}`);
  console.log(`Repos with errors: ${records.filter((record) => record.status === 'error').length}`);
  console.log(`Aggregate findings written to ${options.aggregateOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
