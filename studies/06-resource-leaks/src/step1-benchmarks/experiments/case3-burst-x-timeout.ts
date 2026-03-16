/**
 * Case 3: Burst Size × Acquire Timeout
 *
 * Shows whether traffic spikes cause latency degradation or hard failures.
 * X-axis: burst size (1 to 50 simultaneous requests per burst)
 * Y-axis: acquire timeout (50ms to 5000ms)
 * Fixed: pool size 20, 5% leak probability, bursts every 200ms
 * Metric: p95 latency, failure rate
 */
import { ExperimentResult, GridCell, PoolConfig, WorkloadConfig } from './types';
import { runSimulation } from './pool-simulator';

const CASE_ID = 'case3';
const CASE_NAME = 'Burst Size × Acquire Timeout';

const burstSizes = [1, 5, 10, 20, 30, 50];
const acquireTimeouts = [50, 100, 500, 1000, 2000, 5000];

const basePool: Omit<PoolConfig, 'acquireTimeoutMs'> = { maxConnections: 20, queryTimeMs: 50, queryTimeJitter: 10 };

export function runCase3(): ExperimentResult {
  const grid: GridCell<number, number>[][] = [];

  for (const at of acquireTimeouts) {
    const row: GridCell<number, number>[] = [];
    for (const bs of burstSizes) {
      const pool: PoolConfig = { ...basePool, acquireTimeoutMs: at };
      const workload: WorkloadConfig = {
        durationMs: 30_000, concurrency: bs, arrivalIntervalMs: 10,
        burstSize: bs, burstIntervalMs: 200,
        leakProbability: 0.05, errorRate: 0, leakOnError: false,
      };
      const result = runSimulation(pool, workload);
      row.push({
        xParam: bs,
        yParam: at,
        xLabel: `${bs}`,
        yLabel: `${at}ms`,
        result,
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID,
    caseName: CASE_NAME,
    xAxisName: 'Burst Size',
    yAxisName: 'Acquire Timeout (ms)',
    xValues: burstSizes,
    yValues: acquireTimeouts,
    grid,
    metric: 'p95LatencyMs',
    timestamp: new Date().toISOString(),
  };
}
