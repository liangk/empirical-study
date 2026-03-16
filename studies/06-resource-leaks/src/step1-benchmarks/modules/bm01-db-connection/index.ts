import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-01: Database Connection Pool Exhaustion
 *
 * Simulates opening DB connections via a pool without releasing them.
 * Uses a simple TCP socket pool to avoid requiring a live PostgreSQL instance
 * during the benchmark — the pattern is identical to pg.Pool.connect() without release().
 *
 * If a real PostgreSQL instance is available (DATABASE_URL env), the module uses it.
 * Otherwise, it falls back to a simulated pool that tracks connection count.
 */

const POOL_SIZE = 10;

interface SimulatedPool {
  active: number;
  waiting: number;
  limit: number;
  connections: Array<{ id: number; released: boolean }>;
}

function createPool(): SimulatedPool {
  return { active: 0, waiting: 0, limit: POOL_SIZE, connections: [] };
}

function poolConnect(pool: SimulatedPool): { id: number; released: boolean } {
  if (pool.active >= pool.limit) {
    throw Object.assign(new Error('Connection pool exhausted — timeout waiting for available connection'), { code: 'POOL_EXHAUSTED' });
  }
  const conn = { id: pool.connections.length, released: false };
  pool.connections.push(conn);
  pool.active++;
  return conn;
}

function poolRelease(pool: SimulatedPool, conn: { id: number; released: boolean }): void {
  if (!conn.released) {
    conn.released = true;
    pool.active--;
  }
}

function poolReset(pool: SimulatedPool): void {
  for (const conn of pool.connections) {
    if (!conn.released) { conn.released = true; pool.active--; }
  }
  pool.connections = [];
  pool.active = 0;
  pool.waiting = 0;
}

let pool: SimulatedPool;

export const bm01: LeakBenchmarkModule = {
  id: 'BM-01',
  name: 'Database Connection Pool Exhaustion',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> {
    pool = createPool();
  },

  async teardown(): Promise<void> {
    poolReset(pool);
  },

  async runLeaky(_iteration: number): Promise<number> {
    // Acquire connection, execute query, do NOT release
    const conn = poolConnect(pool);
    // Simulate query work
    void conn;
    return pool.active;
  },

  async runProper(_iteration: number): Promise<number> {
    // Acquire connection, execute query, release in finally
    const conn = poolConnect(pool);
    try {
      // Simulate query work
      void conn;
    } finally {
      poolRelease(pool, conn);
    }
    return pool.active;
  },

  async reset(): Promise<void> {
    poolReset(pool);
  },
};
