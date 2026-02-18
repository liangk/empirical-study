import { generateBm01Data } from '../../harness/data-gen';

const _cache = new Map<number, string[]>();

function getData(n: number): string[] {
  if (!_cache.has(n)) _cache.set(n, generateBm01Data(n));
  return _cache.get(n)!;
}

/**
 * BM-01 BASELINE: Regex is compiled inside the loop on every iteration.
 * Anti-pattern: new RegExp / regex literal inside loop body.
 */
export function runBaseline(n: number): number {
  const items = getData(n);
  let matches = 0;
  for (let i = 0; i < items.length; i++) {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(items[i]);
    if (match) matches++;
  }
  return matches;
}
