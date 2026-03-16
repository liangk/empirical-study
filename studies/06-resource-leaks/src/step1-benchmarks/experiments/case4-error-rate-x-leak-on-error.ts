/**
 * Case 4: Error Rate × Leak-on-Error Behavior
 *
 * Shows how error frequency interacts with cleanup-on-error patterns.
 * X-axis: error rate (0% to 30%)
 * Y-axis: leak-on-error behavior (boolean: true = leaked, false = properly released)
 *         + base leak probability (0%, 2%, 5%, 10%)
 * Combined Y: (leakOnError, baseLeakProb) — 8 combinations
 * Metric: leaked connections, failure rate, time-to-exhaustion
 */
import { ExperimentResult, GridCell, PoolConfig, WorkloadConfig } from './types';
import { runSimulation } from './pool-simulator';

const CASE_ID = 'case4';
const CASE_NAME = 'Error Rate × Leak-on-Error Behavior';

const errorRates = [0, 0.01, 0.05, 0.10, 0.15, 0.20, 0.30];

interface LeakBehavior { leakOnError: boolean; baseLeakProb: number; label: string; }
const leakBehaviors: LeakBehavior[] = [
  { leakOnError: false, baseLeakProb: 0,    label: 'cleanup+0%leak' },
  { leakOnError: false, baseLeakProb: 0.02, label: 'cleanup+2%leak' },
  { leakOnError: false, baseLeakProb: 0.05, label: 'cleanup+5%leak' },
  { leakOnError: false, baseLeakProb: 0.10, label: 'cleanup+10%leak' },
  { leakOnError: true,  baseLeakProb: 0,    label: 'no-cleanup+0%leak' },
  { leakOnError: true,  baseLeakProb: 0.02, label: 'no-cleanup+2%leak' },
  { leakOnError: true,  baseLeakProb: 0.05, label: 'no-cleanup+5%leak' },
  { leakOnError: true,  baseLeakProb: 0.10, label: 'no-cleanup+10%leak' },
];

const basePool: PoolConfig = { maxConnections: 20, acquireTimeoutMs: 500, queryTimeMs: 50, queryTimeJitter: 10 };

export function runCase4(): ExperimentResult<number, string> {
  const grid: GridCell<number, string>[][] = [];

  for (const lb of leakBehaviors) {
    const row: GridCell<number, string>[] = [];
    for (const er of errorRates) {
      const workload: WorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        burstSize: 1, burstIntervalMs: 0,
        leakProbability: lb.baseLeakProb, errorRate: er, leakOnError: lb.leakOnError,
      };
      const result = runSimulation(basePool, workload);
      row.push({
        xParam: er,
        yParam: lb.label,
        xLabel: `${(er * 100).toFixed(0)}%`,
        yLabel: lb.label,
        result,
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID,
    caseName: CASE_NAME,
    xAxisName: 'Error Rate',
    yAxisName: 'Leak-on-Error Behavior',
    xValues: errorRates,
    yValues: leakBehaviors.map(lb => lb.label),
    grid,
    metric: 'leakedConnections',
    timestamp: new Date().toISOString(),
  };
}
