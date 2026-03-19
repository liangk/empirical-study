import { SimulationResult } from './types';

/**
 * BM-06: Event Listener Leak Simulator.
 * Models emitter.on() / emitter.once() without emitter.off().
 * Each leaked listener holds a closure reference preventing GC.
 * Failure modes:
 *  - MaxListenersExceeded warning at (maxListenersPerEmitter + 1) listeners on any single emitter
 *  - Heap OOM when total listener closures exceed maxHeapBytes
 *  - Emit performance degradation: O(n) per emit × event frequency
 *
 * Listener type semantics:
 *  - 'on': persistent listener — fires every time event is emitted. Must be removed with off().
 *  - 'once': one-shot listener — auto-removed after first fire. Only leaks via external closure refs.
 */

export type ListenerType = 'on' | 'once';

export interface ListenerConfig {
  maxListenersPerEmitter: number;
  maxHeapBytes: number;
}

export interface ListenerWorkloadConfig {
  durationMs: number;
  emitterCount: number;
  listenersPerComponent: number;
  componentCreateRatePerSec: number;
  eventEmitFrequencyHz: number;
  leakProbability: number;
  closureSizeBytes: number;
  listenerType: ListenerType;
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

export function runListenerSimulation(config: ListenerConfig, workload: ListenerWorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { maxListenersPerEmitter, maxHeapBytes } = config;
  const { durationMs, emitterCount, listenersPerComponent, componentCreateRatePerSec, eventEmitFrequencyHz, leakProbability, closureSizeBytes, listenerType } = workload;

  // Track listeners per emitter
  const emitterListeners: number[] = new Array(emitterCount).fill(0);
  let totalLeakedListeners = 0;
  let totalHeapBytes = 0;
  let totalCreated = 0;
  let totalFailed = 0;
  let maxListenersExceededAt = Infinity;
  let exhaustionTime = Infinity;
  let peakTotalListeners = 0;
  let totalCallbackInvocations = 0;

  const arrivalIntervalMs = Math.max(1, Math.round(1000 / componentCreateRatePerSec));
  const emitIntervalMs = eventEmitFrequencyHz > 0 ? 1000 / eventEmitFrequencyHz : Infinity;

  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  const emitTimes: number[] = [];
  if (emitIntervalMs < Infinity) {
    for (let t = 0; t < durationMs; t += emitIntervalMs) emitTimes.push(t);
  }

  let emitIdx = 0;

  for (const t of arrivals) {
    // Process any pending emits before this arrival
    while (emitIdx < emitTimes.length && emitTimes[emitIdx] <= t) {
      // Emit on all emitters: O(n) per emitter where n = listener count
      for (let e = 0; e < emitterCount; e++) {
        const listenerCount = emitterListeners[e];
        if (listenerCount > 0) {
          totalCallbackInvocations += listenerCount;
          // once() listeners fire once then auto-remove (but if leaked, closure remains in memory)
        }
      }
      emitIdx++;
    }

    // Check OOM
    if (totalHeapBytes >= maxHeapBytes) {
      if (exhaustionTime === Infinity) exhaustionTime = t;
      totalFailed += listenersPerComponent;
      continue;
    }

    // A "component" subscribes with listenersPerComponent listeners
    totalCreated += listenersPerComponent;
    const targetEmitter = Math.floor(rng() * emitterCount);

    for (let i = 0; i < listenersPerComponent; i++) {
      const isLeak = rng() < leakProbability;

      if (listenerType === 'once') {
        // once() auto-removes after first fire — only leaks if closure kept in external ref
        if (isLeak) {
          emitterListeners[targetEmitter]++;
          totalLeakedListeners++;
          totalHeapBytes += closureSizeBytes;
        }
        // non-leaked once: fires and removes itself (no persistent retention)
      } else {
        // on(): persistent — must be manually removed
        if (isLeak) {
          emitterListeners[targetEmitter]++;
          totalLeakedListeners++;
          totalHeapBytes += closureSizeBytes;
        } else {
          // Proper: add and remove after component lifecycle (not tracked in pool, just noted)
          // No heap growth, no listener accumulation
        }
      }

      // Check MaxListenersExceeded threshold
      if (emitterListeners[targetEmitter] > maxListenersPerEmitter && maxListenersExceededAt === Infinity) {
        maxListenersExceededAt = t;
        if (exhaustionTime === Infinity) exhaustionTime = t;
      }
    }

    const currentTotal = emitterListeners.reduce((a, b) => a + b, 0);
    if (currentTotal > peakTotalListeners) peakTotalListeners = currentTotal;
  }

  // Process remaining emits
  while (emitIdx < emitTimes.length) {
    for (let e = 0; e < emitterCount; e++) {
      totalCallbackInvocations += emitterListeners[e];
    }
    emitIdx++;
  }

  const successful = totalCreated - totalFailed;
  const throughput = successful / (durationMs / 1000);

  // Emit latency: O(n) where n = mean listeners per emitter
  const meanListenersPerEmitter = emitterCount > 0 ? peakTotalListeners / emitterCount : 0;
  // Each listener callback ~0.1ms at 100 listeners (empirically); scales linearly
  const meanEmitLatencyMs = meanListenersPerEmitter * 0.001;

  return {
    timeToExhaustion: exhaustionTime,
    successfulRequests: successful,
    failedRequests: totalFailed,
    failureRate: totalCreated > 0 ? totalFailed / totalCreated : 0,
    meanLatencyMs: meanEmitLatencyMs,
    p95LatencyMs: meanEmitLatencyMs * 3,
    peakActiveConnections: peakTotalListeners,
    leakedConnections: totalLeakedListeners,
    totalRequests: totalCreated,
    throughput,
    heapGrowthBytes: totalHeapBytes,
    memoryPerLeakedResource: closureSizeBytes,
    totalCallbackInvocations,
    meanEmitLatencyMs,
  };
}
