import { SimulationResult } from './types';

/**
 * BM-04: HTTP Socket Leak Simulator.
 * Models http.request() / https.request() without req.destroy() on error/timeout paths.
 * Tracks socket accumulation and the interaction between timeout duration and failure latency.
 * Keep-alive mode changes socket lifecycle: connections persist across requests (pooled),
 * meaning leaks reduce the effective pool rather than accumulating unboundedly.
 */

export interface SocketConfig {
  maxSockets: number;
  responseTimeMs: number;
  responseTimeJitter: number;
}

export interface SocketWorkloadConfig {
  durationMs: number;
  concurrency: number;
  arrivalIntervalMs: number;
  timeoutMs: number;
  leakProbability: number;
  errorRate: number;
  destroyOnError: boolean;
  responseSize: number;
  keepAlive: boolean;
}

interface ActiveSocket { id: number; acquiredAt: number; releaseAt: number; leaked: boolean; }
interface PendingRequest { id: number; arrivedAt: number; timeoutAt: number; }
interface CompletedRequest { id: number; arrivedAt: number; startedAt: number; completedAt: number; success: boolean; timedOut: boolean; }

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runSocketSimulation(config: SocketConfig, workload: SocketWorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { maxSockets, responseTimeMs, responseTimeJitter } = config;
  const { durationMs, arrivalIntervalMs, timeoutMs, leakProbability, errorRate, destroyOnError, responseSize, keepAlive } = workload;

  const activeSockets: ActiveSocket[] = [];
  const waitQueue: PendingRequest[] = [];
  const completed: CompletedRequest[] = [];

  let socketIdSeq = 0;
  let reqIdSeq = 0;
  let peakSockets = 0;
  let totalLeaked = 0;
  let exhaustionTime = Infinity;

  // With keep-alive, each response adds a small overhead for the keep-alive overhead
  const keepAliveOverhead = keepAlive ? Math.min(responseTimeMs * 0.1, 5) : 0;

  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  for (const arrivalTime of arrivals) {
    releaseFinished(arrivalTime);
    expireWaiters(arrivalTime);

    const reqId = reqIdSeq++;

    if (activeSockets.length < maxSockets) {
      const isError = rng() < errorRate;
      const isLeak = rng() < leakProbability;
      const actualResponseTime = Math.max(1, responseTimeMs + (rng() - 0.5) * 2 * responseTimeJitter + keepAliveOverhead);
      const socketId = socketIdSeq++;

      if (isError) {
        const leaksOnError = !destroyOnError || isLeak;
        if (leaksOnError) {
          activeSockets.push({ id: socketId, acquiredAt: arrivalTime, releaseAt: Infinity, leaked: true });
          totalLeaked++;
        } else {
          activeSockets.push({ id: socketId, acquiredAt: arrivalTime, releaseAt: arrivalTime + 1, leaked: false });
        }
        completed.push({ id: reqId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + 1, success: false, timedOut: false });
      } else if (isLeak) {
        activeSockets.push({ id: socketId, acquiredAt: arrivalTime, releaseAt: Infinity, leaked: true });
        totalLeaked++;
        completed.push({ id: reqId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualResponseTime, success: true, timedOut: false });
      } else {
        // With keep-alive: socket returns to pool after response but stays open briefly
        const socketReleaseTime = keepAlive ? arrivalTime + actualResponseTime + 2000 : arrivalTime + actualResponseTime;
        activeSockets.push({ id: socketId, acquiredAt: arrivalTime, releaseAt: socketReleaseTime, leaked: false });
        completed.push({ id: reqId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualResponseTime, success: true, timedOut: false });
      }

      if (activeSockets.length > peakSockets) peakSockets = activeSockets.length;
      if (activeSockets.length >= maxSockets && exhaustionTime === Infinity) exhaustionTime = arrivalTime;
    } else {
      // Socket limit — queue with acquire timeout
      waitQueue.push({ id: reqId, arrivedAt: arrivalTime, timeoutAt: arrivalTime + timeoutMs });
    }

    serveWaiters(arrivalTime);
  }

  const endTime = durationMs;
  releaseFinished(endTime);
  expireWaiters(endTime);
  serveWaiters(endTime);
  for (const w of waitQueue) {
    completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: endTime, success: false, timedOut: true });
  }

  const successful = completed.filter(r => r.success);
  const failed = completed.filter(r => !r.success);
  const latencies = successful.map(r => r.completedAt - r.arrivedAt);
  latencies.sort((a, b) => a - b);

  return {
    timeToExhaustion: exhaustionTime,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    failureRate: completed.length > 0 ? failed.length / completed.length : 0,
    meanLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p95LatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] ?? 0 : 0,
    peakActiveConnections: peakSockets,
    leakedConnections: totalLeaked,
    totalRequests: completed.length,
    throughput: successful.length / (durationMs / 1000),
  };

  function releaseFinished(now: number): void {
    for (let i = activeSockets.length - 1; i >= 0; i--) {
      if (!activeSockets[i].leaked && activeSockets[i].releaseAt <= now) activeSockets.splice(i, 1);
    }
  }

  function expireWaiters(now: number): void {
    for (let i = waitQueue.length - 1; i >= 0; i--) {
      if (waitQueue[i].timeoutAt <= now) {
        const w = waitQueue.splice(i, 1)[0];
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: now, success: false, timedOut: true });
      }
    }
  }

  function serveWaiters(now: number): void {
    while (waitQueue.length > 0 && activeSockets.length < maxSockets) {
      const w = waitQueue.shift()!;
      if (w.timeoutAt <= now) {
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: now, success: false, timedOut: true });
        continue;
      }
      const isError = rng() < errorRate;
      const isLeak = rng() < leakProbability;
      const actualResponseTime = Math.max(1, responseTimeMs + (rng() - 0.5) * 2 * responseTimeJitter + keepAliveOverhead);
      const socketId = socketIdSeq++;

      if (isError) {
        const leaksOnError = !destroyOnError || isLeak;
        if (leaksOnError) {
          activeSockets.push({ id: socketId, acquiredAt: now, releaseAt: Infinity, leaked: true });
          totalLeaked++;
        } else {
          activeSockets.push({ id: socketId, acquiredAt: now, releaseAt: now + 1, leaked: false });
        }
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + 1, success: false, timedOut: false });
      } else if (isLeak) {
        activeSockets.push({ id: socketId, acquiredAt: now, releaseAt: Infinity, leaked: true });
        totalLeaked++;
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + actualResponseTime, success: true, timedOut: false });
      } else {
        const socketReleaseTime = keepAlive ? now + actualResponseTime + 2000 : now + actualResponseTime;
        activeSockets.push({ id: socketId, acquiredAt: now, releaseAt: socketReleaseTime, leaked: false });
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + actualResponseTime, success: true, timedOut: false });
      }

      if (activeSockets.length > peakSockets) peakSockets = activeSockets.length;
      if (activeSockets.length >= maxSockets && exhaustionTime === Infinity) exhaustionTime = now;
    }
  }
}
