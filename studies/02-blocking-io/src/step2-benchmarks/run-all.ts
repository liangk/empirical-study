/**
 * Study 02 — Step 2: Run All Benchmark Scenarios
 *
 * Starts bad/good Express servers for each scenario, load-tests both,
 * prints comparisons, and saves all results to a JSON file.
 *
 * Usage:
 *   ts-node src/step2-benchmarks/run-all.ts [--duration 10] [--concurrency 50]
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BenchmarkResult, printResult, printComparison, startServer, stopServer } from './utils';
import { runLoadTest } from './load-test/run-load-test';

import * as tc1 from './scenarios/tc1-readfilesync';
import * as tc2 from './scenarios/tc2-execsync';
import * as tc3 from './scenarios/tc3-crypto-sync';
import * as tc4 from './scenarios/tc4-writefilesync';
import * as tc5 from './scenarios/tc5-existssync';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');
const BASE_PORT = 4000;

interface ScenarioDef {
  name: string;
  endpoint: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  createBad: () => any;
  createGood: () => any;
}

const scenarios: ScenarioDef[] = [
  { name: tc1.scenario.name, endpoint: tc1.scenario.endpoint, createBad: tc1.createBadServer, createGood: tc1.createGoodServer },
  { name: tc2.scenario.name, endpoint: tc2.scenario.endpoint, createBad: tc2.createBadServer, createGood: tc2.createGoodServer },
  { name: tc3.scenario.name, endpoint: tc3.scenario.endpoint, method: (tc3.scenario as any).method, body: (tc3.scenario as any).body, headers: (tc3.scenario as any).headers, createBad: tc3.createBadServer, createGood: tc3.createGoodServer },
  { name: tc4.scenario.name, endpoint: tc4.scenario.endpoint, createBad: tc4.createBadServer, createGood: tc4.createGoodServer },
  { name: tc5.scenario.name, endpoint: tc5.scenario.endpoint, createBad: tc5.createBadServer, createGood: tc5.createGoodServer },
];

async function main() {
  const args = process.argv.slice(2);
  const durationIdx = args.indexOf('--duration');
  const duration = durationIdx >= 0 ? parseInt(args[durationIdx + 1], 10) : 10;
  const concurrencyIdx = args.indexOf('--concurrency');
  const concurrency = concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1], 10) : 50;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  STUDY 02 — BLOCKING I/O BENCHMARKS');
  console.log(`  Duration: ${duration}s | Concurrency: ${concurrency}`);
  console.log('═══════════════════════════════════════════════════════');

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const allResults: { bad: BenchmarkResult; good: BenchmarkResult }[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    const badPort = BASE_PORT + i * 2;
    const goodPort = BASE_PORT + i * 2 + 1;

    console.log(`\n\n━━━ ${sc.name} ━━━`);

    // --- Bad server ---
    const badApp = sc.createBad();
    const badServer = await startServer(badApp, badPort);
    console.log(`  Bad server on :${badPort}`);

    const badResult = await runLoadTest({
      url: `http://127.0.0.1:${badPort}${sc.endpoint}`,
      testCase: sc.name,
      variant: 'bad',
      duration,
      concurrency,
    });
    printResult(badResult);
    await stopServer(badServer);

    // Small delay between servers
    await new Promise(r => setTimeout(r, 500));

    // --- Good server ---
    const goodApp = sc.createGood();
    const goodServer = await startServer(goodApp, goodPort);
    console.log(`  Good server on :${goodPort}`);

    const goodResult = await runLoadTest({
      url: `http://127.0.0.1:${goodPort}${sc.endpoint}`,
      testCase: sc.name,
      variant: 'good',
      duration,
      concurrency,
    });
    printResult(goodResult);
    await stopServer(goodServer);

    // --- Comparison ---
    printComparison(badResult, goodResult);
    allResults.push({ bad: badResult, good: goodResult });
  }

  // Summary table
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('| Test Case | Bad P95 | Good P95 | P95 Improvement | Bad Throughput | Good Throughput | Throughput Gain |');
  console.log('|-----------|---------|----------|-----------------|----------------|-----------------|-----------------|');

  for (const { bad, good } of allResults) {
    const p95Imp = (bad.latencyP95 / good.latencyP95).toFixed(1);
    const tpGain = (good.throughput / bad.throughput).toFixed(1);
    console.log(
      `| ${bad.testCase} | ${bad.latencyP95.toFixed(1)}ms | ${good.latencyP95.toFixed(1)}ms | **${p95Imp}x** | ${bad.throughput.toFixed(0)} req/s | ${good.throughput.toFixed(0)} req/s | **${tpGain}x** |`
    );
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `bench-${timestamp}.json`);
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      duration,
      concurrency,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    scenarios: allResults,
  };
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outPath}`);
}

main().catch(console.error);
