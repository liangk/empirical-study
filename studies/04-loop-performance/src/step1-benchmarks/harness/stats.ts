import type { BenchmarkSummary, ComparisonResult, EffectSize, Pattern, TrialRecord } from './types';

const NS_TO_MS = 1 / 1e6;

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function stddev(xs: number[], xMean?: number): number {
  const m = xMean ?? mean(xs);
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1));
}

export function percentile(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Paired t-test for two equal-length arrays of observations.
 * Returns { tStatistic, pValue } (two-tailed).
 */
export function pairedTTest(a: number[], b: number[]): { tStatistic: number; pValue: number } {
  if (a.length !== b.length || a.length < 2) return { tStatistic: 0, pValue: 1 };
  const diffs = a.map((ai, i) => ai - b[i]);
  const dMean = mean(diffs);
  const dStd = stddev(diffs, dMean);
  const n = diffs.length;
  const tStatistic = dMean / (dStd / Math.sqrt(n));
  const pValue = tDistPValue(Math.abs(tStatistic), n - 1);
  return { tStatistic, pValue };
}

/**
 * Cohen's d for two independent samples.
 */
export function cohensD(a: number[], b: number[]): number {
  const mA = mean(a);
  const mB = mean(b);
  const sA = stddev(a, mA);
  const sB = stddev(b, mB);
  const pooled = Math.sqrt((sA ** 2 + sB ** 2) / 2);
  return pooled === 0 ? 0 : (mA - mB) / pooled;
}

export function effectSizeLabel(d: number): EffectSize {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}

/**
 * Two-tailed p-value from t-distribution using Abramowitz & Stegun approximation.
 * Accurate to ~1e-5 for df >= 2.
 */
function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  return front * betaCF(x, a, b);
}

function betaCF(x: number, a: number, b: number): number {
  const MAXIT = 200;
  const EPS = 3e-7;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    let m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export function summarize(
  trials: TrialRecord[],
  moduleId: string,
  pattern: Pattern,
  n: number,
  environment: string,
): BenchmarkSummary {
  const walls = trials.map(t => t.wallTimeNs * NS_TO_MS);
  const heapDeltas = trials.map(t => t.heapAfterBytes - t.heapBeforeBytes);
  const cpus = trials.map(t => t.cpuTimeMs);
  const m = mean(walls);
  const sd = stddev(walls, m);
  const cv = sd / m * 100;
  const min = Math.min(...walls);
  const max = Math.max(...walls);
  return {
    moduleId, pattern, environment, n,
    trials: trials.length,
    meanWallMs: m,
    medianWallMs: median(walls),
    stddevWallMs: sd,
    p05WallMs: percentile(walls, 5),
    p25WallMs: percentile(walls, 25),
    p75WallMs: percentile(walls, 75),
    p95WallMs: percentile(walls, 95),
    cvPct: cv,
    minWallMs: min,
    maxWallMs: max,
    meanHeapDeltaBytes: mean(heapDeltas),
    peakHeapDeltaBytes: Math.max(...heapDeltas),
    meanCpuTimeMs: mean(cpus),
    flaggedHighCV: cv > 10,
    flaggedOutlier: max / min > 3,
  };
}

export function compare(
  base: BenchmarkSummary,
  opt: BenchmarkSummary,
  baseTrials: TrialRecord[],
  optTrials: TrialRecord[],
  hypothesisFn?: (speedup: number) => boolean,
): ComparisonResult {
  const baseWalls = baseTrials.map(t => t.wallTimeNs * NS_TO_MS);
  const optWalls = optTrials.map(t => t.wallTimeNs * NS_TO_MS);
  const speedupRatio = base.meanWallMs / opt.meanWallMs;
  const improvementPct = ((base.meanWallMs - opt.meanWallMs) / base.meanWallMs) * 100;
  const memBase = base.meanHeapDeltaBytes;
  const memOpt = opt.meanHeapDeltaBytes;
  const memoryReductionRatio = memOpt !== 0 ? memBase / memOpt : null;
  const { tStatistic, pValue } = pairedTTest(baseWalls, optWalls);
  const d = cohensD(baseWalls, optWalls);
  return {
    moduleId: base.moduleId,
    n: base.n,
    environment: base.environment,
    speedupRatio,
    improvementPct,
    memoryReductionRatio,
    tStatistic,
    pValue,
    cohensD: d,
    effectSize: effectSizeLabel(d),
    significant: pValue < 0.05,
    hypothesisMet: hypothesisFn ? hypothesisFn(speedupRatio) : null,
    anomaly: speedupRatio < 1.0,
  };
}
