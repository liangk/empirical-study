import { getClient } from '../../harness/db';
import { timeQuery } from '../../harness/runner';
import { BenchmarkModule } from '../../harness/types';

const INDEX_BASELINE = 'idx_bm05_base';
const INDEX_OPTIMIZED = 'idx_bm05_opt';
const STATUS = 'active';

export const bm05: BenchmarkModule = {
  id: 'BM-05',
  name: 'Covering Index — Eliminate Heap Fetch',
  nValues: [1_000, 10_000, 100_000, 1_000_000],

  async runBaseline(_n: number): Promise<number> {
    const db = getClient();
    return timeQuery(() =>
      db.$queryRaw`SELECT id, email FROM bench_users WHERE status = ${STATUS}`
    );
  },

  async runOptimized(_n: number): Promise<number> {
    const db = getClient();
    return timeQuery(() =>
      db.$queryRaw`SELECT id, email FROM bench_users WHERE status = ${STATUS}`
    );
  },

  async createIndex(): Promise<void> {
    // Optimized = covering index: stores email in the index leaf (no heap fetch)
    // Requires PostgreSQL 11+ for INCLUDE syntax
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_BASELINE}`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_OPTIMIZED} ON bench_users(status) INCLUDE (email)`);
  },

  async dropIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_OPTIMIZED}`);
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_BASELINE}`);
  },

  async setupBaseline(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_OPTIMIZED}`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_BASELINE} ON bench_users(status)`);
  },

  async verify(_n: number): Promise<boolean> {
    const db = getClient();
    const base = await db.$queryRaw<{ id: number; email: string }[]>`
      SELECT id, email FROM bench_users WHERE status = ${STATUS} ORDER BY id LIMIT 100
    `;
    await this.createIndex();
    const opt = await db.$queryRaw<{ id: number; email: string }[]>`
      SELECT id, email FROM bench_users WHERE status = ${STATUS} ORDER BY id LIMIT 100
    `;
    await this.dropIndex();
    return JSON.stringify(base) === JSON.stringify(opt);
  },

  async explainPlanType(_n: number): Promise<string> {
    const db = getClient();
    const result = await db.$queryRaw<any[]>`
      EXPLAIN (ANALYZE, FORMAT JSON) SELECT id, email FROM bench_users WHERE status = ${STATUS}
    `;
    const plan = result[0]['QUERY PLAN'][0];
    return plan?.Plan?.['Node Type'] ?? 'Unknown';
  },
};
