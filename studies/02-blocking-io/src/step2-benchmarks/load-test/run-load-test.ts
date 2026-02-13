/**
 * Load Test Runner
 *
 * Wraps autocannon to load-test a server at a given URL, collecting
 * latency percentiles, throughput, and error counts.
 */

import autocannon from 'autocannon';
import { BenchmarkResult } from '../utils';
import { EventLoopMonitor } from './event-loop-monitor';

export interface LoadTestConfig {
  url: string;
  testCase: string;
  variant: 'bad' | 'good';
  duration?: number;       // seconds (default 10)
  concurrency?: number;    // concurrent connections (default 50)
  pipelining?: number;     // requests per connection (default 1)
}

export async function runLoadTest(config: LoadTestConfig): Promise<BenchmarkResult> {
  const {
    url,
    testCase,
    variant,
    duration = 10,
    concurrency = 50,
    pipelining = 1,
  } = config;

  const elMonitor = new EventLoopMonitor();
  elMonitor.start();

  const result = await autocannon({
    url,
    duration,
    connections: concurrency,
    pipelining,
  });

  const elStats = elMonitor.stop();

  return {
    testCase,
    variant,
    concurrency,
    duration,
    requests: result.requests.total,
    throughput: result.requests.average,
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p95,
    latencyP99: result.latency.p99,
    latencyAvg: result.latency.average,
    latencyMax: result.latency.max,
    errors: result.errors,
    timeouts: result.timeouts,
    eventLoopDelayAvg: elStats.avgMs,
    eventLoopDelayMax: elStats.maxMs,
  };
}
