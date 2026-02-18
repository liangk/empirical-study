import { generateBm02Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm02Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm02Data(n));
  return _cache.get(n)!;
}

/**
 * BM-02 BASELINE: JSON.parse() is called inside the loop on every iteration,
 * re-parsing the same unchanged JSON string n times unnecessarily.
 */
export function runBaseline(n: number): unknown[] {
  const { jsonStr, keys } = getData(n);
  const results: unknown[] = [];
  for (let i = 0; i < keys.length; i++) {
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    results.push(obj[keys[i]]);
  }
  return results;
}
