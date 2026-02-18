import { generateBm06Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm06Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm06Data(n));
  return _cache.get(n)!;
}

/**
 * BM-06 BASELINE: Chained .filter().map() — two full passes over the array.
 * An intermediate filtered array is allocated between the two passes.
 */
export function runBaseline(n: number): Array<{ id: number; doubled: number }> {
  const items = getData(n);
  return items
    .filter(item => item.active)
    .map(item => ({ id: item.id, doubled: item.value * 2 }));
}
