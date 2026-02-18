import { generateBm04Data } from '../../harness/data-gen';

const _cache = new Map<number, ReturnType<typeof generateBm04Data>>();

function getData(n: number) {
  if (!_cache.has(n)) _cache.set(n, generateBm04Data(n));
  return _cache.get(n)!;
}

/**
 * BM-04 BASELINE: O(n²) — for each user, scan the entire orders array linearly.
 * Total comparisons = n_users × n_orders.
 */
export function runBaseline(n: number): Array<{ userId: number; amount: number } | null> {
  const { users, orders } = getData(n);
  const results: Array<{ userId: number; amount: number } | null> = [];
  for (const user of users) {
    let found: { userId: number; amount: number } | null = null;
    for (const order of orders) {
      if (order.userId === user.id) {
        found = order;
        break;
      }
    }
    results.push(found);
  }
  return results;
}
