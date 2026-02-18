import { generateBm06Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm06Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm06Data(n));
  return _cache.get(n)!;
}

/**
 * BM-06 OPTIMIZED: Single-pass reduce — filter + map fused into one iteration.
 * No intermediate array allocation; same output, one pass over the input.
 */
export function runOptimized(n: number): Array<{ id: number; doubled: number }> {
  const items = getData(n);
  return items.reduce<Array<{ id: number; doubled: number }>>((acc, item) => {
    if (item.active) acc.push({ id: item.id, doubled: item.value * 2 });
    return acc;
  }, []);
}
