/**
 * What an unbounded list endpoint costs: a measured benchmark.
 *
 * The workload is cal.com's admin user list, a true positive of
 * payload/api-response (packages/trpc/server/routers/viewer/users/_router.ts):
 *
 *     list: authedAdminProcedure.query(async ({ ctx }) => {
 *       const { prisma } = ctx;
 *       // TODO: Add search, pagination, etc.
 *       const users = await prisma.user.findMany();
 *       return users;
 *     }),
 *
 * Same stack as cal.com at the pinned commit: Prisma 6.16.1 generated from
 * cal.com's own schema.prisma (engineType "client", @prisma/adapter-pg),
 * PostgreSQL 16, and superjson 1.9.1, the transformer cal.com's tRPC uses to
 * put the result on the wire.
 *
 * Two strategies against the same table:
 *
 *   as-found     prisma.user.findMany()              every row, every column
 *   suggested    prisma.user.findMany({ take: 100 }) what the generator writes
 *
 * Each run measures, separately: the query (Prisma, including mapping rows to
 * objects), serialising the result with superjson as tRPC does, the bytes that
 * would go over the wire (and gzipped), and the client parsing them back.
 * heapDeltaMB is heap growth across the request with the GC forced before it:
 * what the request allocated, retained or not, not a leak.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import superjson from 'superjson';
import { writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { gzipSync } from 'zlib';
import { PrismaClient } from './prisma/generated/prisma/client';

const cfg = {
  host: process.env.PG_HOST || '/tmp',
  port: parseInt(process.env.PG_PORT || '5433', 10),
  seedPort: parseInt(process.env.SEED_PORT || '5433', 10),
  sizes: (process.env.SIZES || '1000,10000,100000').split(',').map(Number),
  repeats: parseInt(process.env.REPEATS || '7', 10),
  warmups: parseInt(process.env.WARMUPS || '2', 10),
  label: process.env.LABEL || 'local-socket',
};

const ms = (a: bigint, b: bigint) => Number(b - a) / 1e6;
const gc = () => { (global as any).gc?.(); (global as any).gc?.(); };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

function seed(n: number) {
  execFileSync('psql', ['-h', '/tmp', '-p', String(cfg.seedPort), '-U', 'postgres', '-d', 'calbench', '-q', '-v', `n=${n}`, '-f', `${__dirname}/prisma/seed.sql`], { stdio: 'ignore' });
}

async function main() {
  if (!(global as any).gc) throw new Error('run with node --expose-gc');
  const connectionString = `postgresql://postgres@localhost:${cfg.port}/calbench?host=${encodeURIComponent(cfg.host)}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  await prisma.$queryRawUnsafe('SELECT 1');

  const strategies = {
    'as-found': () => prisma.user.findMany(),
    suggested: () => prisma.user.findMany({ take: 100 }),
  };

  const out: any = { label: cfg.label, node: process.version, config: cfg, runs: [] };
  for (const size of cfg.sizes) {
    seed(size);
    for (const [name, run] of Object.entries(strategies)) {
      const samples: any[] = [];
      for (let i = 0; i < cfg.warmups + cfg.repeats; i++) {
        gc();
        const heap0 = process.memoryUsage().heapUsed;
        const t0 = process.hrtime.bigint();
        const rows = await run();
        const t1 = process.hrtime.bigint();
        const wire = superjson.stringify(rows);
        const t2 = process.hrtime.bigint();
        const heap1 = process.memoryUsage().heapUsed;
        const parsed = superjson.parse<any[]>(wire);
        const t3 = process.hrtime.bigint();
        if (parsed.length !== rows.length) throw new Error('round trip lost rows');
        if (i >= cfg.warmups) {
          samples.push({
            rows: rows.length,
            bytes: Buffer.byteLength(wire),
            gzipBytes: gzipSync(wire).length,
            queryMs: ms(t0, t1),
            serializeMs: ms(t1, t2),
            parseMs: ms(t2, t3),
            serverMs: ms(t0, t2),
            heapDeltaMB: (heap1 - heap0) / 1048576,
          });
        }
      }
      const m = (k: string) => median(samples.map(s => s[k]));
      const row = {
        size, strategy: name, rows: samples[0].rows, bytes: samples[0].bytes, gzipBytes: samples[0].gzipBytes,
        queryMs: m('queryMs'), serializeMs: m('serializeMs'), parseMs: m('parseMs'),
        serverMs: m('serverMs'), heapDeltaMB: m('heapDeltaMB'), samples,
      };
      out.runs.push(row);
      console.log(`${cfg.label} n=${size} ${name.padEnd(9)} rows=${row.rows} ${(row.bytes / 1024).toFixed(0)}KB query=${row.queryMs.toFixed(1)}ms serialize=${row.serializeMs.toFixed(1)}ms parse=${row.parseMs.toFixed(1)}ms heap=${row.heapDeltaMB.toFixed(1)}MB`);
    }
  }
  mkdirSync(`${__dirname}/../results`, { recursive: true });
  writeFileSync(`${__dirname}/../results/${cfg.label}.json`, JSON.stringify(out, null, 1));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
