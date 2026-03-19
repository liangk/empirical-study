/**
 * Case 2: Query Time × Pool Size
 *
 * Shows when long-held connections saturate the pool even with moderate leak rates.
 * X-axis: query time (5ms to 1000ms)
 * Y-axis: pool size (5 to 100)
 * Fixed: 5% leak probability, concurrency 20
 * Metric: throughput, failure rate
 */
import { ExperimentResult, GridCell, PoolConfig, WorkloadConfig } from '../types';
import { runSimulation } from '../pool-simulator';

const CASE_ID = 'case2';
const CASE_NAME = 'Query Time × Pool Size';

const queryTimes = [5, 20, 50, 100, 200, 500, 1000];
const poolSizes = [5, 10, 20, 50, 100];

const baseWorkload: Omit<WorkloadConfig, 'concurrency'> & { concurrency: number } = {
  durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5, burstSize: 1, burstIntervalMs: 0,
  leakProbability: 0.05, errorRate: 0, leakOnError: false,
};

export function runCase2(): ExperimentResult {
  const grid: GridCell<number, number>[][] = [];

  for (const ps of poolSizes) {
    const row: GridCell<number, number>[] = [];
    for (const qt of queryTimes) {
      const pool: PoolConfig = { maxConnections: ps, acquireTimeoutMs: 500, queryTimeMs: qt, queryTimeJitter: qt * 0.2 };
      const result = runSimulation(pool, baseWorkload);
      row.push({
        xParam: qt,
        yParam: ps,
        xLabel: `${qt}ms`,
        yLabel: `${ps}`,
        result,
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID,
    caseName: CASE_NAME,
    xAxisName: 'Query Time (ms)',
    yAxisName: 'Pool Size',
    xValues: queryTimes,
    yValues: poolSizes,
    grid,
    metric: 'throughput',
    timestamp: new Date().toISOString(),
  };
}
