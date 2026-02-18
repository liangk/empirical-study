import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { detectIssues } from './detector/js-loop-detector';
import type { AntiPatternKind, LoopIssue } from './detector/js-loop-detector';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');

export interface EvalResult {
  tool: string;
  antiPattern: AntiPatternKind;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface FileResult {
  file: string;
  issues: LoopIssue[];
}

/** Recursively collect all JS/TS files under a directory. */
function collectFiles(dir: string, extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs']): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (extensions.includes(extname(entry))) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function computeMetrics(tp: number, fp: number, fn: number): { precision: number; recall: number; f1: number } {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : 2 * (precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

/**
 * Run the custom AST-based detector on a target directory and report all findings.
 * Ground-truth labeling for TP/FP/FN must be done manually by comparing
 * detector output against code review (see docs/statistical-analysis.md Phase 5).
 */
async function runDetector(targetDir: string): Promise<{ fileResults: FileResult[]; summary: Map<AntiPatternKind, number> }> {
  const files = collectFiles(targetDir);
  console.log(`Scanning ${files.length} JS/TS files in: ${targetDir}`);

  const fileResults: FileResult[] = [];
  const summary = new Map<AntiPatternKind, number>();

  for (const file of files) {
    const issues = detectIssues(file);
    if (issues.length > 0) fileResults.push({ file, issues });
    for (const issue of issues) {
      summary.set(issue.kind, (summary.get(issue.kind) ?? 0) + 1);
    }
  }

  return { fileResults, summary };
}

/** Print a summary table of findings by anti-pattern kind. */
function printSummaryTable(summary: Map<AntiPatternKind, number>, totalFiles: number): void {
  const kinds: AntiPatternKind[] = [
    'regex-in-loop', 'json-parse-in-loop', 'nested-loops',
    'nested-array-methods', 'chained-array-methods', 'sequential-await-in-loop',
  ];
  console.log('\n--- Detection Summary ---');
  console.log(`Files scanned: ${totalFiles}`);
  console.log('\nAnti-Pattern                  | Count');
  console.log('-'.repeat(40));
  for (const kind of kinds) {
    const count = summary.get(kind) ?? 0;
    console.log(`${kind.padEnd(30)} | ${count}`);
  }
  console.log('-'.repeat(40));
  const total = [...summary.values()].reduce((a, b) => a + b, 0);
  console.log(`${'TOTAL'.padEnd(30)} | ${total}`);
}

/** Stub: compute precision/recall/F1 from manually labeled ground truth. */
function computeEvalResults(): EvalResult[] {
  console.log('\n--- Precision / Recall / F1 ---');
  console.log('NOTE: Ground truth labeling is manual (see CHECKLIST.md Phase 5).');
  console.log('Fill in tp/fp/fn values below after manual review, then rerun.\n');

  const groundTruth: Array<{ kind: AntiPatternKind; tp: number; fp: number; fn: number }> = [
    { kind: 'regex-in-loop', tp: 0, fp: 0, fn: 0 },
    { kind: 'json-parse-in-loop', tp: 0, fp: 0, fn: 0 },
    { kind: 'nested-loops', tp: 0, fp: 0, fn: 0 },
    { kind: 'nested-array-methods', tp: 0, fp: 0, fn: 0 },
    { kind: 'chained-array-methods', tp: 0, fp: 0, fn: 0 },
    { kind: 'sequential-await-in-loop', tp: 0, fp: 0, fn: 0 },
  ];

  const results: EvalResult[] = [];
  console.log('Pattern                        TP   FP   FN   Prec   Rec    F1');
  console.log('-'.repeat(72));
  for (const gt of groundTruth) {
    const { precision, recall, f1 } = computeMetrics(gt.tp, gt.fp, gt.fn);
    console.log(
      `${gt.kind.padEnd(30)} ${String(gt.tp).padStart(4)} ${String(gt.fp).padStart(4)} ${String(gt.fn).padStart(4)}` +
      `   ${precision.toFixed(3)}  ${recall.toFixed(3)}  ${f1.toFixed(3)}`,
    );
    results.push({ tool: 'js-loop-detector', antiPattern: gt.kind, ...gt, precision, recall, f1 });
  }
  return results;
}

async function main(): Promise<void> {
  const targetArg = process.argv.find(a => a.startsWith('--path='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--path') + 1];

  if (!targetArg || !existsSync(targetArg)) {
    console.error('Usage: npm run detect -- --path <directory>');
    console.error('Example: npm run detect -- --path .repos/lodash__lodash');
    process.exit(1);
  }

  console.log('\n=== Study 04: Phase 5 — Static Analysis Tool Evaluation ===');
  const { fileResults, summary } = await runDetector(targetArg);

  const totalFiles = collectFiles(targetArg).length;
  printSummaryTable(summary, totalFiles);

  if (fileResults.length > 0) {
    console.log(`\n--- Top Issues (${Math.min(fileResults.length, 20)} of ${fileResults.length} files) ---`);
    for (const fr of fileResults.slice(0, 20)) {
      for (const issue of fr.issues.slice(0, 3)) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.kind} @ ${fr.file}:${issue.line}`);
        console.log(`    ${issue.snippet}`);
      }
    }
  }

  const evalResults = computeEvalResults();

  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `static-analysis-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    targetDir: targetArg,
    totalFilesScanned: totalFiles,
    totalIssues: [...summary.values()].reduce((a, b) => a + b, 0),
    issuesByKind: Object.fromEntries(summary),
    fileResults,
    evalResults,
  }, null, 2));

  console.log(`\nResults saved to: ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
