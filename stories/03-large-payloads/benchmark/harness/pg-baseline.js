/**
 * The same read without Prisma: SELECT every column of "users" through node-pg
 * on the unix socket, to separate what PostgreSQL and the driver cost from what
 * the ORM's row mapping costs in bench.ts.
 *
 *   SIZES=1000,10000,50000 node pg-baseline.js
 */
const { Client } = require('pg');
const { execFileSync } = require('child_process');
const { writeFileSync } = require('fs');

const sizes = (process.env.SIZES || '1000,10000,50000').split(',').map(Number);
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

(async () => {
  const c = new Client({ host: '/tmp', port: 5433, user: 'postgres', database: 'calbench' });
  await c.connect();
  const out = { label: 'pg-baseline', node: process.version, runs: [] };
  for (const n of sizes) {
    execFileSync('psql', ['-h', '/tmp', '-p', '5433', '-U', 'postgres', '-d', 'calbench', '-q', '-v', `n=${n}`, '-f', `${__dirname}/prisma/seed.sql`], { stdio: 'ignore' });
    const times = [];
    for (let i = 0; i < 9; i++) {
      const t = process.hrtime.bigint();
      const r = await c.query('SELECT * FROM "users"');
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (r.rows.length !== n) throw new Error('row count');
      if (i >= 2) times.push(ms);
    }
    out.runs.push({ size: n, queryMs: median(times), samples: times });
    console.log(`pg n=${n} query=${median(times).toFixed(1)}ms`);
  }
  writeFileSync(`${__dirname}/../results/pg-baseline.json`, JSON.stringify(out, null, 1));
  await c.end();
})();
