/**
 * The same workload, run as concurrent jobs against one connection pool.
 *
 * A single slow job is a latency problem. Several of them at once is a capacity
 * problem: every query in an N+1 loop holds a pooled connection for another
 * round trip, so the loop's cost is multiplied by how many jobs are running.
 * Outline fires one of these notification jobs per comment, so concurrency here
 * is not hypothetical.
 */
const { Sequelize, DataTypes, Op } = require('sequelize');

const config = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT, 10) || 5434,
  size: parseInt(process.env.SIZE, 10) || 100,
  jobs: (process.env.JOBS || '1,5,10,25').split(',').map(Number),
  repeats: parseInt(process.env.REPEATS, 10) || 5,
  poolMax: parseInt(process.env.POOL_MAX, 10) || 10,
  label: process.env.LABEL || 'concurrent',
};

const sequelize = new Sequelize('n1bench', 'postgres', '', {
  host: config.host,
  port: config.port,
  dialect: 'postgres',
  logging: false,
  pool: { max: config.poolMax, min: 1, idle: 10_000 },
});

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  locale: DataTypes.STRING,
  subscribedToMentions: DataTypes.BOOLEAN,
}, { tableName: 'users', timestamps: false });

async function n1Sequential(ids) {
  const out = [];
  for (const id of ids) {
    const r = await User.findByPk(id);
    if (r && r.subscribedToMentions) out.push(r);
  }
  return out;
}

async function batched(ids) {
  const rows = await User.findAll({ where: { id: { [Op.in]: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r) => r && r.subscribedToMentions);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

async function runWave(strategy, ids, jobCount) {
  const perJob = [];
  const start = process.hrtime.bigint();
  await Promise.all(
    Array.from({ length: jobCount }, async () => {
      const t = process.hrtime.bigint();
      await strategy(ids);
      perJob.push(Number(process.hrtime.bigint() - t) / 1e6);
    })
  );
  const wall = Number(process.hrtime.bigint() - start) / 1e6;
  return { wall, perJob };
}

(async () => {
  await sequelize.authenticate();
  const ids = Array.from({ length: config.size }, (_, i) => i + 1);
  const results = [];

  for (const jobCount of config.jobs) {
    for (const [key, label, fn] of [
      ['n1-sequential', 'N+1, sequential', n1Sequential],
      ['batched', 'Batched (the fix)', batched],
    ]) {
      await runWave(fn, ids, jobCount); // warmup

      const walls = [];
      let allJobs = [];
      for (let i = 0; i < config.repeats; i++) {
        const r = await runWave(fn, ids, jobCount);
        walls.push(r.wall);
        allJobs = allJobs.concat(r.perJob);
      }

      const row = {
        label: config.label,
        recipients: config.size,
        concurrentJobs: jobCount,
        strategy: key,
        strategyLabel: label,
        medianWallMs: +median(walls).toFixed(1),
        medianJobMs: +median(allJobs).toFixed(1),
        p95JobMs: +p95(allJobs).toFixed(1),
        queriesIssued: key === 'batched' ? jobCount : jobCount * config.size,
      };
      results.push(row);
      process.stdout.write(
        `${String(jobCount).padStart(3)} concurrent jobs  ${key.padEnd(15)} ` +
        `wall=${String(row.medianWallMs).padStart(8)}ms  p95 per job=${String(row.p95JobMs).padStart(8)}ms  ` +
        `queries=${row.queriesIssued}\n`
      );
    }
  }

  await sequelize.close();
  process.stdout.write('\n' + JSON.stringify({
    environment: {
      label: config.label, node: process.version, postgres: '16.13',
      host: config.host, port: config.port, poolMax: config.poolMax,
      recipients: config.size, repeats: config.repeats,
    },
    results,
  }) + '\n');
})();
