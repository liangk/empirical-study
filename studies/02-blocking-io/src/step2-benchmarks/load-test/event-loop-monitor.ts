/**
 * Event Loop Delay Monitor
 *
 * Uses perf_hooks.monitorEventLoopDelay to track how much the event loop
 * is being blocked during a benchmark run.
 */

import { monitorEventLoopDelay } from 'perf_hooks';

export interface EventLoopStats {
  // Mean delay between expected vs actual event loop ticks.
  avgMs: number;
  // Worst observed delay spike during the measurement window.
  maxMs: number;
  // Smallest observed delay (usually near monitor resolution floor).
  minMs: number;
  // Percentile delays provide a more stable view than a single max value.
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

// ReturnType keeps typing compatible across Node versions / @types updates.
type Monitor = ReturnType<typeof monitorEventLoopDelay>;

export class EventLoopMonitor {
  private monitor: Monitor;

  constructor(resolution: number = 10) {
    // Lower resolution = finer granularity, but slightly higher monitoring overhead.
    this.monitor = monitorEventLoopDelay({ resolution });
  }

  start() {
    // Begin histogram collection for this benchmark segment.
    this.monitor.enable();
  }

  stop(): EventLoopStats {
    // Stop sampling first so returned metrics represent a closed time window.
    this.monitor.disable();
    const ns = (val: number) => val / 1e6; // nanoseconds → milliseconds

    return {
      avgMs: ns(this.monitor.mean),
      maxMs: ns(this.monitor.max),
      minMs: ns(this.monitor.min),
      p50Ms: ns(this.monitor.percentile(50)),
      p95Ms: ns(this.monitor.percentile(95)),
      p99Ms: ns(this.monitor.percentile(99)),
    };
  }

  reset() {
    // Useful when one monitor instance is reused across multiple test phases.
    this.monitor.reset();
  }
}
