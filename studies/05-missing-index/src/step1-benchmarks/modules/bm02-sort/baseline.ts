import { getClient } from '../../harness/db';
import { timeQuery } from '../../harness/runner';
import { BenchmarkModule } from '../../harness/types';

const INDEX_NAME = 'idx_bm02_createdat';

export const bm02: BenchmarkModule = {
  id: 'BM-02',
  name: 'Sorted Range Query — Unindexed ORDER BY',
  nValues: [1_000, 10_000, 100_000, 1_000_000],

  async runBaseline(_n: number): Promise<number> {
    const db = getClient();
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders ORDER BY "createdAt" DESC LIMIT 20`
    );
  },

  async runOptimized(_n: number): Promise<number> {
    const db = getClient();
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders ORDER BY "createdAt" DESC LIMIT 20`
    );
  },

  async createIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON bench_orders("createdAt" DESC)`);
  },

  async dropIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
  },

  async verify(_n: number): Promise<boolean> {
    const db = getClient();
    const base = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders ORDER BY "createdAt" DESC LIMIT 20`;
    await this.createIndex();
    const opt = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders ORDER BY "createdAt" DESC LIMIT 20`;
    await this.dropIndex();
    return JSON.stringify(base) === JSON.stringify(opt);
  },

  async explainPlanType(_n: number): Promise<string> {
    const db = getClient();
    const result = await db.$queryRaw<any[]>`
      EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM bench_orders ORDER BY "createdAt" DESC LIMIT 20
    `;
    const plan = result[0]['QUERY PLAN'][0];
    return plan?.Plan?.['Node Type'] ?? 'Unknown';
  },
};
