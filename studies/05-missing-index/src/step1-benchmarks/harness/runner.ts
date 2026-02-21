import { performance } from 'perf_hooks';
import { BenchmarkModule, DbTrialRecord, BenchmarkSummary, ComparisonResult } from './types';
import { summarize, median, welchTTest, cohensD } from './stats';
import { getClient } from './db';

const TRIALS = 30;
const WARMUP = 5;
const CV_THRESHOLD = 0.15;

/**
 * Time a single query execution in milliseconds.
 */
export async function timeQuery(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/**
 * Run warmup iterations (populates PostgreSQL shared buffer pool, not JIT warmup).
 */
async function warmup(fn: () => Promise<unknown>, count = WARMUP): Promise<void> {
  for (let i = 0; i < count; i++) await fn();
}

/**
 * Run VACUUM ANALYZE on bench tables to ensure up-to-date planner statistics.
 */
export async function vacuumAnalyze(): Promise<void> {
  const db = getClient();
  await db.$executeRawUnsafe('VACUUM ANALYZE bench_users, bench_orders');
}

/**
 * Full benchmark run for one module at one n value.
 * Protocol: warmup → baseline trials → create index → warmup → optimized trials → drop index.
 */
export async function runModule(
  mod: BenchmarkModule,
  n: number,
  trials = TRIALS,
): Promise<{
  baselineTrials: DbTrialRecord[];
  optimizedTrials: DbTrialRecord[];
  baselineSummary: BenchmarkSummary;
  optimizedSummary: BenchmarkSummary;
  comparison: ComparisonResult;
}> {
  console.log(`\n  [${mod.id}] n=${n.toLocaleString()}`);

  // Ensure no stale index exists from a previous failed run
  try { await mod.dropIndex(); } catch { /* ok — index didn't exist */ }

  // ---- Baseline (no index, or specific baseline index for BM-04/05) ----
  if (mod.setupBaseline) {
    console.log(`    Setting up baseline state...`);
    await mod.setupBaseline();
    await vacuumAnalyze();
  }
  console.log(`    Warmup (baseline)...`);
  await warmup(() => mod.runBaseline(n));

  console.log(`    Collecting ${trials} baseline trials...`);
  const baselineMs: number[] = [];
  for (let i = 0; i < trials; i++) {
    const ms = await mod.runBaseline(n);
    baselineMs.push(ms);
    if ((i + 1) % 10 === 0) process.stdout.write(`      trial ${i + 1}/${trials}: ${ms.toFixed(2)}ms\n`);
  }

  const baselinePlanType = await mod.explainPlanType(n);
  console.log(`    Baseline plan: ${baselinePlanType}`);

  const baselineSummary = summarize(mod.id, 'baseline', n, baselineMs);
  if (baselineSummary.cv > CV_THRESHOLD) {
    console.warn(`    ⚠ CV ${(baselineSummary.cv * 100).toFixed(1)}% exceeds ${CV_THRESHOLD * 100}% threshold — results flagged`);
  }

  // ---- Create index ----
  console.log(`    Creating index...`);
  const indexStart = performance.now();
  await mod.createIndex();
  await vacuumAnalyze();
  console.log(`    Index created in ${(performance.now() - indexStart).toFixed(0)}ms`);

  // ---- Optimized (with index) ----
  console.log(`    Warmup (optimized)...`);
  await warmup(() => mod.runOptimized(n));

  console.log(`    Collecting ${trials} optimized trials...`);
  const optimizedMs: number[] = [];
  for (let i = 0; i < trials; i++) {
    const ms = await mod.runOptimized(n);
    optimizedMs.push(ms);
    if ((i + 1) % 10 === 0) process.stdout.write(`      trial ${i + 1}/${trials}: ${ms.toFixed(2)}ms\n`);
  }

  const optimizedPlanType = await mod.explainPlanType(n);
  console.log(`    Optimized plan: ${optimizedPlanType}`);

  // ---- Drop index ----
  await mod.dropIndex();

  const optimizedSummary = summarize(mod.id, 'optimized', n, optimizedMs);
  if (optimizedSummary.cv > CV_THRESHOLD) {
    console.warn(`    ⚠ CV ${(optimizedSummary.cv * 100).toFixed(1)}% exceeds ${CV_THRESHOLD * 100}% threshold`);
  }

  const speedup = baselineSummary.median / optimizedSummary.median;
  const { tStatistic, pValue } = welchTTest(baselineMs, optimizedMs);
  const d = cohensD(baselineMs, optimizedMs);

  console.log(`    Speedup: ${speedup.toFixed(2)}× | p=${pValue.toFixed(4)} | d=${d.toFixed(2)}`);

  const baselineTrials: DbTrialRecord[] = baselineMs.map((ms, i) => ({
    module: mod.id, pattern: 'baseline', n, trial: i, wallTimeMs: ms,
    planType: i === 0 ? baselinePlanType : undefined,
  }));
  const optimizedTrials: DbTrialRecord[] = optimizedMs.map((ms, i) => ({
    module: mod.id, pattern: 'optimized', n, trial: i, wallTimeMs: ms,
    planType: i === 0 ? optimizedPlanType : undefined,
  }));

  const comparison: ComparisonResult = {
    module: mod.id, n,
    baselineMedian: baselineSummary.median,
    optimizedMedian: optimizedSummary.median,
    speedup, tStatistic, pValue,
    cohensD: d,
    baselinePlanType,
    optimizedPlanType,
  };

  return { baselineTrials, optimizedTrials, baselineSummary, optimizedSummary, comparison };
}
