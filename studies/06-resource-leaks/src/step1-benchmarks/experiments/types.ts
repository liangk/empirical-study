/** Types for the two-dimensional impact experiment framework. */

/** A single data point from one simulation run. */
export interface SimulationResult {
  /** Time (ms) until pool exhaustion. Infinity if no exhaustion within duration. */
  timeToExhaustion: number;
  /** Total requests that completed successfully. */
  successfulRequests: number;
  /** Total requests that timed out or failed due to pool exhaustion. */
  failedRequests: number;
  /** Failure rate = failed / (successful + failed). */
  failureRate: number;
  /** Mean latency (ms) of successful requests. */
  meanLatencyMs: number;
  /** p95 latency (ms) of successful requests. */
  p95LatencyMs: number;
  /** Peak active connections during the simulation. */
  peakActiveConnections: number;
  /** Connections leaked (acquired but never released). */
  leakedConnections: number;
  /** Total requests attempted. */
  totalRequests: number;
  /** Effective throughput: successful requests / duration seconds. */
  throughput: number;
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
