// Regex Analysis Scanner for Study 10
// Scans repositories for regex patterns and analyzes complexity

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import simpleGit from 'simple-git';
import { detectInDirectory, Finding } from '../step3-static-analysis/detector/redos-detector';

export interface RepoResult {
  repo: string;
  url: string;
  findings: Finding[];
  totalFiles: number;
  scannedFiles: number;
  timestamp: string;
}

export interface ScanSummary {
  totalRepos: number;
  totalFindings: number;
  findingsByPattern: Record<string, number>;
  findingsBySeverity: Record<string, number>;
  reposWithFindings: number;
  timestamp: string;
}

async function scanRepo(repoUrl: string, localPath: string): Promise<RepoResult> {
  console.log(`Scanning ${repoUrl}...`);

  const git = simpleGit();

  // Clone if not exists
  if (!fs.existsSync(localPath)) {
    console.log(`Cloning ${repoUrl} to ${localPath}...`);
    await git.clone(repoUrl, localPath);
  } else {
    console.log(`Updating ${localPath}...`);
    await git.cwd(localPath).pull();
  }

  // Count total JS/TS files
  const allFiles = await glob('**/*.{js,ts,jsx,tsx}', {
    cwd: localPath,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  });

  // Scan for findings
  const findings = await detectInDirectory(localPath);

  return {
    repo: path.basename(repoUrl, '.git'),
    url: repoUrl,
    findings,
    totalFiles: allFiles.length,
    scannedFiles: allFiles.length, // Assuming all are scannable
    timestamp: new Date().toISOString(),
  };
}

export async function scanRepos(repoUrls: string[], outputDir: string): Promise<ScanSummary> {
  const results: RepoResult[] = [];
  const tempDir = path.join(outputDir, 'temp-repos');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const url of repoUrls) {
    try {
      const repoName = path.basename(url, '.git');
      const localPath = path.join(tempDir, repoName);
      const result = await scanRepo(url, localPath);
      results.push(result);

      // Save individual repo results
      // const filename = `repo-${repoName}.json`;
      // fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Failed to scan ${url}:`, error);
    }
  }

  // Calculate summary
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const findingsByPattern: Record<string, number> = {};
  const findingsBySeverity: Record<string, number> = {};
  let reposWithFindings = 0;

  for (const result of results) {
    if (result.findings.length > 0) reposWithFindings++;

    for (const finding of result.findings) {
      findingsByPattern[finding.pattern] = (findingsByPattern[finding.pattern] || 0) + 1;
      findingsBySeverity[finding.severity] = (findingsBySeverity[finding.severity] || 0) + 1;
    }
  }

  const summary: ScanSummary = {
    totalRepos: results.length,
    totalFindings,
    findingsByPattern,
    findingsBySeverity,
    reposWithFindings,
    timestamp: new Date().toISOString(),
  };

  // Save summary
  fs.writeFileSync(path.join(outputDir, 'scan-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputDir, 'scan-results.json'), JSON.stringify(results, null, 2));

  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const corpusFile = args[0] || path.join(__dirname, '..', '..', 'data', 'corpus.md');

  if (!fs.existsSync(corpusFile)) {
    console.error(`Corpus file not found: ${corpusFile}`);
    process.exit(1);
  }

  // Read corpus (simple list of repo URLs)
  const content = fs.readFileSync(corpusFile, 'utf-8');
  const repoUrls = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('https://') && line.includes('github.com'))
    // .slice(0, 10); // Limit for testing

  console.log(`Scanning ${repoUrls.length} repositories...`);

  const outputDir = path.join(__dirname, '..', '..', 'results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = await scanRepos(repoUrls, outputDir);

  console.log('\nScan Summary:');
  console.log(`Total repos: ${summary.totalRepos}`);
  console.log(`Repos with findings: ${summary.reposWithFindings}`);
  console.log(`Total findings: ${summary.totalFindings}`);
  console.log('Findings by pattern:', summary.findingsByPattern);
  console.log('Findings by severity:', summary.findingsBySeverity);
}

if (require.main === module) {
  main().catch(console.error);
}