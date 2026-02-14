/**
 * Study 02 — Step 1: Aggregate Scan Results
 *
 * Reads scan result JSON files and produces a statistical summary.
 *
 * Usage:
 *   ts-node src/step1-repo-scan/aggregate-results.ts [--input path]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ScanResult, AggregatedResults } from './detector/types';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');

function findLatestScanFile(): string | null {
  // Default behavior: aggregate the most recent scan output.
  if (!existsSync(RESULTS_DIR)) return null;
  const files = readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? join(RESULTS_DIR, files[0]) : null;
}

function aggregate(results: ScanResult[]): AggregatedResults {
  // Buckets below feed article tables and trend comparisons.
  const byType: Record<string, number> = {};
  const byContext: Record<string, number> = {};
  const byContextDetail: Record<string, number> = {};
  const byHeuristic: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const repoIssueCounts: Array<{ repo: string; issueCount: number }> = [];

  let totalIssues = 0;
  let totalFiles = 0;
  let reposWithIssues = 0;

  for (const r of results) {
    // Repo-level totals.
    totalFiles += r.filesScanned;
    totalIssues += r.issues.length;
    if (r.issues.length > 0) reposWithIssues++;
    repoIssueCounts.push({ repo: r.repoName, issueCount: r.issues.length });

    // Issue-level distributions.
    for (const iss of r.issues) {
      byType[iss.type] = (byType[iss.type] || 0) + 1;
      byContext[iss.context] = (byContext[iss.context] || 0) + 1;
      byContextDetail[iss.contextDetail] = (byContextDetail[iss.contextDetail] || 0) + 1;
      bySeverity[iss.severity] = (bySeverity[iss.severity] || 0) + 1;
      byMethod[iss.method] = (byMethod[iss.method] || 0) + 1;
      // A single issue may contribute to multiple heuristic counters.
      for (const hint of iss.matchedBy) {
        byHeuristic[hint] = (byHeuristic[hint] || 0) + 1;
      }
    }
  }

  // Highest issue counts first for "top offenders" section.
  repoIssueCounts.sort((a, b) => b.issueCount - a.issueCount);

  return {
    totalRepos: results.length,
    totalFilesScanned: totalFiles,
    totalIssues,
    reposWithIssues,
    prevalenceRate: results.length > 0 ? reposWithIssues / results.length : 0,
    byType,
    byContext,
    byContextDetail,
    byHeuristic,
    bySeverity,
    byMethod,
    topOffenders: repoIssueCounts.slice(0, 20),
  };
}

function printSummary(agg: AggregatedResults) {
  // Prevent divide-by-zero if summary is generated from an empty scan set.
  const pct = (count: number): string => agg.totalIssues > 0 ? ((count / agg.totalIssues) * 100).toFixed(1) : '0.0';

  console.log('\n════════════════════════════════════════════════');
  console.log('  STUDY 02 — BLOCKING I/O SCAN SUMMARY');
  console.log('════════════════════════════════════════════════\n');

  console.log(`Repos scanned:       ${agg.totalRepos}`);
  console.log(`Files scanned:       ${agg.totalFilesScanned}`);
  console.log(`Total issues:        ${agg.totalIssues}`);
  console.log(`Repos with issues:   ${agg.reposWithIssues} (${(agg.prevalenceRate * 100).toFixed(1)}%)`);
  console.log(`Avg issues/repo:     ${agg.totalRepos > 0 ? (agg.totalIssues / agg.totalRepos).toFixed(1) : '0.0'}`);

  console.log('\n--- By Issue Type ---');
  for (const [type, count] of Object.entries(agg.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${pct(count)}%)`);
  }

  console.log('\n--- By Context ---');
  for (const [ctx, count] of Object.entries(agg.byContext).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ctx}: ${count} (${pct(count)}%)`);
  }

  console.log('\n--- Top Context Details ---');
  for (const [detail, count] of Object.entries(agg.byContextDetail).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${detail}: ${count} (${pct(count)}%)`);
  }

  console.log('\n--- By Severity ---');
  for (const [sev, count] of Object.entries(agg.bySeverity).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sev}: ${count} (${pct(count)}%)`);
  }

  console.log('\n--- Top 10 Methods ---');
  // Most frequent Sync methods reveal dominant anti-patterns (e.g., existsSync).
  const methods = Object.entries(agg.byMethod).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [method, count] of methods) {
    console.log(`  ${method}: ${count}`);
  }

  console.log('\n--- Top Heuristics Matched ---');
  for (const [hint, count] of Object.entries(agg.byHeuristic).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${hint}: ${count}`);
  }

  console.log('\n--- Top 10 Repos by Issue Count ---');
  for (const { repo, issueCount } of agg.topOffenders.slice(0, 10)) {
    console.log(`  ${repo}: ${issueCount}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  // Optional --input allows comparing historical scan runs.
  const inputIdx = args.indexOf('--input');
  const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : findLatestScanFile();

  if (!inputPath) {
    console.error('No scan results found. Run `npm run scan` first.');
    process.exit(1);
  }

  console.log(`Reading results from: ${inputPath}`);
  const results: ScanResult[] = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const agg = aggregate(results);

  printSummary(agg);

  // Save deterministic JSON summary so article generation can reference exact numbers.
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = inputPath.replace('scan-', 'summary-');
  writeFileSync(outPath, JSON.stringify(agg, null, 2));
  console.log(`\n💾 Summary saved to ${outPath}`);
}

main();
