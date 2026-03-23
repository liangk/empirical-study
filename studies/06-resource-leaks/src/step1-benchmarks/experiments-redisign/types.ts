/** Types for the redesigned two-dimensional impact experiment framework. */

export interface SimulationResult {
  timeToExhaustion: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  meanLatencyMs: number;
  p95LatencyMs: number;
  peakActiveConnections: number;
  leakedConnections: number;
  totalRequests: number;
  throughput: number;
  heapGrowthBytes?: number;
  memoryPerLeakedResource?: number;
  totalCallbackInvocations?: number;
  meanEmitLatencyMs?: number;
}

export interface GridCell<X, Y> {
  xParam: X;
  yParam: Y;
  xLabel: string;
  yLabel: string;
  result: SimulationResult;
}

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

export interface PoolConfig {
  maxConnections: number;
  acquireTimeoutMs: number;
  queryTimeMs: number;
  queryTimeJitter: number;
}

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
