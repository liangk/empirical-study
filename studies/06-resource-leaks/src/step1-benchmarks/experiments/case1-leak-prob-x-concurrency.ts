/**
 * Case 1: Leak Probability × Concurrency
 *
 * Shows how tiny leak rates become catastrophic at high parallelism.
 * X-axis: leak probability (0% to 20%)
 * Y-axis: concurrency level (1 to 100 concurrent requests)
 * Metric: failure rate, time-to-exhaustion, throughput
 */
import { ExperimentResult, GridCell, PoolConfig, WorkloadConfig } from './types';
import { runSimulation } from './pool-simulator';

const CASE_ID = 'case1';
const CASE_NAME = 'Leak Probability × Concurrency';

const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const concurrencies = [1, 5, 10, 20, 50, 100];

const basePool: PoolConfig = { maxConnections: 20, acquireTimeoutMs: 500, queryTimeMs: 50, queryTimeJitter: 10 };
const baseWorkload: Omit<WorkloadConfig, 'leakProbability' | 'concurrency'> = {
  durationMs: 30_000, arrivalIntervalMs: 10, burstSize: 1, burstIntervalMs: 0, errorRate: 0, leakOnError: false,
};

export function runCase1(): ExperimentResult {
  const grid: GridCell<number, number>[][] = [];

  for (const conc of concurrencies) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const workload: WorkloadConfig = {
        ...baseWorkload,
        leakProbability: lp,
        concurrency: conc,
        arrivalIntervalMs: Math.max(1, Math.round(50 / conc)),
      };
      const result = runSimulation(basePool, workload);
      row.push({
        xParam: lp,
        yParam: conc,
        xLabel: `${(lp * 100).toFixed(0)}%`,
        yLabel: `${conc}`,
        result,
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID,
    caseName: CASE_NAME,
    xAxisName: 'Leak Probability',
    yAxisName: 'Concurrency',
    xValues: leakProbs,
    yValues: concurrencies,
    grid,
    metric: 'failureRate',
    timestamp: new Date().toISOString(),
  };
}
