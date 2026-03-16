/**
 * Case 5: Leak Probability × DB Max Connections
 *
 * Shows cross-service blast radius: how one leaking service exhausts shared DB budget.
 * X-axis: leak probability (0% to 20%)
 * Y-axis: DB max connections (5 to 200)
 * Fixed: concurrency 20, query time 50ms
 * Metric: time-to-exhaustion, failure rate, leaked connections
 */
import { ExperimentResult, GridCell, PoolConfig, WorkloadConfig } from './types';
import { runSimulation } from './pool-simulator';

const CASE_ID = 'case5';
const CASE_NAME = 'Leak Probability × DB Max Connections';

const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const maxConns = [5, 10, 20, 50, 100, 200];

const baseWorkload: WorkloadConfig = {
  durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
  burstSize: 1, burstIntervalMs: 0,
  leakProbability: 0, errorRate: 0, leakOnError: false,
};

export function runCase5(): ExperimentResult {
  const grid: GridCell<number, number>[][] = [];

  for (const mc of maxConns) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const pool: PoolConfig = { maxConnections: mc, acquireTimeoutMs: 500, queryTimeMs: 50, queryTimeJitter: 10 };
      const workload: WorkloadConfig = { ...baseWorkload, leakProbability: lp };
      const result = runSimulation(pool, workload);
      row.push({
        xParam: lp,
        yParam: mc,
        xLabel: `${(lp * 100).toFixed(0)}%`,
        yLabel: `${mc}`,
        result,
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID,
    caseName: CASE_NAME,
    xAxisName: 'Leak Probability',
    yAxisName: 'DB Max Connections',
    xValues: leakProbs,
    yValues: maxConns,
    grid,
    metric: 'timeToExhaustion',
    timestamp: new Date().toISOString(),
  };
}
