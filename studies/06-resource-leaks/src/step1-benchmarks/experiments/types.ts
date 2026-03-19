/** Types for the two-dimensional impact experiment framework. */

/** A single data point from one simulation run. */
export interface SimulationResult {
  /** Time (ms) until resource limit hit (EMFILE, pool/socket exhaustion, OOM). Infinity if never. */
  timeToExhaustion: number;
  /** Total requests that completed successfully. */
  successfulRequests: number;
  /** Total requests that failed (timeout, resource exhaustion, EMFILE, etc.). */
  failedRequests: number;
  /** Failure rate = failed / total. */
  failureRate: number;
  /** Mean latency (ms) of successful operations. */
  meanLatencyMs: number;
  /** p95 latency (ms) of successful operations. */
  p95LatencyMs: number;
  /** Peak concurrent resources (connections, FDs, sockets, timers, listeners). */
  peakActiveConnections: number;
  /** Resources permanently leaked (never released/closed/cleared/removed). */
  leakedConnections: number;
  /** Total operations attempted. */
  totalRequests: number;
  /** Effective throughput: successful operations / duration seconds. */
  throughput: number;

  // --- Extended metrics for BM-03, BM-05, BM-06 ---
  /** Simulated heap growth from leaked resource closures/buffers (bytes). */
  heapGrowthBytes?: number;
  /** Memory footprint per leaked resource (bytes). */
  memoryPerLeakedResource?: number;

  // --- BM-05, BM-06: callback fire count ---
  /** Total callback invocations from leaked timers/listeners over simulation duration. */
  totalCallbackInvocations?: number;

  // --- BM-06: emit latency ---
  /** Mean latency (ms) to notify all listeners per event emit. */
  meanEmitLatencyMs?: number;
}

/** A cell in the 2D parameter grid. */
export interface GridCell<X, Y> {
  xParam: X;
  yParam: Y;
  xLabel: string;
  yLabel: string;
  result: SimulationResult;
}

/** Full experiment result for one case. */
export interface ExperimentResult<X = number, Y = number> {
  caseId: string;
  caseName: string;
  xAxisName: string;
  yAxisName: string;
  xValues: X[];
  yValues: Y[];
  grid: GridCell<X, Y>[][];
  metric: string;
  timestamp: string;
}

/** Pool configuration for the configurable simulator. */
export interface PoolConfig {
  maxConnections: number;
  acquireTimeoutMs: number;
  queryTimeMs: number;
  queryTimeJitter: number;
}

/** Workload configuration. */
export interface WorkloadConfig {
  durationMs: number;
  concurrency: number;
  arrivalIntervalMs: number;
  burstSize: number;
  burstIntervalMs: number;
  leakProbability: number;
  errorRate: number;
  leakOnError: boolean;
}
