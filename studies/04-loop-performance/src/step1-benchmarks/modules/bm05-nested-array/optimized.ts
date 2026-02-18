import { generateBm05Data } from '../../harness/data-gen';

const _cache = new Map<number, number[][]>();

function getData(n: number): number[][] {
  if (!_cache.has(n)) _cache.set(n, generateBm05Data(n));
  return _cache.get(n)!;
}

/**
 * BM-05 OPTIMIZED: Single-pass nested for loop — eliminates forEach callback overhead.
 * Same O(n × m) work but no per-element function call dispatch cost.
 */
export function runOptimized(n: number): number {
  const matrix = getData(n);
  let sum = 0;
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    for (let c = 0; c < row.length; c++) {
      sum += row[c];
    }
  }
  return sum;
}
