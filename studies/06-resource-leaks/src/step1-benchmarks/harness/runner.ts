import { performance } from 'perf_hooks';
import { LeakBenchmarkModule, LeakTrialRecord, LeakSummary, LeakComparison } from './types';
import { mean, median, stddev, cv, linearRegression, welchTTest, cohensD } from './stats';

const WARMUP = 5;
const TRIALS = 30;

/** Collect resource snapshot at current point. */
function snapshot(): { heapUsed: number; rss: number; activeHandles: number; activeRequests: number } {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    rss: mem.rss,
    activeHandles: (process as any)._getActiveHandles?.().length ?? 0,
    activeRequests: (process as any)._getActiveRequests?.().length ?? 0,
  };
}

/** Force garbage collection if --expose-gc flag is set. */
function forceGC(): void {
  if (global.gc) global.gc();
}

/** Run warmup iterations to stabilize runtime. */
async function warmup(fn: (i: number) => Promise<number>, count = WARMUP): Promise<void> {
  for (let i = 0; i < count; i++) await fn(i);
}

/**
 * Run one full trial: execute the pattern for `n` iterations, recording resource counts per iteration.
 */
async function runTrial(
  mod: LeakBenchmarkModule,
  pattern: 'leaky' | 'proper',
  n: number,
  trial: number,
): Promise<LeakTrialRecord[]> {
  const records: LeakTrialRecord[] = [];
  const fn = pattern === 'leaky' ? mod.runLeaky.bind(mod) : mod.runProper.bind(mod);

  for (let i = 0; i < n; i++) {
    const start = performance.now();
    let resourceCount: number;
    let error: string | undefined;
    try {
      resourceCount = await fn(i);
    } catch (err: any) {
      resourceCount = -1;
      error = err.code || err.message || String(err);
    }
    const iterationMs = performance.now() - start;
    const snap = snapshot();

    records.push({
      module: mod.id,
      pattern,
      n,
      trial,
      iteration: i,
      heapUsed: snap.heapUsed,
      rss: snap.rss,
      activeHandles: snap.activeHandles,
      activeRequests: snap.activeRequests,
      resourceCount,
      iterationMs,
      error,
    });

    // Stop on system error
    if (error) break;
  }

  return records;
}

/** Compute leak rate (slope of resourceCount vs iteration) from one trial's records. */
function computeLeakRate(records: LeakTrialRecord[]): number {
  const valid = records.filter(r => !r.error);
  if (valid.length < 2) return 0;
  const xs = valid.map(r => r.iteration);
  const ys = valid.map(r => r.resourceCount);
  return linearRegression(xs, ys).b;
}

/** Compute memory growth rate (slope of heapUsed vs iteration). */
function computeMemGrowth(records: LeakTrialRecord[]): number {
  const valid = records.filter(r => !r.error);
  if (valid.length < 2) return 0;
  const xs = valid.map(r => r.iteration);
  const ys = valid.map(r => r.heapUsed);
  return linearRegression(xs, ys).b;
}

/** Find the iteration at which the first error occurred, or null. */
function findTTF(records: LeakTrialRecord[]): number | null {
  const errorRecord = records.find(r => r.error);
  return errorRecord ? errorRecord.iteration : null;
}

/** Summarize 30 trials for one (module, pattern, n). */
function summarize(
  mod: string,
  pattern: 'leaky' | 'proper',
  n: number,
  allTrialRecords: LeakTrialRecord[][],
): LeakSummary {
  const leakRates = allTrialRecords.map(computeLeakRate);
  const memGrowths = allTrialRecords.map(computeMemGrowth);
  const finalResources = allTrialRecords.map(recs => {
    const valid = recs.filter(r => !r.error);
    return valid.length > 0 ? valid[valid.length - 1].resourceCount : 0;
  });
  const finalHeaps = allTrialRecords.map(recs => {
    const valid = recs.filter(r => !r.error);
    return valid.length > 0 ? valid[valid.length - 1].heapUsed : 0;
  });
  const ttfs = allTrialRecords.map(findTTF).filter((t): t is number => t !== null);
  const iterationTimes = allTrialRecords.flatMap(recs => recs.filter(r => !r.error).map(r => r.iterationMs));

  return {
    module: mod,
    pattern,
    n,
    trials: allTrialRecords.length,
    leakRateMedian: median(leakRates),
    leakRateStddev: stddev(leakRates),
    memGrowthMedian: median(memGrowths),
    memGrowthStddev: stddev(memGrowths),
    finalResourceMedian: median(finalResources),
    finalResourceStddev: stddev(finalResources),
    finalHeapMedian: median(finalHeaps),
    finalHeapStddev: stddev(finalHeaps),
    ttfMedian: ttfs.length > 0 ? median(ttfs) : null,
    ttfStddev: ttfs.length > 1 ? stddev(ttfs) : null,
    iterationMsMedian: median(iterationTimes),
    iterationMsCv: cv(iterationTimes),
  };
}

/** Compare leaky vs proper for one (module, n). */
function compare(leakySummary: LeakSummary, properSummary: LeakSummary, leakyFinals: number[], properFinals: number[]): LeakComparison {
  const { t: _, p } = welchTTest(leakyFinals, properFinals);
  const d = cohensD(leakyFinals, properFinals);

  return {
    module: leakySummary.module,
    n: leakySummary.n,
    leakyLeakRate: leakySummary.leakRateMedian,
    properLeakRate: properSummary.leakRateMedian,
    leakyMemGrowth: leakySummary.memGrowthMedian,
    properMemGrowth: properSummary.memGrowthMedian,
    leakyFinalResource: leakySummary.finalResourceMedian,
    properFinalResource: properSummary.finalResourceMedian,
    leakyTtf: leakySummary.ttfMedian,
    properTtf: properSummary.ttfMedian,
    pValue: p,
    cohensD: d,
    cleanupOverhead: properSummary.iterationMsMedian === 0
      ? 1
      : properSummary.iterationMsMedian / leakySummary.iterationMsMedian,
  };
}

/**
 * Full benchmark run for one module at one n value.
 * Protocol: setup → warmup → leaky trials → reset → warmup → proper trials → teardown.
 */
export async function runModule(
  mod: LeakBenchmarkModule,
  n: number,
  trials = TRIALS,
): Promise<{
  leakyTrials: LeakTrialRecord[][];
  properTrials: LeakTrialRecord[][];
  leakySummary: LeakSummary;
  properSummary: LeakSummary;
  comparison: LeakComparison;
}> {
  console.log(`\n  [${mod.id}] n=${n}`);

  const leakyTrialSets: LeakTrialRecord[][] = [];
  const properTrialSets: LeakTrialRecord[][] = [];

  // ---- Leaky pattern ----
  console.log(`    Running leaky pattern (${trials} trials × ${n} iterations)...`);
  for (let t = 0; t < trials; t++) {
    await mod.reset();
    forceGC();
    if (t === 0) await warmup(mod.runLeaky.bind(mod));
    const records = await runTrial(mod, 'leaky', n, t);
    leakyTrialSets.push(records);
    await mod.reset();
    forceGC();
  }

  // ---- Proper cleanup pattern ----
  console.log(`    Running proper pattern (${trials} trials × ${n} iterations)...`);
  for (let t = 0; t < trials; t++) {
    await mod.reset();
    forceGC();
    if (t === 0) await warmup(mod.runProper.bind(mod));
    const records = await runTrial(mod, 'proper', n, t);
    properTrialSets.push(records);
    await mod.reset();
    forceGC();
  }

  const leakySummary = summarize(mod.id, 'leaky', n, leakyTrialSets);
  const properSummary = summarize(mod.id, 'proper', n, properTrialSets);

  const getFinalResource = (recs: LeakTrialRecord[]) => {
    const valid = recs.filter(r => !r.error);
    return valid.length > 0 ? valid[valid.length - 1].resourceCount : 0;
  };

  const leakyFinals = leakyTrialSets.map(getFinalResource);
  const properFinals = properTrialSets.map(getFinalResource);
  const comp = compare(leakySummary, properSummary, leakyFinals, properFinals);

  console.log(`    Leak rate: ${comp.leakyLeakRate.toFixed(3)} vs ${comp.properLeakRate.toFixed(3)} resources/iter`);
  console.log(`    Mem growth: ${comp.leakyMemGrowth.toFixed(0)} vs ${comp.properMemGrowth.toFixed(0)} bytes/iter`);
  const dStr = comp.cohensD === Infinity ? '∞ (perfect separation)' : comp.cohensD.toFixed(2);
  console.log(`    Cohen's d: ${dStr}, p=${comp.pValue.toFixed(6)}`);
  if (comp.leakyTtf !== null) console.log(`    TTF (leaky): iteration ${comp.leakyTtf}`);

  return {
    leakyTrials: leakyTrialSets,
    properTrials: properTrialSets,
    leakySummary,
    properSummary,
    comparison: comp,
  };
}
