/**
 * BM-03 standalone timing benchmark.
 * Measures wall-clock speedup of Promise.all vs sequential await
 * across varying n (request count) and latency (mock server delay).
 *
 * Run: node -r ts-node/register src/step1-benchmarks/modules/bm03-async-io/bench-async.ts
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const TRIALS = 10;
const N_VALUES = [10, 50, 100, 200];
const LATENCY_VALUES = [2, 10, 50]; // ms

const RESULTS_DIR = path.resolve(__dirname, '../../../../../results');

function startMockServer(latencyMs: number): Promise<{ server: http.Server; port: number }> {
  return new Promise(resolve => {
    const server = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
      }, latencyMs);
    });
    server.maxConnections = 10000;
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

function stopMockServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}

function fetchItem(agent: http.Agent, port: number, id: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: `/item/${id}`, agent }, res => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function runSequential(agent: http.Agent, port: number, n: number): Promise<number> {
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  const t0 = process.hrtime.bigint();
  for (const id of ids) {
    await fetchItem(agent, port, id);
  }
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

async function runParallel(agent: http.Agent, port: number, n: number): Promise<number> {
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  const t0 = process.hrtime.bigint();
  await Promise.all(ids.map(id => fetchItem(agent, port, id)));
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

interface BenchRow {
  n: number;
  latencyMs: number;
  sequentialMeanMs: number;
  sequentialStdMs: number;
  parallelMeanMs: number;
  parallelStdMs: number;
  speedup: number;
  theoreticalSpeedup: number;
}

async function main() {
  const results: BenchRow[] = [];

  console.log('\n=== BM-03: Sequential Await vs Promise.all ===');
  console.log(`Trials: ${TRIALS} | n values: ${N_VALUES.join(', ')} | latencies: ${LATENCY_VALUES.join(', ')} ms\n`);

  for (const latencyMs of LATENCY_VALUES) {
    const { server, port } = await startMockServer(latencyMs);
    // Fresh agent per latency block — no socket reuse across server restarts
    const agent = new http.Agent({ keepAlive: false, maxSockets: Infinity });
    console.log(`--- Latency: ${latencyMs}ms (port ${port}) ---`);

    for (const n of N_VALUES) {
      const seqTimes: number[] = [];
      const parTimes: number[] = [];

      try {
        // Warmup
        for (let w = 0; w < 2; w++) {
          await runSequential(agent, port, Math.min(n, 5));
          await runParallel(agent, port, Math.min(n, 5));
        }

        for (let t = 0; t < TRIALS; t++) {
          seqTimes.push(await runSequential(agent, port, n));
          parTimes.push(await runParallel(agent, port, n));
        }
      } catch (err: any) {
        console.log(`  n=${n}: SKIPPED — ${err.message ?? err}`);
        continue;
      }

      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const std = (arr: number[]) => {
        const m = mean(arr);
        return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
      };

      const seqMean = mean(seqTimes);
      const parMean = mean(parTimes);
      const speedup = seqMean / parMean;
      const theoreticalSpeedup = n; // ideal: all n requests in parallel = n× faster

      const row: BenchRow = {
        n,
        latencyMs,
        sequentialMeanMs: Math.round(seqMean * 10) / 10,
        sequentialStdMs: Math.round(std(seqTimes) * 10) / 10,
        parallelMeanMs: Math.round(parMean * 10) / 10,
        parallelStdMs: Math.round(std(parTimes) * 10) / 10,
        speedup: Math.round(speedup * 10) / 10,
        theoreticalSpeedup,
      };
      results.push(row);

      console.log(
        `  n=${String(n).padEnd(4)} seq=${row.sequentialMeanMs}ms±${row.sequentialStdMs} ` +
        `par=${row.parallelMeanMs}ms±${row.parallelStdMs} ` +
        `speedup=${row.speedup}× (theoretical ${theoreticalSpeedup}×)`
      );
    }

    agent.destroy();
    await stopMockServer(server);
    console.log('');
  }

  // Summary table
  console.log('=== Summary Table ===');
  console.log('n     | latency | sequential | parallel | speedup | theoretical');
  console.log('------|---------|------------|----------|---------|------------');
  for (const r of results) {
    console.log(
      `${String(r.n).padEnd(5)} | ${String(r.latencyMs).padEnd(7)} | ` +
      `${String(r.sequentialMeanMs).padEnd(10)} | ${String(r.parallelMeanMs).padEnd(8)} | ` +
      `${String(r.speedup).padEnd(7)} | ${r.theoreticalSpeedup}×`
    );
  }

  // Write JSON
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `bench-bm03-async-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ timestamp: new Date().toISOString(), trials: TRIALS, results }, null, 2));
  console.log(`\nResults written to: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
