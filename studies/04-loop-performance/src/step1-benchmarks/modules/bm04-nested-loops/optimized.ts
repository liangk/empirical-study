import { generateBm04Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm04Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm04Data(n));
  return _cache.get(n)!;
}

/**
 * BM-04 OPTIMIZED: O(n) — pre-build a Map keyed by userId before the outer loop.
 * Each outer-loop iteration does an O(1) Map.get() lookup instead of a linear scan.
 *
 * Note: To strictly match the Baseline's "find first match" behavior (which uses `break`),
 * we only set the map entry if the key doesn't exist yet. Standard `new Map()` would overwrite
 * and keep the last match.
 */
export function runOptimized(n: number): Array<{ userId: number; amount: number } | null> {
  const { users, orders } = getData(n);
  
  const orderMap = new Map<number, { userId: number; amount: number }>();
  for (const o of orders) {
    if (!orderMap.has(o.userId)) {
      orderMap.set(o.userId, o);
    }
  }

  const results: Array<{ userId: number; amount: number } | null> = [];
  for (const user of users) {
    results.push(orderMap.get(user.id) ?? null);
  }
  return results;
}
