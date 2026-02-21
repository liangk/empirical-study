export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function stddev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function cv(values: number[]): number {
  const m = mean(values);
  return m === 0 ? 0 : stddev(values) / m;
}

/**
 * Welch's independent two-sample t-test (two-sided).
 * Returns { tStatistic, pValue }.
 */
export function welchTTest(a: number[], b: number[]): { tStatistic: number; pValue: number } {
  const ma = mean(a), mb = mean(b);
  const sa = stddev(a), sb = stddev(b);
  const na = a.length, nb = b.length;
  const se = Math.sqrt((sa ** 2) / na + (sb ** 2) / nb);
  if (se === 0) return { tStatistic: 0, pValue: 1 };
  const t = (ma - mb) / se;
  const df = (((sa ** 2) / na + (sb ** 2) / nb) ** 2) /
    (((sa ** 2) / na) ** 2 / (na - 1) + ((sb ** 2) / nb) ** 2 / (nb - 1));
  const p = tDistPValue(Math.abs(t), df) * 2;
  return { tStatistic: t, pValue: p };
}

function tDistPValue(t: number, df: number): number {
  // Approximation via regularized incomplete beta function
  const x = df / (df + t * t);
  return 0.5 * betaInc(df / 2, 0.5, x);
}

function betaInc(a: number, b: number, x: number): number {
  // Continued fraction approximation (Lentz's method, abridged)
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  if (x < (a + 1) / (a + b + 2)) return Math.exp(lbeta) * cf(a, b, x) / a;
  return 1 - Math.exp(lbeta) * cf(b, a, 1 - x) / b;
}

function cf(a: number, b: number, x: number): number {
  const maxIter = 200, eps = 1e-10;
  let h = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d; h = d;
  for (let m = 1; m <= maxIter; m++) {
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }
  return h;
}

function lgamma(x: number): number {
  // Stirling's approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export function cohensD(a: number[], b: number[]): number {
  const ma = mean(a), mb = mean(b);
  const sa = stddev(a), sb = stddev(b);
  const pooled = Math.sqrt((sa ** 2 + sb ** 2) / 2);
  return pooled === 0 ? 0 : Math.abs(ma - mb) / pooled;
}

export function summarize(module: string, pattern: 'baseline' | 'optimized', n: number, trials: number[]): import('./types').BenchmarkSummary {
  return {
    module, pattern, n,
    trials: trials.length,
    mean: mean(trials),
    median: median(trials),
    stddev: stddev(trials),
    p05: percentile(trials, 5),
    p95: percentile(trials, 95),
    cv: cv(trials),
  };
}
