import { generateBm05Data } from '../../harness/data-gen';

const _cache = new Map<number, number[][]>();

function getData(n: number): number[][] {
  if (!_cache.has(n)) _cache.set(n, generateBm05Data(n));
  return _cache.get(n)!;
}

/**
 * BM-05 BASELINE: Nested forEach calls — inner forEach runs for every outer iteration.
 * Function call overhead is O(n × m) where m = min(n, 100).
 */
export function runBaseline(n: number): number {
  const matrix = getData(n);
  let sum = 0;
  matrix.forEach(row => {
    row.forEach(val => {
      sum += val;
    });
  });
  return sum;
}

/**
 * BM-05 BASELINE-A: Nested for...of loops — iterator protocol overhead vs. index-based for loop.
 * Eliminates forEach callback dispatch but still pays iterator allocation per row.
 */
export function runBaselineA(n: number): number {
  const matrix = getData(n);
  let sum = 0;
  for (const row of matrix) {
    for (const val of row) {
      sum += val;
    }
  }
  return sum;
}
