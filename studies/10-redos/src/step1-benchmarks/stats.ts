// Statistical analysis utilities for Study 10

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sqDiffs = values.map(v => Math.pow(v - m, 2));
  return Math.sqrt(sqDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

export function cv(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stddev(values) / m;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export interface StatsResult {
  mean: number;
  median: number;
  stddev: number;
  cv: number;
  p5: number;
  p95: number;
}

export function stats(values: number[]): StatsResult {
  return {
    mean: mean(values),
    median: median(values),
    stddev: stddev(values),
    cv: cv(values),
    p5: percentile(values, 5),
    p95: percentile(values, 95),
  };
}