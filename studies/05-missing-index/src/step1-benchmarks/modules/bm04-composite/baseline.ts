import { getClient } from '../../harness/db';
import { rangeQueryCutoff } from '../../harness/data-gen';
import { timeQuery } from '../../harness/runner';
import { BenchmarkModule } from '../../harness/types';

const INDEX_BASELINE = 'idx_bm04_base';
const INDEX_OPTIMIZED = 'idx_bm04_opt';
const STATUS = 'active';

export const bm04: BenchmarkModule = {
  id: 'BM-04',
  name: 'Composite Filter — Single-Column vs. Composite Index',
  nValues: [1_000, 10_000, 100_000, 1_000_000],

  async runBaseline(_n: number): Promise<number> {
    const db = getClient();
    const cutoff = rangeQueryCutoff();
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders WHERE status = ${STATUS} AND "createdAt" > ${cutoff}`
    );
  },

  async runOptimized(_n: number): Promise<number> {
    const db = getClient();
    const cutoff = rangeQueryCutoff();
    return timeQuery(() =>
      db.$queryRaw`SELECT * FROM bench_orders WHERE status = ${STATUS} AND "createdAt" > ${cutoff}`
    );
  },

  async createIndex(): Promise<void> {
    // "Optimized" = composite index on (status, "createdAt")
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_BASELINE}`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_OPTIMIZED} ON bench_orders(status, "createdAt")`);
  },

  async dropIndex(): Promise<void> {
    // Restore to baseline state: single-column index on status only
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_OPTIMIZED}`);
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_BASELINE}`);
  },

  /**
   * BM-04 baseline starts with a single-column index on status already present.
   * The runner must call this before collecting baseline trials.
   */
  async setupBaseline(): Promise<void> {
    const db = getClient();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX_OPTIMIZED}`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${INDEX_BASELINE} ON bench_orders(status)`);
  },

  async verify(_n: number): Promise<boolean> {
    const db = getClient();
    const cutoff = rangeQueryCutoff();
    const base = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders WHERE status = ${STATUS} AND "createdAt" > ${cutoff} ORDER BY id`;
    await this.createIndex();
    const opt = await db.$queryRaw<{ id: number }[]>`SELECT id FROM bench_orders WHERE status = ${STATUS} AND "createdAt" > ${cutoff} ORDER BY id`;
    await this.dropIndex();
    return JSON.stringify(base) === JSON.stringify(opt);
  },

  async explainPlanType(_n: number): Promise<string> {
    const db = getClient();
    const cutoff = rangeQueryCutoff();
    const result = await db.$queryRaw<any[]>`
      EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM bench_orders WHERE status = ${STATUS} AND "createdAt" > ${cutoff}
    `;
    const plan = result[0]['QUERY PLAN'][0];
    return plan?.Plan?.['Node Type'] ?? 'Unknown';
  },
};
