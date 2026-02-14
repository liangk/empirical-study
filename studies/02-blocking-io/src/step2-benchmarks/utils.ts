/**
 * Study 02 — Step 2: Benchmark Utilities
 *
 * Shared types and helpers for blocking I/O benchmarks.
 */

import { createServer, Server } from 'http';

// Canonical result shape shared by load runner, CLI output, and JSON persistence.
export interface BenchmarkResult {
  testCase: string;
  variant: 'bad' | 'good';
  concurrency: number;
  duration: number;
  requests: number;
  throughput: number;       // req/sec
  latencyP50: number;       // ms
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  latencyMax: number;
  errors: number;
  timeouts: number;
  eventLoopDelayAvg: number;  // ms
  eventLoopDelayMax: number;
}

export interface ScenarioConfig {
  name: string;
  description: string;
  port: number;
  setupBad: () => Promise<Server>;
  setupGood: () => Promise<Server>;
}

export function startServer(app: any, port: number): Promise<Server> {
  // Wrap callback-style listen() in a Promise for clean async orchestration.
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

export function stopServer(server: Server): Promise<void> {
  // Ensure graceful shutdown between bad/good runs to avoid port conflicts.
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function printResult(r: BenchmarkResult) {
  // Print all raw metrics for post-run debugging and transparency.
  console.log(`\n--- ${r.testCase} [${r.variant.toUpperCase()}] ---`);
  console.log(`  Concurrency:     ${r.concurrency}`);
  console.log(`  Duration:        ${r.duration}s`);
  console.log(`  Requests:        ${r.requests}`);
  console.log(`  Throughput:      ${r.throughput.toFixed(1)} req/sec`);
  console.log(`  Latency avg:     ${r.latencyAvg.toFixed(2)}ms`);
  console.log(`  Latency P50:     ${r.latencyP50.toFixed(2)}ms`);
  console.log(`  Latency P95:     ${r.latencyP95.toFixed(2)}ms`);
  console.log(`  Latency P99:     ${r.latencyP99.toFixed(2)}ms`);
  console.log(`  Latency max:     ${r.latencyMax.toFixed(2)}ms`);
  console.log(`  Errors:          ${r.errors}`);
  console.log(`  Timeouts:        ${r.timeouts}`);
  console.log(`  EL delay avg:    ${r.eventLoopDelayAvg.toFixed(2)}ms`);
  console.log(`  EL delay max:    ${r.eventLoopDelayMax.toFixed(2)}ms`);
}

export function printComparison(bad: BenchmarkResult, good: BenchmarkResult) {
  // Derived comparison metrics used in console and article summaries.
  const speedupThroughput = good.throughput / bad.throughput;
  // Clamp denominator so we never print Infinity/NaN on near-zero percentile values.
  const latencyReduction = bad.latencyP95 / Math.max(good.latencyP95, 0.01);
  const elDelayReduction = bad.eventLoopDelayMax / Math.max(good.eventLoopDelayMax, 0.01);

  console.log(`\n=== ${bad.testCase} COMPARISON (concurrency=${bad.concurrency}) ===`);
  console.log(`  Throughput:      ${bad.throughput.toFixed(1)} → ${good.throughput.toFixed(1)} req/sec (${speedupThroughput.toFixed(1)}x)`);
  console.log(`  Latency P95:     ${bad.latencyP95.toFixed(2)} → ${good.latencyP95.toFixed(2)}ms (${latencyReduction.toFixed(1)}x better)`);
  console.log(`  Latency P99:     ${bad.latencyP99.toFixed(2)} → ${good.latencyP99.toFixed(2)}ms`);
  console.log(`  EL delay max:    ${bad.eventLoopDelayMax.toFixed(2)} → ${good.eventLoopDelayMax.toFixed(2)}ms (${elDelayReduction.toFixed(1)}x better)`);
  console.log(`  Errors:          ${bad.errors} → ${good.errors}`);
}
