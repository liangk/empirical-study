import { getClient } from '../../harness/db';
import { pickTargetUserId } from '../../harness/data-gen';
import { timeQuery } from '../../harness/runner';
import { BenchmarkModule } from '../../harness/types';

const INDEX_NAME = 'idx_bm03_userid';

export const bm03: BenchmarkModule = {
  id: 'BM-03',
  name: 'Unindexed FK Scan — Prisma Default',
  nValues: [1_000, 10_000, 100_000, 1_000_000],

  async runBaseline(n: number): Promise<number> {
    const db = getClient();
    const userId = pickTargetUserId(Math.ceil(n / 10));
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders WHERE "userId" = ${userId}`
    );
  },

  async runOptimized(n: number): Promise<number> {
    const db = getClient();
    const userId = pickTargetUserId(Math.ceil(n / 10));
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders WHERE "userId" = ${userId}`
    );
  },

  async createIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON bench_orders("userId")`);
  },

  async dropIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
  },

  async verify(n: number): Promise<boolean> {
    const db = getClient();
    const userId = pickTargetUserId(Math.ceil(n / 10));
    const base = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders WHERE "userId" = ${userId} ORDER BY id`;
    await this.createIndex();
    const opt = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders WHERE "userId" = ${userId} ORDER BY id`;
    await this.dropIndex();
    return JSON.stringify(base) === JSON.stringify(opt);
  },

  async explainPlanType(n: number): Promise<string> {
    const db = getClient();
    const userId = pickTargetUserId(Math.ceil(n / 10));
    const result = await db.$queryRaw<any[]>`
      EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM bench_orders WHERE "userId" = ${userId}
    `;
    const plan = result[0]['QUERY PLAN'][0];
    return plan?.Plan?.['Node Type'] ?? 'Unknown';
  },
};
