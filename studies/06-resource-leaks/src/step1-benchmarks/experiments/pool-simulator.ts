import { PoolConfig, WorkloadConfig, SimulationResult } from './types';

/**
 * Configurable connection pool simulator.
 * Simulates async request/response cycles with controllable leak, error, and timing behavior.
 * Uses discrete-event simulation (no real async delays) for fast execution.
 */

interface Connection { id: number; acquiredAt: number; releaseAt: number; leaked: boolean; }

interface PendingRequest { id: number; arrivedAt: number; timeoutAt: number; }

interface CompletedRequest { id: number; arrivedAt: number; startedAt: number; completedAt: number; success: boolean; timedOut: boolean; }

/** Seeded PRNG for reproducibility. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runSimulation(pool: PoolConfig, workload: WorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { maxConnections, acquireTimeoutMs, queryTimeMs, queryTimeJitter } = pool;
  const { durationMs, concurrency, arrivalIntervalMs, burstSize, burstIntervalMs, leakProbability, errorRate, leakOnError } = workload;

  const activeConns: Connection[] = [];
  const waitQueue: PendingRequest[] = [];
  const completed: CompletedRequest[] = [];

  let time = 0;
  let connIdSeq = 0;
  let reqIdSeq = 0;
  let peakActive = 0;
  let totalLeaked = 0;
  let exhaustionTime = Infinity;

  // Generate arrival schedule
  const arrivals: number[] = [];
  if (burstSize > 1 && burstIntervalMs > 0) {
    // Burst mode: emit burstSize requests every burstIntervalMs
    for (let t = 0; t < durationMs; t += burstIntervalMs) {
      for (let b = 0; b < burstSize; b++) arrivals.push(t);
    }
  } else {
    // Steady mode: one request every arrivalIntervalMs, up to concurrency in flight
    for (let t = 0; t < durationMs; t += arrivalIntervalMs) {
      arrivals.push(t);
    }
  }

  // Discrete event loop
  for (const arrivalTime of arrivals) {
    time = arrivalTime;

    // Release connections whose query is done
    releaseFinished(time);

    // Expire timed-out waiters
    expireWaiters(time);

    // Try to acquire a connection for this request
    const reqId = reqIdSeq++;

    if (activeConns.length < maxConnections) {
      // Connection available
      const isError = rng() < errorRate;
      const isLeak = rng() < leakProbability;
      const actualQueryTime = Math.max(1, queryTimeMs + (rng() - 0.5) * 2 * queryTimeJitter);
      const connId = connIdSeq++;

      if (isError) {
        // Query fails — connection may or may not be released depending on leakOnError
        if (leakOnError || isLeak) {
          // Leak: connection stays active forever (releaseAt = Infinity)
          activeConns.push({ id: connId, acquiredAt: time, releaseAt: Infinity, leaked: true });
          totalLeaked++;
        } else {
          // Proper error handling: connection released after short delay
          activeConns.push({ id: connId, acquiredAt: time, releaseAt: time + 1, leaked: false });
        }
        completed.push({ id: reqId, arrivedAt: time, startedAt: time, completedAt: time + 1, success: false, timedOut: false });
      } else if (isLeak) {
        // Successful query but connection leaked
        activeConns.push({ id: connId, acquiredAt: time, releaseAt: Infinity, leaked: true });
        totalLeaked++;
        completed.push({ id: reqId, arrivedAt: time, startedAt: time, completedAt: time + actualQueryTime, success: true, timedOut: false });
      } else {
        // Normal: acquire, query, release
        activeConns.push({ id: connId, acquiredAt: time, releaseAt: time + actualQueryTime, leaked: false });
        completed.push({ id: reqId, arrivedAt: time, startedAt: time, completedAt: time + actualQueryTime, success: true, timedOut: false });
      }

      if (activeConns.length > peakActive) peakActive = activeConns.length;
      if (activeConns.length >= maxConnections && exhaustionTime === Infinity) {
        exhaustionTime = time;
      }
    } else {
      // Pool full — add to wait queue
      waitQueue.push({ id: reqId, arrivedAt: time, timeoutAt: time + acquireTimeoutMs });
    }

    // Try to serve waiters from released connections
    serveWaiters(time);
  }

  // Final cleanup pass
  time = durationMs;
  releaseFinished(time);
  expireWaiters(time);
  serveWaiters(time);

  // Any remaining waiters fail
  for (const w of waitQueue) {
    completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: time, success: false, timedOut: true });
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
    p95LatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
    peakActiveConnections: peakActive,
    leakedConnections: totalLeaked,
    totalRequests: completed.length,
    throughput: successful.length / (durationMs / 1000),
  };

  function releaseFinished(now: number): void {
    for (let i = activeConns.length - 1; i >= 0; i--) {
      if (!activeConns[i].leaked && activeConns[i].releaseAt <= now) {
        activeConns.splice(i, 1);
      }
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
    while (waitQueue.length > 0 && activeConns.length < maxConnections) {
      const w = waitQueue.shift()!;
      if (w.timeoutAt <= now) {
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: now, success: false, timedOut: true });
        continue;
      }
      const isError = rng() < errorRate;
      const isLeak = rng() < leakProbability;
      const actualQueryTime = Math.max(1, queryTimeMs + (rng() - 0.5) * 2 * queryTimeJitter);
      const connId = connIdSeq++;

      if (isError) {
        if (leakOnError || isLeak) {
          activeConns.push({ id: connId, acquiredAt: now, releaseAt: Infinity, leaked: true });
          totalLeaked++;
        } else {
          activeConns.push({ id: connId, acquiredAt: now, releaseAt: now + 1, leaked: false });
        }
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + 1, success: false, timedOut: false });
      } else if (isLeak) {
        activeConns.push({ id: connId, acquiredAt: now, releaseAt: Infinity, leaked: true });
        totalLeaked++;
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + actualQueryTime, success: true, timedOut: false });
      } else {
        activeConns.push({ id: connId, acquiredAt: now, releaseAt: now + actualQueryTime, leaked: false });
        completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: now, completedAt: now + actualQueryTime, success: true, timedOut: false });
      }

      if (activeConns.length > peakActive) peakActive = activeConns.length;
      if (activeConns.length >= maxConnections && exhaustionTime === Infinity) {
        exhaustionTime = now;
      }
    }
  }
}
