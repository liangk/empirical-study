import { SimulationResult } from './types';

/**
 * BM-02: File Descriptor Exhaustion Simulator.
 * Models fs.promises.open() calls without fh.close() leaking OS file descriptors.
 * Simulates EMFILE (Too many open files) when fdLimit is reached.
 */

export interface FDConfig {
  fdLimit: number;
  openTimeMs: number;
  openTimeJitter: number;
  fileSize: number;
}

export interface FDWorkloadConfig {
  durationMs: number;
  concurrency: number;
  arrivalIntervalMs: number;
  leakProbability: number;
  errorRate: number;
  leakOnError: boolean;
}

interface OpenFD { id: number; openedAt: number; closeAt: number; leaked: boolean; }
interface PendingOp { id: number; arrivedAt: number; }
interface CompletedOp { id: number; arrivedAt: number; startedAt: number; completedAt: number; success: boolean; }

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runFDSimulation(config: FDConfig, workload: FDWorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { fdLimit, openTimeMs, openTimeJitter, fileSize } = config;
  const { durationMs, arrivalIntervalMs, leakProbability, errorRate, leakOnError } = workload;

  const openFDs: OpenFD[] = [];
  const waitQueue: PendingOp[] = [];
  const completed: CompletedOp[] = [];

  let fdIdSeq = 0;
  let opIdSeq = 0;
  let peakFDs = 0;
  let totalLeaked = 0;
  let exhaustionTime = Infinity;

  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  for (const arrivalTime of arrivals) {
    releaseFinished(arrivalTime);

    const opId = opIdSeq++;

    if (openFDs.length < fdLimit) {
      const isError = rng() < errorRate;
      const isLeak = rng() < leakProbability;
      const actualOpenTime = Math.max(1, openTimeMs + (rng() - 0.5) * 2 * openTimeJitter);
      const fdId = fdIdSeq++;

      if (isError) {
        if (leakOnError || isLeak) {
          openFDs.push({ id: fdId, openedAt: arrivalTime, closeAt: Infinity, leaked: true });
          totalLeaked++;
        } else {
          openFDs.push({ id: fdId, openedAt: arrivalTime, closeAt: arrivalTime + 1, leaked: false });
        }
        completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + 1, success: false });
      } else if (isLeak) {
        openFDs.push({ id: fdId, openedAt: arrivalTime, closeAt: Infinity, leaked: true });
        totalLeaked++;
        completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualOpenTime, success: true });
      } else {
        openFDs.push({ id: fdId, openedAt: arrivalTime, closeAt: arrivalTime + actualOpenTime, leaked: false });
        completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualOpenTime, success: true });
      }

      if (openFDs.length > peakFDs) peakFDs = openFDs.length;
      if (openFDs.length >= fdLimit && exhaustionTime === Infinity) exhaustionTime = arrivalTime;
    } else {
      // EMFILE: file descriptor limit reached
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: -1, completedAt: arrivalTime, success: false });
    }
  }

  // Drain queue
  releaseFinished(durationMs);
  for (const w of waitQueue) {
    completed.push({ id: w.id, arrivedAt: w.arrivedAt, startedAt: -1, completedAt: durationMs, success: false });
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
    peakActiveConnections: peakFDs,
    leakedConnections: totalLeaked,
    totalRequests: completed.length,
    throughput: successful.length / (durationMs / 1000),
    heapGrowthBytes: totalLeaked * fileSize,
    memoryPerLeakedResource: fileSize,
  };

  function releaseFinished(now: number): void {
    for (let i = openFDs.length - 1; i >= 0; i--) {
      if (!openFDs[i].leaked && openFDs[i].closeAt <= now) openFDs.splice(i, 1);
    }
  }
}
