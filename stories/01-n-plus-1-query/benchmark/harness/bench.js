/**
 * What an N+1 costs: a measured benchmark.
 *
 * The workload is a faithful reduction of outline's notification pipeline, the
 * source of 27 of the 213 N+1 patterns found in the scan. The real code
 * (server/queues/tasks/CommentCreatedNotificationsTask.ts) resolves recipients
 * like this:
 *
 *     for (const mention of mentions) {
 *       const recipient = await User.findByPk(mention.modelId);
 *       ...
 *     }
 *
 * Three strategies are measured against identical data:
 *
 *   n1-sequential  as found in the wild: one awaited findByPk per mention
 *   n1-parallel    the same queries fired concurrently via Promise.all — the
 *                  shape several other findings take, and the usual first
 *                  instinct when someone notices the loop is slow
 *   batched        the fix the detector generates: collect ids, one findAll,
 *                  build a Map, then loop against the Map
 *
 * Everything else is held constant: same rows, same process, same pool, same
 * warmup, same repeat count.
 */
const { Sequelize, DataTypes, Op } = require('sequelize');

const config = {
  port: parseInt(process.env.PG_PORT, 10) || 5433,
  host: process.env.PG_HOST || '/tmp',
  sizes: (process.env.SIZES || '10,100,1000').split(',').map(Number),
  repeats: parseInt(process.env.REPEATS, 10) || 7,
  warmups: parseInt(process.env.WARMUPS, 10) || 2,
  poolMax: parseInt(process.env.POOL_MAX, 10) || 10,
  label: process.env.LABEL || 'local-socket',
};

let queryCount = 0;

const sequelize = new Sequelize('n1bench', 'postgres', '', {
  host: config.host,
  port: config.port,
  dialect: 'postgres',
  logging: () => { queryCount++; },
  pool: { max: config.poolMax, min: 1, idle: 10_000 },
});

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  locale: DataTypes.STRING,
  subscribedToMentions: DataTypes.BOOLEAN,
}, { tableName: 'users', timestamps: false });

// ---------------------------------------------------------------- strategies

/** As found in the wild: one awaited query per mention. */
async function n1Sequential(mentionIds) {
  const recipients = [];
  for (const id of mentionIds) {
    const recipient = await User.findByPk(id);
    if (recipient && recipient.subscribedToMentions) recipients.push(recipient);
  }
  return recipients;
}

/** Same N queries, fired concurrently. */
async function n1Parallel(mentionIds) {
  const found = await Promise.all(mentionIds.map((id) => User.findByPk(id)));
  return found.filter((r) => r && r.subscribedToMentions);
}

/** The generated fix: one query, then a Map lookup per mention. */
async function batched(mentionIds) {
  const rows = await User.findAll({ where: { id: { [Op.in]: mentionIds } } });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const recipients = [];
  for (const id of mentionIds) {
    const recipient = byId.get(id);
    if (recipient && recipient.subscribedToMentions) recipients.push(recipient);
  }
  return recipients;
}

const STRATEGIES = [
  { key: 'n1-sequential', label: 'N+1, sequential', run: n1Sequential },
  { key: 'n1-parallel', label: 'N+1, parallel', run: n1Parallel },
  { key: 'batched', label: 'Batched (the fix)', run: batched },
];

// ---------------------------------------------------------------------- setup

async function seed(maxSize) {
  await sequelize.query('DROP TABLE IF EXISTS users');
  await sequelize.query(`
    CREATE TABLE users (
      id integer PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      locale text NOT NULL,
      "subscribedToMentions" boolean NOT NULL
    )
  `);

  const rows = [];
  for (let i = 1; i <= maxSize; i++) {
    rows.push(`(${i}, 'User ${i}', 'user${i}@example.com', 'en', ${i % 10 !== 0})`);
  }
  // insert in chunks so the seed itself doesn't hit statement limits
  for (let i = 0; i < rows.length; i += 500) {
    await sequelize.query(
      `INSERT INTO users (id, name, email, locale, "subscribedToMentions") VALUES ${rows.slice(i, i + 500).join(',')}`
    );
  }
  await sequelize.query('ANALYZE users');
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

async function measure(strategy, mentionIds) {
  queryCount = 0;
  const start = process.hrtime.bigint();
  const result = await strategy.run(mentionIds);
  const end = process.hrtime.bigint();
  return {
    ms: Number(end - start) / 1e6,
    queries: queryCount,
    recipients: result.length,
  };
}

// ----------------------------------------------------------------------- main

(async () => {
  await sequelize.authenticate();
  const maxSize = Math.max(...config.sizes);
  await seed(maxSize);

  const results = [];

  for (const size of config.sizes) {
    const mentionIds = Array.from({ length: size }, (_, i) => i + 1);

    for (const strategy of STRATEGIES) {
      for (let i = 0; i < config.warmups; i++) await measure(strategy, mentionIds);

      const runs = [];
      for (let i = 0; i < config.repeats; i++) runs.push(await measure(strategy, mentionIds));

      const row = {
        label: config.label,
        size,
        strategy: strategy.key,
        strategyLabel: strategy.label,
        queries: runs[0].queries,
        medianMs: +median(runs.map((r) => r.ms)).toFixed(1),
        minMs: +Math.min(...runs.map((r) => r.ms)).toFixed(1),
        maxMs: +Math.max(...runs.map((r) => r.ms)).toFixed(1),
        recipients: runs[0].recipients,
        repeats: config.repeats,
      };
      results.push(row);
      process.stdout.write(
        `${String(size).padStart(5)} recipients  ${strategy.key.padEnd(15)} ` +
        `queries=${String(row.queries).padStart(5)}  median=${String(row.medianMs).padStart(8)}ms\n`
      );
    }
  }

  await sequelize.close();

  process.stdout.write('\n' + JSON.stringify({
    environment: {
      label: config.label,
      node: process.version,
      postgres: '16.13',
      host: config.host,
      port: config.port,
      poolMax: config.poolMax,
      repeats: config.repeats,
      warmups: config.warmups,
    },
    results,
  }) + '\n');
})();
