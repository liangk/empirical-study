/**
 * Study 03 — Step 1: Aggregate Scan Results
 *
 * Reads raw scan JSON output, computes cross-repository statistics, and
 * prints a summary to the console. Saves aggregated data to a separate JSON file.
 *
 * Usage:
 *   ts-node src/step1-repo-scan/aggregate-results.ts [--input path]
 *
 * If --input is not given, reads the most recent scan-*.json in results/.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ScanResult, ScanIssue, AggregatedResults } from './detector/types';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');

// ---------------------------------------------------------------------------
// Find latest scan file
// ---------------------------------------------------------------------------

function findLatestScanFile(): string | null {
  if (!existsSync(RESULTS_DIR)) return null;
  const files = readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? join(RESULTS_DIR, files[0]) : null;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregate(results: ScanResult[]): AggregatedResults {
  const totalRepos = results.length;
  const totalFilesScanned = results.reduce((s, r) => s + r.filesScanned, 0);

  const allIssues: ScanIssue[] = [];
  for (const r of results) allIssues.push(...r.issues);

  const totalIssues = allIssues.length;
  const reposWithIssues = results.filter(r => r.issues.length > 0).length;
  const prevalenceRate = totalRepos > 0 ? reposWithIssues / totalRepos : 0;

  // Count helpers
  const countBy = (key: keyof ScanIssue): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const issue of allIssues) {
      const val = String(issue[key] ?? 'unknown');
      map[val] = (map[val] || 0) + 1;
    }
    return sortDesc(map);
  };

  const sortDesc = (map: Record<string, number>): Record<string, number> => {
    return Object.fromEntries(
      Object.entries(map).sort((a, b) => b[1] - a[1])
    );
  };

  // Top offenders
  const repoIssueCounts: Record<string, { framework: string; count: number }> = {};
  for (const r of results) {
    if (r.issues.length > 0) {
      repoIssueCounts[r.repoName] = { framework: r.framework, count: r.issues.length };
    }
  }
  const topOffenders = Object.entries(repoIssueCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([repo, data]) => ({ repo, framework: data.framework, issueCount: data.count }));

  return {
    totalRepos,
    totalFilesScanned,
    totalIssues,
    reposWithIssues,
    prevalenceRate,
    byFramework: countBy('framework'),
    byType: countBy('type'),
    byContext: countBy('context'),
    byContextDetail: countBy('contextDetail'),
    bySeverity: countBy('severity'),
    bySetupCall: countBy('setupCall'),
    topOffenders,
  };
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

function printTable(title: string, data: Record<string, number>) {
  console.log(`\n### ${title}`);
  console.log(`${'Label'.padEnd(45)} Count`);
  console.log('-'.repeat(55));
  for (const [key, count] of Object.entries(data)) {
    console.log(`${key.padEnd(45)} ${count}`);
  }
}

function printSummary(agg: AggregatedResults) {
  console.log('\n========================================');
  console.log('  Study 03: Memory Leak Scan Summary');
  console.log('========================================');
  console.log(`Total repos:        ${agg.totalRepos}`);
  console.log(`Files scanned:      ${agg.totalFilesScanned}`);
  console.log(`Total issues:       ${agg.totalIssues}`);
  console.log(`Repos with issues:  ${agg.reposWithIssues} (${(agg.prevalenceRate * 100).toFixed(1)}%)`);

  printTable('By Framework', agg.byFramework);
  printTable('By Leak Pattern', agg.byType);
  printTable('By Context', agg.byContext);
  printTable('By Severity', agg.bySeverity);
  printTable('By Setup Call', agg.bySetupCall);

  console.log('\n### Top Offenders');
  console.log(`${'Repo'.padEnd(40)} ${'Framework'.padEnd(12)} Issues`);
  console.log('-'.repeat(60));
  for (const t of agg.topOffenders) {
    console.log(`${t.repo.padEnd(40)} ${t.framework.padEnd(12)} ${t.issueCount}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : findLatestScanFile();

  if (!inputPath || !existsSync(inputPath)) {
    console.error('No scan results found. Run the scanner first or specify --input.');
    process.exit(1);
  }

  console.log(`Reading: ${inputPath}`);
  const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const results: ScanResult[] = raw.results || raw;

  const agg = aggregate(results);
  printSummary(agg);

  // Save
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(RESULTS_DIR, `summary-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(agg, null, 2));
  console.log(`\nSummary saved to: ${outputPath}`);
}

main();
