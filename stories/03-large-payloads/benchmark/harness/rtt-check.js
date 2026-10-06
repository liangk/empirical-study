// Median single-query round trip for each connection the benchmark uses.
const { Client } = require('pg');
(async () => {
  for (const [label, host, port] of [['unix socket', '/tmp', 5433], ['proxy +0.5ms', '127.0.0.1', 5434], ['proxy +2.5ms', '127.0.0.1', 5435]]) {
    const c = new Client({ host, port, user: 'postgres', database: 'calbench' });
    await c.connect();
    for (let i = 0; i < 20; i++) await c.query('SELECT 1');
    const times = [];
    for (let i = 0; i < 51; i++) { const t = process.hrtime.bigint(); await c.query('SELECT 1'); times.push(Number(process.hrtime.bigint() - t) / 1e6); }
    times.sort((a, b) => a - b);
    console.log(label.padEnd(14), 'median single-query round trip:', times[25].toFixed(3) + 'ms');
    await c.end();
  }
})();
