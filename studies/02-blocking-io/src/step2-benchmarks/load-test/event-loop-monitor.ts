/**
 * Event Loop Delay Monitor
 *
 * Uses perf_hooks.monitorEventLoopDelay to track how much the event loop
 * is being blocked during a benchmark run.
 */

import { monitorEventLoopDelay, EventLoopDelayMonitor } from 'perf_hooks';

export interface EventLoopStats {
  avgMs: number;
  maxMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export class EventLoopMonitor {
  private monitor: EventLoopDelayMonitor;

  constructor(resolution: number = 10) {
    this.monitor = monitorEventLoopDelay({ resolution });
  }

  start() {
    this.monitor.enable();
  }

  stop(): EventLoopStats {
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
    this.monitor.reset();
  }
}
