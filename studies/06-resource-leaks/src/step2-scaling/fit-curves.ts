import * as fs from 'fs';
import * as path from 'path';
import { linearRegression, mean, median, stddev } from '../step1-benchmarks/harness/stats';
import { LeakSummary } from '../step1-benchmarks/harness/types';

const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');

interface ScalingResult {
  module: string;
  pattern: 'leaky' | 'proper';
  /** Leak rate slope across n values. */
  leakRates: { n: number; leakRate: number }[];
  /** Memory growth slope across n values. */
  memGrowths: { n: number; memGrowth: number }[];
  /** Linear fit of leakRate vs n: leakRate = a + b*n. */
  leakRateFit: { a: number; b: number; rSquared: number };
  /** Linear fit of memGrowth vs n. */
  memGrowthFit: { a: number; b: number; rSquared: number };
  /** Production projection: time-to-failure at various request rates. */
  projections: ProductionProjection[];
}

interface ProductionProjection {
  requestRate: number;  // req/s
  label: string;
  ttfSeconds: number | null;  // null if no leak
  ttfHuman: string;
}

/** System limits for TTF calculation. */
const SYSTEM_LIMITS = {
  connectionPool: 10,
  fileDescriptors: 1024,
  heapBytes: 1.5 * 1024 * 1024 * 1024,  // 1.5GB default Node.js heap limit
};

const REQUEST_RATES = [
  { rate: 1, label: '1 req/s (low traffic)' },
  { rate: 10, label: '10 req/s (moderate)' },
  { rate: 100, label: '100 req/s (production)' },
  { rate: 1000, label: '1000 req/s (peak)' },
];

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}hr`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function computeProjections(leakRate: number, module: string): ProductionProjection[] {
  // Determine which system limit applies
  let limit: number;
  if (module === 'BM-01') limit = SYSTEM_LIMITS.connectionPool;
  else if (module === 'BM-02' || module === 'BM-03') limit = SYSTEM_LIMITS.fileDescriptors;
  else limit = SYSTEM_LIMITS.heapBytes;  // BM-04, BM-05, BM-06 are memory-based

  return REQUEST_RATES.map(({ rate, label }) => {
    if (leakRate <= 0) return { requestRate: rate, label, ttfSeconds: null, ttfHuman: 'no leak' };
    const ttfSeconds = limit / (leakRate * rate);
    return { requestRate: rate, label, ttfSeconds, ttfHuman: humanDuration(ttfSeconds) };
  });
}

function fitScaling(summaries: LeakSummary[]): ScalingResult[] {
  const grouped = new Map<string, LeakSummary[]>();
  for (const s of summaries) {
    const key = `${s.module}::${s.pattern}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const results: ScalingResult[] = [];
  for (const [key, records] of grouped) {
    const [module, pattern] = key.split('::') as [string, 'leaky' | 'proper'];
    const sorted = records.sort((a, b) => a.n - b.n);

    const leakRates = sorted.map(r => ({ n: r.n, leakRate: r.leakRateMedian }));
    const memGrowths = sorted.map(r => ({ n: r.n, memGrowth: r.memGrowthMedian }));

    const ns = sorted.map(r => r.n);
    const lrs = sorted.map(r => r.leakRateMedian);
    const mgs = sorted.map(r => r.memGrowthMedian);

    const leakRateFit = linearRegression(ns, lrs);
    const memGrowthFit = linearRegression(ns, mgs);

    // Use the median leak rate across all n values for projection
    const medianLeakRate = median(lrs);
    const projections = computeProjections(medianLeakRate, module);

    results.push({ module, pattern, leakRates, memGrowths, leakRateFit, memGrowthFit, projections });
  }

  return results;
}

// CLI entry: reads the latest summary file and fits scaling curves
if (require.main === module) {
  const summaryFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('summary-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (summaryFiles.length === 0) {
    console.error('No summary files found in results/. Run bench:all first.');
    process.exit(1);
  }

  const latestFile = path.join(RESULTS_DIR, summaryFiles[0]);
  console.log(`Reading ${latestFile}...`);
  const summaries: LeakSummary[] = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

  const results = fitScaling(summaries);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(RESULTS_DIR, `scaling-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log(`Scaling results: ${outFile}\n`);

  for (const r of results) {
    console.log(`[${r.module}] ${r.pattern}`);
    console.log(`  Leak rate fit: y = ${r.leakRateFit.a.toFixed(4)} + ${r.leakRateFit.b.toFixed(6)}*n  (R²=${r.leakRateFit.rSquared.toFixed(3)})`);
    console.log(`  Mem growth fit: y = ${r.memGrowthFit.a.toFixed(0)} + ${r.memGrowthFit.b.toFixed(2)}*n  (R²=${r.memGrowthFit.rSquared.toFixed(3)})`);
    if (r.pattern === 'leaky' && r.projections.length > 0) {
      console.log('  Production TTF projections:');
      for (const p of r.projections) {
        console.log(`    ${p.label}: ${p.ttfHuman}`);
      }
    }
    console.log();
  }
}
