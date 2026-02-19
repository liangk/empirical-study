/** Mulberry32 seeded PRNG — fast, deterministic, no external deps. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** BM-01: Array of n strings — 80% date-like, 20% random alphanumeric. */
export function generateBm01Data(n: number): string[] {
  const rand = mulberry32(0xbeef01);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    if (rand() < 0.8) {
      const y = 2000 + Math.floor(rand() * 24);
      const m = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
      const d = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
      result.push(`${y}-${m}-${d}`);
    } else {
      let s = '';
      for (let j = 0; j < 10; j++) s += chars[Math.floor(rand() * chars.length)];
      result.push(s);
    }
  }
  return result;
}

/** BM-02: A fixed JSON string + n access-key strings. */
export function generateBm02Data(n: number): { jsonStr: string; keys: string[] } {
  const rand = mulberry32(0xbeef02);
  const fields: Record<string, unknown> = {};
  const keyPool: string[] = [];
  for (let i = 0; i < 20; i++) {
    const k = `field_${i}`;
    keyPool.push(k);
    const r = rand();
    if (r < 0.4) fields[k] = Math.floor(rand() * 10000);
    else if (r < 0.7) fields[k] = `value_${Math.floor(rand() * 1000)}`;
    else if (r < 0.85) fields[k] = rand() > 0.5;
    else fields[k] = { nested: Math.floor(rand() * 100) };
  }
  const jsonStr = JSON.stringify(fields);
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push(keyPool[Math.floor(rand() * keyPool.length)]);
  return { jsonStr, keys };
}

/** BM-03: Array of n integer IDs. */
export function generateBm03Data(n: number): number[] {
  const rand = mulberry32(0xbeef03);
  return Array.from({ length: n }, (_, i) => Math.floor(rand() * n) + 1 || i + 1);
}

export interface User { id: number; name: string; }
export interface Order { userId: number; amount: number; }

/** BM-04: Two arrays of n objects joined on userId. */
export function generateBm04Data(n: number): { users: User[]; orders: Order[] } {
  const rand = mulberry32(0xbeef04);
  const users: User[] = Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `user_${i + 1}` }));
  const orders: Order[] = Array.from({ length: n }, () => ({
    userId: Math.floor(rand() * n) + 1,
    amount: Math.floor(rand() * 10000),
  }));
  return { users, orders };
}

/** BM-05: 2D array — n rows × n cols (true O(n²) cross-product). Capped at n=1000 max cols to avoid OOM at n=100000. */
export function generateBm05Data(n: number): number[][] {
  const rand = mulberry32(0xbeef05);
  const cols = Math.min(n, 1000);
  return Array.from({ length: n }, () =>
    Array.from({ length: cols }, () => Math.floor(rand() * 256)),
  );
}

export interface Item { id: number; value: number; active: boolean; }

/** BM-06: Array of n items with id, value, active fields (~50% active). */
export function generateBm06Data(n: number): Item[] {
  const rand = mulberry32(0xbeef06);
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    value: Math.floor(rand() * 1000),
    active: rand() < 0.5,
  }));
}

/** BM-07: Array of n label strings for DOM list items. */
export function generateBm07Data(n: number): string[] {
  const rand = mulberry32(0xbeef07);
  return Array.from({ length: n }, (_, i) => `Item ${i + 1} — ${Math.floor(rand() * 10000)}`);
}
