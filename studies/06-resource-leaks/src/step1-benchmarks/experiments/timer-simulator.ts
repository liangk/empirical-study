import { SimulationResult } from './types';

/**
 * BM-05: Timer Leak Simulator.
 * Models setInterval / setTimeout without clearInterval / clearTimeout.
 * Each leaked timer holds a reference preventing GC of its closure.
 * Failure mode: heap OOM when (leakedTimers × closureSizeBytes) exceeds maxHeapBytes.
 * CPU impact: leaked interval timers fire repeatedly — total callback invocations accumulate.
 *
 * Timer type semantics:
 *  - 'interval': setInterval() — fires every intervalMs forever unless cleared.
 *                Proper pattern: store id, clearInterval(id) after use.
 *  - 'timeout':  setTimeout() — fires once and auto-removes from event loop.
 *                Only leaks if the timeout fires and the closure is retained externally.
 *                With leakProbability: the closure is captured in a long-lived ref.
 */

export type TimerType = 'interval' | 'timeout';

export interface TimerConfig {
  maxHeapBytes: number;
}

export interface TimerWorkloadConfig {
  durationMs: number;
  creationRatePerSec: number;
  leakProbability: number;
  closureSizeBytes: number;
  timerIntervalMs: number;
  timerLifetimeMs: number;
  timerType: TimerType;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runTimerSimulation(config: TimerConfig, workload: TimerWorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { maxHeapBytes } = config;
  const { durationMs, creationRatePerSec, leakProbability, closureSizeBytes, timerIntervalMs, timerLifetimeMs, timerType } = workload;

  let leakedTimers = 0;
  let clearedTimers = 0;
  let heapBytes = 0;
  let totalCreated = 0;
  let totalFailed = 0;
  let exhaustionTime = Infinity;
  let totalCallbacks = 0;
  let peakActive = 0;

  const arrivalIntervalMs = Math.max(1, Math.round(1000 / creationRatePerSec));
  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  // Track active timers: [createdAt, clearAt, leaked, closureSize]
  const activeTimers: Array<{ createdAt: number; clearAt: number; leaked: boolean; closureSize: number }> = [];

  for (const t of arrivals) {
    // Clear timers that have reached their lifetime (proper timers)
    for (let i = activeTimers.length - 1; i >= 0; i--) {
      const timer = activeTimers[i];
      if (!timer.leaked && timer.clearAt <= t) {
        activeTimers.splice(i, 1);
        clearedTimers++;
      }
    }

    // Check OOM
    if (heapBytes >= maxHeapBytes) {
      if (exhaustionTime === Infinity) exhaustionTime = t;
      totalFailed++;
      continue;
    }

    totalCreated++;
    const isLeak = rng() < leakProbability;

    if (timerType === 'timeout') {
      // setTimeout: fires once. Without leak, callback runs and closure is GC'd.
      // With leak: closure is captured in external reference, never GC'd.
      if (isLeak) {
        activeTimers.push({ createdAt: t, clearAt: Infinity, leaked: true, closureSize: closureSizeBytes });
        leakedTimers++;
        heapBytes += closureSizeBytes;
        // timeout fires once then "stops" but closure retained
        if (t + timerIntervalMs <= durationMs) totalCallbacks++;
      } else {
        // fires once, closure freed
        if (t + timerIntervalMs <= durationMs) totalCallbacks++;
        clearedTimers++;
      }
    } else {
      // setInterval: fires every timerIntervalMs
      if (isLeak) {
        activeTimers.push({ createdAt: t, clearAt: Infinity, leaked: true, closureSize: closureSizeBytes });
        leakedTimers++;
        heapBytes += closureSizeBytes;
        // Leaked interval fires from t until end of simulation
        const remainingTime = durationMs - t;
        totalCallbacks += Math.floor(remainingTime / timerIntervalMs);
      } else {
        activeTimers.push({ createdAt: t, clearAt: t + timerLifetimeMs, leaked: false, closureSize: 0 });
        // Proper timer fires during its lifetime
        const activeTime = Math.min(timerLifetimeMs, durationMs - t);
        totalCallbacks += Math.floor(activeTime / timerIntervalMs);
      }
    }

    const currentActive = activeTimers.filter(timer => timer.leaked).length;
    if (currentActive > peakActive) peakActive = currentActive;
  }

  const successful = totalCreated - totalFailed;
  const successRate = totalCreated > 0 ? successful / totalCreated : 0;
  const throughput = successful / (durationMs / 1000);

  // Event loop delay: O(activeLeakedTimers) — each tick, all leaked intervals fire
  // Simulate as proportional to total callback invocations / duration
  const callbacksPerSec = totalCallbacks / (durationMs / 1000);
  const eventLoopDelayMs = Math.min(50, callbacksPerSec * 0.001); // 1µs per callback, capped at 50ms

  return {
    timeToExhaustion: exhaustionTime,
    successfulRequests: successful,
    failedRequests: totalFailed,
    failureRate: totalCreated > 0 ? totalFailed / totalCreated : 0,
    meanLatencyMs: eventLoopDelayMs,
    p95LatencyMs: eventLoopDelayMs * 2,
    peakActiveConnections: peakActive,
    leakedConnections: leakedTimers,
    totalRequests: totalCreated,
    throughput,
    heapGrowthBytes: heapBytes,
    memoryPerLeakedResource: closureSizeBytes,
    totalCallbackInvocations: totalCallbacks,
  };
}
