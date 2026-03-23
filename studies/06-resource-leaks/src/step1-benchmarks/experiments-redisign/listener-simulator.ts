import { SimulationResult } from './types';

export type ListenerType = 'on' | 'once';

export interface ListenerConfig {
  maxListenersPerEmitter: number;
  maxHeapBytes: number;
  maxMeanEmitLatencyMs?: number;
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
  const { maxListenersPerEmitter, maxHeapBytes, maxMeanEmitLatencyMs = 30 } = config;
  const { durationMs, emitterCount, listenersPerComponent, componentCreateRatePerSec, eventEmitFrequencyHz, leakProbability, closureSizeBytes, listenerType } = workload;

  const emitterListeners: number[] = new Array(emitterCount).fill(0);
  let totalLeakedListeners = 0;
  let totalHeapBytes = 0;
  let totalCreated = 0;
  let totalFailed = 0;
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
  let peakMeanEmitLatencyMs = 0;

  for (const t of arrivals) {
    while (emitIdx < emitTimes.length && emitTimes[emitIdx] <= t) {
      for (let e = 0; e < emitterCount; e++) {
        const listenerCount = emitterListeners[e];
        if (listenerCount > 0) totalCallbackInvocations += listenerCount;
      }
      emitIdx++;
    }

    const currentMaxListeners = emitterListeners.length > 0 ? Math.max(...emitterListeners) : 0;
    const currentMeanEmitLatencyMs = currentMaxListeners * 0.03;
    if (currentMeanEmitLatencyMs > peakMeanEmitLatencyMs) peakMeanEmitLatencyMs = currentMeanEmitLatencyMs;

    if ((totalHeapBytes >= maxHeapBytes || currentMeanEmitLatencyMs >= maxMeanEmitLatencyMs || currentMaxListeners > maxListenersPerEmitter) && exhaustionTime === Infinity) {
      exhaustionTime = t;
    }
    if (exhaustionTime !== Infinity) {
      totalFailed += listenersPerComponent;
      continue;
    }

    totalCreated += listenersPerComponent;
    const targetEmitter = Math.floor(rng() * emitterCount);

    for (let i = 0; i < listenersPerComponent; i++) {
      const isLeak = rng() < leakProbability;
      if (listenerType === 'once') {
        if (isLeak) {
          emitterListeners[targetEmitter]++;
          totalLeakedListeners++;
          totalHeapBytes += closureSizeBytes;
        }
      } else if (isLeak) {
        emitterListeners[targetEmitter]++;
        totalLeakedListeners++;
        totalHeapBytes += closureSizeBytes;
      }
    }

    const currentTotal = emitterListeners.reduce((a, b) => a + b, 0);
    if (currentTotal > peakTotalListeners) peakTotalListeners = currentTotal;
  }

  while (emitIdx < emitTimes.length) {
    for (let e = 0; e < emitterCount; e++) totalCallbackInvocations += emitterListeners[e];
    emitIdx++;
  }

  const successful = totalCreated - totalFailed;
  const throughput = successful / (durationMs / 1000);

  return {
    timeToExhaustion: exhaustionTime,
    successfulRequests: successful,
    failedRequests: totalFailed,
    failureRate: totalCreated > 0 ? totalFailed / totalCreated : 0,
    meanLatencyMs: peakMeanEmitLatencyMs,
    p95LatencyMs: peakMeanEmitLatencyMs * 3,
    peakActiveConnections: peakTotalListeners,
    leakedConnections: totalLeakedListeners,
    totalRequests: totalCreated,
    throughput,
    heapGrowthBytes: totalHeapBytes,
    memoryPerLeakedResource: closureSizeBytes,
    totalCallbackInvocations,
    meanEmitLatencyMs: peakMeanEmitLatencyMs,
  };
}
