/**
 * BM-03 Case 1: Leak Probability × Concurrency
 *
 * Shows how createReadStream without stream.destroy() on error paths scales with parallelism.
 * Each leaked stream holds an open FD AND buffers up to 64KB in memory.
 * Dual failure mode: EMFILE (FD exhaustion) or OOM (memory exhaustion).
 * X-axis: leak probability (0% to 20%)
 * Y-axis: concurrent stream operations
 * Metrics: failure rate, time-to-exhaustion, leaked streams, heap growth
 */
import { ExperimentResult, GridCell } from '../types';
import { StreamConfig, StreamWorkloadConfig, runStreamSimulation } from '../stream-simulator';

const CASE_ID = 'bm03-case1';
const CASE_NAME = 'Leak Probability × Concurrency';

const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const concurrencies = [1, 5, 10, 20, 50, 100];

const baseConfig: StreamConfig = { fdLimit: 1024, maxHeapBytes: 512 * 1024 * 1024, streamTimeMs: 10, streamTimeJitter: 2 };

export function runBm03Case1(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const conc of concurrencies) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const workload: StreamWorkloadConfig = {
        durationMs: 30_000, concurrency: conc,
        arrivalIntervalMs: Math.max(1, Math.round(50 / conc)),
        leakProbability: lp, errorRate: 0, destroyOnError: true,
        fileSize: 65_536, streamType: 'read',
      };
      row.push({
        xParam: lp, yParam: conc,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: `${conc}`,
        result: runStreamSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Concurrency',
    xValues: leakProbs, yValues: concurrencies,
    grid, metric: 'failureRate', timestamp: new Date().toISOString(),
  };
}
