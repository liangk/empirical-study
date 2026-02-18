import { generateBm02Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm02Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm02Data(n));
  return _cache.get(n)!;
}

/**
 * BM-02 OPTIMIZED: JSON.parse() is called once before the loop.
 * The parsed object is reused for all n key lookups.
 */
export function runOptimized(n: number): unknown[] {
  const { jsonStr, keys } = getData(n);
  const obj = JSON.parse(jsonStr) as Record<string, unknown>;
  const results: unknown[] = [];
  for (let i = 0; i < keys.length; i++) {
    results.push(obj[keys[i]]);
  }
  return results;
}
