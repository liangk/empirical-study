/**
 * Load Test Runner
 *
 * Wraps autocannon to load-test a server at a given URL, collecting
 * latency percentiles, throughput, and error counts.
 */

import autocannon from 'autocannon';
import { BenchmarkResult } from '../utils';
import { EventLoopMonitor } from './event-loop-monitor';

type HistogramExtras = {
  // autocannon latency fields can vary by runtime/version; keep optional.
  p50?: number;
  p95?: number;
  p97_5?: number;
  p90?: number;
  p99?: number;
  average?: number;
  max?: number;
};

function getLatencyMetric(latency: autocannon.Result['latency'], ...keys: Array<keyof HistogramExtras>): number {
  // Read first available latency field from fallback chain.
  // Example: P95 may be missing in some runs, so we fallback to p97_5/p90.
  const hist = latency as HistogramExtras;
  for (const key of keys) {
    const value = hist[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

export interface LoadTestConfig {
  url: string;
  testCase: string;
  variant: 'bad' | 'good';
  // Optional request shape for non-GET scenarios (e.g., TC3 login POST).
  method?: autocannon.Options['method'];
  body?: string;
  headers?: Record<string, string>;
  duration?: number;       // seconds (default 10)
  concurrency?: number;    // concurrent connections (default 50)
  pipelining?: number;     // requests per connection (default 1)
}

export async function runLoadTest(config: LoadTestConfig): Promise<BenchmarkResult> {
  const {
    url,
    testCase,
    variant,
    method,
    body,
    headers,
    duration = 10,
    concurrency = 50,
    pipelining = 1,
  } = config;

  const elMonitor = new EventLoopMonitor();
  // Measure event loop health during the exact load-test window.
  elMonitor.start();

  // Build autocannon config incrementally to avoid passing undefined optional fields.
  // (Some autocannon internals reject method: undefined.)
  const acConfig: autocannon.Options = {
    url,
    duration,
    connections: concurrency,
    pipelining,
  };
  if (method) acConfig.method = method;
  if (body !== undefined) acConfig.body = body;
  if (headers) acConfig.headers = headers;

  // Run the benchmark and wait for full completion before reading stats.
  const result = await autocannon(acConfig);

  const elStats = elMonitor.stop();

  // Normalize all metric outputs into a stable result schema used by run-all.ts.
  return {
    testCase,
    variant,
    concurrency,
    duration,
    requests: result.requests.total,
    throughput: result.requests.average,
    latencyP50: getLatencyMetric(result.latency, 'p50'),
    // Fallbacks keep article/report generation robust even if histogram fields vary.
    latencyP95: getLatencyMetric(result.latency, 'p95', 'p97_5', 'p90'),
    latencyP99: getLatencyMetric(result.latency, 'p99', 'p97_5'),
    latencyAvg: getLatencyMetric(result.latency, 'average'),
    latencyMax: getLatencyMetric(result.latency, 'max'),
    errors: result.errors,
    timeouts: result.timeouts,
    eventLoopDelayAvg: elStats.avgMs,
    eventLoopDelayMax: elStats.maxMs,
  };
}
