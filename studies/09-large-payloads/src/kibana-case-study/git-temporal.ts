import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { KibanaFinding, KibanaFindingWithGit } from './types';

function parseArg(flag: string, defaultValue?: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  if (arg) {
    return arg.split('=')[1];
  }
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

function loadFindings(filePath: string): KibanaFinding[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as KibanaFinding[];
}

function formatQuarter(date: Date): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

interface BlameEntry {
  commitHash: string;
  author: string;
  authorTime: number;
  authorDate: string;
  summary: string;
  quarter: string;
}

function parseBlameForFile(repoRoot: string, filePath: string): BlameEntry[] | null {
  const relativePath = path.relative(repoRoot, filePath);
  const result = spawnSync('git', ['blame', '--line-porcelain', '--', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const lines = result.stdout.split(/\r?\n/);
  const entries: BlameEntry[] = [];
  let current: Partial<BlameEntry> | null = null;

  for (const lineText of lines) {
    if (!lineText.trim()) {
      if (current) {
        entries.push({
          commitHash: current.commitHash ?? 'unknown',
          author: current.author ?? 'unknown',
          authorTime: current.authorTime ?? 0,
          authorDate: current.authorDate ?? new Date(0).toISOString(),
          summary: current.summary ?? '',
          quarter: current.quarter ?? 'unknown',
        });
        current = null;
      }
      continue;
    }

    if (!current) {
      const [hash] = lineText.split(' ');
      current = { commitHash: hash };
      continue;
    }

    const [key, ...rest] = lineText.split(' ');
    if (!key) continue;
    const normalizedKey = key.replace(/-/g, '_');
    const value = rest.join(' ');

    if (normalizedKey === 'author_time') {
      const time = Number(value) || 0;
      current.authorTime = time;
      current.authorDate = new Date(time * 1000).toISOString();
      current.quarter = time ? formatQuarter(new Date(time * 1000)) : 'unknown';
    } else if (normalizedKey === 'author') {
      current.author = value;
    } else if (normalizedKey === 'summary') {
      current.summary = value;
    }
  }

  if (current) {
    entries.push({
      commitHash: current.commitHash ?? 'unknown',
      author: current.author ?? 'unknown',
      authorTime: current.authorTime ?? 0,
      authorDate: current.authorDate ?? new Date(0).toISOString(),
      summary: current.summary ?? '',
      quarter: current.quarter ?? 'unknown',
    });
  }

  return entries;
}

async function main() {
  const repoRoot = path.resolve(parseArg('--repo', process.cwd())!);
  const inputPath = path.resolve(parseArg('--input', path.join(process.cwd(), 'kibana-findings.json'))!);
  const outputPath = path.resolve(parseArg('--out', path.join(process.cwd(), 'kibana-findings-git.json'))!);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const findings = loadFindings(inputPath);
  const findingsByFile = new Map<string, typeof findings>();
  for (const finding of findings) {
    const key = finding.repoRelativePath;
    findingsByFile.set(key, [...(findingsByFile.get(key) ?? []), finding]);
  }

  const enriched: KibanaFindingWithGit[] = [];
  let fileCount = 0;

  for (const [repoRelativePath, fileFindings] of findingsByFile.entries()) {
    fileCount += 1;
    if (fileCount % 50 === 0) {
      console.log(`Processing ${fileCount}/${findingsByFile.size} files...`);
    }

    const filePath = path.resolve(repoRoot, repoRelativePath);
    const blameEntries = parseBlameForFile(repoRoot, filePath);

    for (const finding of fileFindings) {
      const gitMeta = blameEntries && blameEntries[finding.line - 1]
        ? blameEntries[finding.line - 1]
        : null;
      enriched.push({ ...finding, git: gitMeta });
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2));
  console.log(`Wrote ${enriched.length} git-enriched findings to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
