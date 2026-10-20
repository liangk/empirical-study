#!/usr/bin/env node
/**
 * What a blocking call in a handler does to every other request.
 *
 * For each case (Next.js preview decryption, Redwood login hashing) and each
 * mode (sync as shipped, async), start a fresh server process, then for
 * DURATION seconds:
 *   - send `/ping` at PING_RATE per second (open loop: requests go out on a
 *     fixed schedule whether or not earlier ones have answered, so a stalled
 *     server shows up as latency instead of fewer requests);
 *   - send `/heavy` at each HEAVY_RATE per second, the same way.
 * Latency is measured from each request's scheduled send time.
 *
 * Usage: node bench.js [out.json]
 * Environment: DURATION (s, default 15), PING_RATE (default 200),
 * HEAVY_RATES (default 0,2,5,10,20).
 */
const http = require('http');
const os = require('os');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const h = require('./handlers');

const DURATION = Number(process.env.DURATION || 15);
const PING_RATE = Number(process.env.PING_RATE || 200);
const HEAVY_RATES = (process.env.HEAVY_RATES || '0,2,5,10,20').split(',').map(Number);
const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });

function get(port, p) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, agent }, (res) => { res.resume(); res.on('end', () => resolve(true)); });
    req.on('error', () => resolve(false));
    req.setTimeout(30_000, () => { req.destroy(); resolve(false); });
  });
}

/** Fire requests on a fixed schedule; return latencies (ms) from scheduled time. */
async function stream(port, p, rate, ms) {
  if (!rate) return [];
  const out = [];
  const pending = [];
  const t0 = performance.now();
  const n = Math.floor((rate * ms) / 1000);
  for (let i = 0; i < n; i++) {
    const due = t0 + (i * 1000) / rate;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    pending.push(get(port, p).then((ok) => { if (ok) out.push(performance.now() - due); }));
  }
  await Promise.all(pending);
  return out;
}

const pct = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

function serve(which, mode, port) {
  return new Promise((resolve) => {
    const child = fork(path.join(__dirname, 'server.js'), [which, mode, String(port)]);
    child.on('message', (m) => m === 'ready' && resolve(child));
  });
}

/** One call's cost on an idle process, median of 21. */
function costOf(fn) {
  const xs = [];
  for (let i = 0; i < 21; i++) { const t = performance.now(); fn(); xs.push(performance.now() - t); }
  return r1(pct(xs, 0.5));
}

(async () => {
  const secret = Buffer.from('a'.repeat(32));
  const token = h.encryptWithSecret(secret, JSON.stringify({ draft: true }));
  const env = {
    node: process.version, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, uvThreadpool: process.env.UV_THREADPOOL_SIZE || 4,
    durationS: DURATION, pingRate: PING_RATE,
    costMs: {
      next: costOf(() => h.decryptWithSecret(secret, token)),
      redwood: costOf(() => h.hashPassword('correct horse battery staple', { salt: 'f'.repeat(64) })),
    },
  };
  console.log(env);
  const rows = [];
  let port = 4100;
  for (const which of ['next', 'redwood']) {
    for (const rate of HEAVY_RATES) {
      for (const mode of ['sync', 'async']) {
        const child = await serve(which, mode, ++port);
        await stream(port, '/ping', 50, 1000); // warm up
        const ms = DURATION * 1000;
        const [ping, heavy] = await Promise.all([stream(port, '/ping', PING_RATE, ms), stream(port, '/heavy', rate, ms)]);
        child.kill();
        const row = {
          case: which, mode, heavyRate: rate,
          pingSent: Math.floor((PING_RATE * ms) / 1000), pingOk: ping.length,
          pingP50: r1(pct(ping, 0.5)), pingP99: r1(pct(ping, 0.99)), pingMax: r1(pct(ping, 1)),
          heavyOk: heavy.length, heavyP50: r1(pct(heavy, 0.5)), heavyP99: r1(pct(heavy, 0.99)),
        };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    }
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ env, rows }, null, 2));
  agent.destroy();
})();
