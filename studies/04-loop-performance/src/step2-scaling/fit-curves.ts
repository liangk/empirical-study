import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BenchmarkOutput, BenchmarkSummary } from '../step1-benchmarks/harness/types';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');

interface CurveFit {
  moduleId: string;
  pattern: 'baseline' | 'optimized';
  environment: string;
  a: number;
  b: number;
  rSquared: number;
  empiricalComplexity: string;
  theoreticalComplexity: string;
  note: string;
}

/** Simple linear regression on (x, y) pairs. Returns { slope, intercept, rSquared }. */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const ssXY = x.reduce((acc, xi, i) => acc + (xi - xMean) * (y[i] - yMean), 0);
  const ssXX = x.reduce((acc, xi) => acc + (xi - xMean) ** 2, 0);
  const ssYY = y.reduce((acc, yi) => acc + (yi - yMean) ** 2, 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const rSquared = ssYY === 0 ? 1 : (ssXY ** 2) / (ssXX * ssYY);
  return { slope, intercept, rSquared };
}

/**
 * Fit t = a × n^b via log-log linear regression.
 * Returns a, b, R² and a human-readable complexity label.
 */
function fitPowerLaw(nValues: number[], meanWallMs: number[]): {
  a: number; b: number; rSquared: number; label: string;
} {
  const logN = nValues.map(n => Math.log(n));
  const logT = meanWallMs.map(t => Math.log(Math.max(t, 1e-9)));
  const { slope: b, intercept: logA, rSquared } = linearRegression(logN, logT);
  const a = Math.exp(logA);
  let label: string;
  if (b < 0.1) label = 'O(1)';
  else if (b < 0.7) label = 'O(log n)';
  else if (b < 1.3) label = 'O(n)';
  else if (b < 1.7) label = 'O(n log n)';
  else if (b < 2.3) label = 'O(n²)';
  else if (b < 3.2) label = 'O(n³)';
  else label = `O(n^${b.toFixed(2)})`;
  return { a, b, rSquared, label };
}

const THEORETICAL: Record<string, { baseline: string; optimized: string }> = {
  'BM-01': { baseline: 'O(n)', optimized: 'O(n)' },
  'BM-02': { baseline: 'O(n)', optimized: 'O(n)' },
  'BM-03': { baseline: 'O(n)', optimized: 'O(1)' },
  'BM-04': { baseline: 'O(n²)', optimized: 'O(n)' },
  'BM-05': { baseline: 'O(n²)', optimized: 'O(n²)' },
  'BM-06': { baseline: 'O(n)', optimized: 'O(n)' },
};

function note(empirical: string, theoretical: string): string {
  if (empirical === theoretical) return 'Matches theory.';
  return `Empirical ${empirical} vs theoretical ${theoretical} — investigate JIT/cache/scheduling effects.`;
}

function groupSummaries(summaries: BenchmarkSummary[]): Map<string, BenchmarkSummary[]> {
  const map = new Map<string, BenchmarkSummary[]>();
  for (const s of summaries) {
    const key = `${s.moduleId}|${s.pattern}|${s.environment}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

function loadLatestResults(): BenchmarkOutput | null {
  if (!existsSync(RESULTS_DIR)) {
    console.error(`Results directory not found: ${RESULTS_DIR}`);
    return null;
  }
  const { readdirSync } = require('fs') as typeof import('fs');
  const files = readdirSync(RESULTS_DIR)
    .filter((f: string) => f.startsWith('bench-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    console.error('No bench-*.json files found in results/. Run npm run bench:all first.');
    return null;
  }
  const latest = files[files.length - 1];
  const customInput = process.argv.find(a => a.startsWith('--input='))?.split('=')[1];
  const filePath = customInput ?? join(RESULTS_DIR, latest);
  console.log(`Loading: ${filePath}`);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as BenchmarkOutput;
}

function main(): void {
  const data = loadLatestResults();
  if (!data) process.exit(1);

  const grouped = groupSummaries(data.summaries);
  const fits: CurveFit[] = [];

  for (const [key, summaries] of grouped) {
    const sorted = summaries.sort((a, b) => a.n - b.n);
    const ns = sorted.map(s => s.n);
    const walls = sorted.map(s => s.meanWallMs);
    if (ns.length < 3) {
      console.warn(`  Skipping ${key} — need ≥3 n-values for regression (have ${ns.length})`);
      continue;
    }
    const [moduleId, pattern, environment] = key.split('|') as [string, string, string];
    const { a, b, rSquared, label } = fitPowerLaw(ns, walls);
    const theoretical = THEORETICAL[moduleId]?.[pattern as 'baseline' | 'optimized'] ?? '?';
    fits.push({
      moduleId, pattern: pattern as 'baseline' | 'optimized', environment,
      a, b, rSquared,
      empiricalComplexity: label,
      theoreticalComplexity: theoretical,
      note: note(label, theoretical),
    });
    console.log(`  ${moduleId} ${pattern}: b=${b.toFixed(3)} (${label})  R²=${rSquared.toFixed(4)}  theory=${theoretical}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `scaling-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), fits }, null, 2));
  console.log(`\nScaling analysis saved to: ${outPath}`);
}

main();
