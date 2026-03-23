import { SimulationResult } from './types';

export type TimerType = 'interval' | 'timeout';

export interface TimerConfig {
  maxHeapBytes: number;
  maxMeanLatencyMs?: number;
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
  const { maxHeapBytes, maxMeanLatencyMs = 50 } = config;
  const { durationMs, creationRatePerSec, leakProbability, closureSizeBytes, timerIntervalMs, timerLifetimeMs, timerType } = workload;

  let leakedTimers = 0;
  let clearedTimers = 0;
  let heapBytes = 0;
  let totalCreated = 0;
  let totalFailed = 0;
  let exhaustionTime = Infinity;
  let totalCallbacks = 0;
  let peakActive = 0;
  let activeLeakedIntervals = 0;
  let peakMeanLatencyMs = 0;

  const arrivalIntervalMs = Math.max(1, Math.round(1000 / creationRatePerSec));
  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  const activeTimers: Array<{ createdAt: number; clearAt: number; leaked: boolean; timerType: TimerType }> = [];

  for (const t of arrivals) {
    for (let i = activeTimers.length - 1; i >= 0; i--) {
      const timer = activeTimers[i];
      if (!timer.leaked && timer.clearAt <= t) {
        activeTimers.splice(i, 1);
        clearedTimers++;
      }
    }

    const currentCallbackRatePerSec = timerType === 'interval' && timerIntervalMs > 0
      ? activeLeakedIntervals * (1000 / timerIntervalMs)
      : 0;
    const currentMeanLatencyMs = Math.min(250, currentCallbackRatePerSec * 0.01);
    if (currentMeanLatencyMs > peakMeanLatencyMs) peakMeanLatencyMs = currentMeanLatencyMs;

    if ((heapBytes >= maxHeapBytes || currentMeanLatencyMs >= maxMeanLatencyMs) && exhaustionTime === Infinity) {
      exhaustionTime = t;
    }
    if (exhaustionTime !== Infinity) {
      totalFailed++;
      continue;
    }

    totalCreated++;
    const isLeak = rng() < leakProbability;

    if (timerType === 'timeout') {
      if (isLeak) {
        activeTimers.push({ createdAt: t, clearAt: Infinity, leaked: true, timerType });
        leakedTimers++;
        heapBytes += closureSizeBytes;
        if (t + timerIntervalMs <= durationMs) totalCallbacks++;
      } else {
        if (t + timerIntervalMs <= durationMs) totalCallbacks++;
        clearedTimers++;
      }
    } else {
      if (isLeak) {
        activeTimers.push({ createdAt: t, clearAt: Infinity, leaked: true, timerType });
        leakedTimers++;
        activeLeakedIntervals++;
        heapBytes += closureSizeBytes;
        const remainingTime = durationMs - t;
        totalCallbacks += Math.floor(remainingTime / Math.max(1, timerIntervalMs));
      } else {
        activeTimers.push({ createdAt: t, clearAt: t + timerLifetimeMs, leaked: false, timerType });
        const activeTime = Math.min(timerLifetimeMs, durationMs - t);
        totalCallbacks += Math.floor(activeTime / Math.max(1, timerIntervalMs));
      }
    }

    const currentActive = activeTimers.filter(timer => timer.leaked).length;
    if (currentActive > peakActive) peakActive = currentActive;
  }

  const successful = totalCreated - totalFailed;
  const throughput = successful / (durationMs / 1000);
  const meanLatencyMs = peakMeanLatencyMs;

  return {
    timeToExhaustion: exhaustionTime,
    successfulRequests: successful,
    failedRequests: totalFailed,
    failureRate: totalCreated > 0 ? totalFailed / totalCreated : 0,
    meanLatencyMs,
    p95LatencyMs: meanLatencyMs * 2,
    peakActiveConnections: peakActive,
    leakedConnections: leakedTimers,
    totalRequests: totalCreated,
    throughput,
    heapGrowthBytes: heapBytes,
    memoryPerLeakedResource: closureSizeBytes,
    totalCallbackInvocations: totalCallbacks,
  };
}
