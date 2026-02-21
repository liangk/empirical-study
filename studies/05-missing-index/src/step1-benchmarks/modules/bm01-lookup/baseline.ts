import { getClient } from '../../harness/db';
import { pickTargetEmail } from '../../harness/data-gen';
import { timeQuery } from '../../harness/runner';
import { BenchmarkModule } from '../../harness/types';

const INDEX_NAME = 'idx_bm01_email';

export const bm01: BenchmarkModule = {
  id: 'BM-01',
  name: 'Point Lookup — Unindexed Column',
  nValues: [1_000, 10_000, 100_000, 1_000_000],

  async runBaseline(n: number): Promise<number> {
    const db = getClient();
    const email = pickTargetEmail(n);
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_users WHERE email = ${email} LIMIT 1`
    );
  },

  async runOptimized(n: number): Promise<number> {
    const db = getClient();
    const email = pickTargetEmail(n);
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_users WHERE email = ${email} LIMIT 1`
    );
  },

  async createIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON bench_users(email)`);
  },

  async dropIndex(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
  },

  async verify(n: number): Promise<boolean> {
    const db = getClient();
    const email = pickTargetEmail(n);
    const base = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_users WHERE email = ${email} LIMIT 1`;
    await this.createIndex();
    const opt = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_users WHERE email = ${email} LIMIT 1`;
    await this.dropIndex();
    return JSON.stringify(base) === JSON.stringify(opt);
  },

  async explainPlanType(n: number): Promise<string> {
    const db = getClient();
    const email = pickTargetEmail(n);
    const result = await db.$queryRaw<{ 'QUERY PLAN': object[] }[]>`
      EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM bench_users WHERE email = ${email} LIMIT 1
    `;
    const plan = (result[0] as any)['QUERY PLAN'][0];
    return plan?.Plan?.['Node Type'] ?? 'Unknown';
  },
};
