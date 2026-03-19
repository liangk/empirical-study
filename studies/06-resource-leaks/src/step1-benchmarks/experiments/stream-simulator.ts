import { SimulationResult } from './types';

/**
 * BM-03: Stream Leak Simulator.
 * Models createReadStream / createWriteStream / pipeline without stream.destroy() on error paths.
 * Tracks dual failure modes: EMFILE (FD exhaustion) and OOM (memory accumulation).
 * Each leaked stream holds an open FD AND buffers data in memory.
 */

export type StreamType = 'read' | 'write' | 'transform';

export interface StreamConfig {
  fdLimit: number;
  maxHeapBytes: number;
  streamTimeMs: number;
  streamTimeJitter: number;
}

export interface StreamWorkloadConfig {
  durationMs: number;
  concurrency: number;
  arrivalIntervalMs: number;
  leakProbability: number;
  errorRate: number;
  destroyOnError: boolean;
  fileSize: number;
  streamType: StreamType;
}

interface OpenStream { id: number; openedAt: number; closeAt: number; leaked: boolean; memoryBytes: number; }
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

/** Memory buffered per stream type. ReadStream buffers up to 64KB high-watermark by default. */
function streamMemoryFootprint(fileSize: number, streamType: StreamType): number {
  if (streamType === 'read') return Math.min(fileSize, 65536);
  if (streamType === 'write') return Math.min(fileSize, 16384);
  return Math.min(fileSize, 65536) + Math.min(fileSize, 16384); // transform buffers both sides
}

export function runStreamSimulation(config: StreamConfig, workload: StreamWorkloadConfig, seed = 42): SimulationResult {
  const rng = mulberry32(seed);
  const { fdLimit, maxHeapBytes, streamTimeMs, streamTimeJitter } = config;
  const { durationMs, arrivalIntervalMs, leakProbability, errorRate, destroyOnError, fileSize, streamType } = workload;

  const openStreams: OpenStream[] = [];
  const completed: CompletedOp[] = [];

  let streamIdSeq = 0;
  let opIdSeq = 0;
  let peakOpen = 0;
  let totalLeaked = 0;
  let totalLeakedMemory = 0;
  let exhaustionTime = Infinity; // First: EMFILE or OOM, whichever comes first
  let exhaustionReason: 'emfile' | 'oom' | null = null;

  const memPerLeak = streamMemoryFootprint(fileSize, streamType);
  const arrivals: number[] = [];
  for (let t = 0; t < durationMs; t += arrivalIntervalMs) arrivals.push(t);

  for (const arrivalTime of arrivals) {
    releaseFinished(arrivalTime);

    const currentHeap = totalLeakedMemory;
    const opId = opIdSeq++;

    // Check both limits
    if (openStreams.length >= fdLimit) {
      if (exhaustionTime === Infinity) { exhaustionTime = arrivalTime; exhaustionReason = 'emfile'; }
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: -1, completedAt: arrivalTime, success: false });
      continue;
    }
    if (currentHeap >= maxHeapBytes) {
      if (exhaustionTime === Infinity) { exhaustionTime = arrivalTime; exhaustionReason = 'oom'; }
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: -1, completedAt: arrivalTime, success: false });
      continue;
    }

    const isError = rng() < errorRate;
    const isLeak = rng() < leakProbability;
    const actualStreamTime = Math.max(1, streamTimeMs + (rng() - 0.5) * 2 * streamTimeJitter);
    const streamId = streamIdSeq++;

    if (isError) {
      const leaksOnError = !destroyOnError || isLeak;
      if (leaksOnError) {
        openStreams.push({ id: streamId, openedAt: arrivalTime, closeAt: Infinity, leaked: true, memoryBytes: memPerLeak });
        totalLeaked++;
        totalLeakedMemory += memPerLeak;
      } else {
        openStreams.push({ id: streamId, openedAt: arrivalTime, closeAt: arrivalTime + 1, leaked: false, memoryBytes: 0 });
      }
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + 1, success: false });
    } else if (isLeak) {
      openStreams.push({ id: streamId, openedAt: arrivalTime, closeAt: Infinity, leaked: true, memoryBytes: memPerLeak });
      totalLeaked++;
      totalLeakedMemory += memPerLeak;
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualStreamTime, success: true });
    } else {
      openStreams.push({ id: streamId, openedAt: arrivalTime, closeAt: arrivalTime + actualStreamTime, leaked: false, memoryBytes: 0 });
      completed.push({ id: opId, arrivedAt: arrivalTime, startedAt: arrivalTime, completedAt: arrivalTime + actualStreamTime, success: true });
    }

    if (openStreams.length > peakOpen) peakOpen = openStreams.length;
  }

  releaseFinished(durationMs);

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
    peakActiveConnections: peakOpen,
    leakedConnections: totalLeaked,
    totalRequests: completed.length,
    throughput: successful.length / (durationMs / 1000),
    heapGrowthBytes: totalLeakedMemory,
    memoryPerLeakedResource: memPerLeak,
  };

  function releaseFinished(now: number): void {
    for (let i = openStreams.length - 1; i >= 0; i--) {
      if (!openStreams[i].leaked && openStreams[i].closeAt <= now) openStreams.splice(i, 1);
    }
  }
}
