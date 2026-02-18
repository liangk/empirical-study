import { generateBm01Data } from '../../harness/data-gen';

const _cache = new Map<number, string[]>();

function getData(n: number): string[] {
  if (!_cache.has(n)) _cache.set(n, generateBm01Data(n));
  return _cache.get(n)!;
}

/** Hoisted regex constant — compiled once, reused for every n iterations. */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * BM-01 OPTIMIZED: Regex is hoisted outside the loop.
 * The compiled RegExp object is reused across all iterations.
 */
export function runOptimized(n: number): number {
  const items = getData(n);
  let matches = 0;
  for (let i = 0; i < items.length; i++) {
    if (DATE_REGEX.test(items[i])) matches++;
  }
  return matches;
}
