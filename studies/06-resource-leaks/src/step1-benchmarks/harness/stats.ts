/** Basic descriptive statistics and hypothesis tests for leak benchmarks. */

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

export function cv(arr: number[]): number {
  const m = mean(arr);
  return m === 0 ? 0 : stddev(arr) / m;
}

export function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Linear regression: y = a + b*x.
 * Returns { a, b, rSquared }.
 */
export function linearRegression(xs: number[], ys: number[]): { a: number; b: number; rSquared: number } {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let ssXX = 0, ssXY = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }
  const b = ssXX === 0 ? 0 : ssXY / ssXX;
  const a = my - b * mx;
  const rSquared = ssXX === 0 || ssYY === 0 ? 1 : (ssXY ** 2) / (ssXX * ssYY);
  return { a, b, rSquared };
}

/**
 * Welch's t-test (two-sample, unequal variance).
 * Returns t-statistic and approximate p-value (two-tailed).
 * When variance is zero: p=0 if means differ (perfect separation), p=1 if identical.
 */
export function welchTTest(a: number[], b: number[]): { t: number; p: number } {
  const nA = a.length, nB = b.length;
  const mA = mean(a), mB = mean(b);
  const vA = a.reduce((s, x) => s + (x - mA) ** 2, 0) / (nA - 1);
  const vB = b.reduce((s, x) => s + (x - mB) ** 2, 0) / (nB - 1);
  const se = Math.sqrt(vA / nA + vB / nB);
  
  if (se === 0) {
    // Zero variance: if means differ, perfect separation (p=0); otherwise identical (p=1)
    return mA !== mB ? { t: Infinity, p: 0 } : { t: 0, p: 1 };
  }
  
  const t = (mA - mB) / se;
  const df = (vA / nA + vB / nB) ** 2 /
    ((vA / nA) ** 2 / (nA - 1) + (vB / nB) ** 2 / (nB - 1));
  const p = tDistPValue(Math.abs(t), df) * 2;
  return { t, p: Math.min(p, 1) };
}

/**
 * Cohen's d effect size (pooled standard deviation).
 * Returns Infinity when pooled stddev is 0 but means differ (perfect separation).
 * Returns 0 when means are identical (no effect).
 */
export function cohensD(a: number[], b: number[]): number {
  const mA = mean(a), mB = mean(b);
  const nA = a.length, nB = b.length;
  const vA = a.reduce((s, x) => s + (x - mA) ** 2, 0) / (nA - 1);
  const vB = b.reduce((s, x) => s + (x - mB) ** 2, 0) / (nB - 1);
  const pooled = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  
  if (pooled === 0) {
    // Zero variance: if means differ, it's perfect separation; otherwise no effect
    return mA !== mB ? Infinity : 0;
  }
  return Math.abs(mA - mB) / pooled;
}

/** Approximate one-tailed t-distribution p-value via regularized incomplete beta. */
function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * regularizedBeta(x, df / 2, 0.5);
}

function regularizedBeta(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-14;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= maxIter; i++) {
    let m = i / 2;
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < eps) break;
  }
  return front * (f - 1);
}

function lnGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941678, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
