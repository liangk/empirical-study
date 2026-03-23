/**
 * BM-02 Case 1: Leak Probability × Concurrency
 *
 * Shows how unclosed file handles (fs.promises.open without fh.close()) become
 * critical at high parallelism. Mirrors BM-01 Case 1 but for OS file descriptors.
 * X-axis: leak probability (0% to 20%)
 * Y-axis: concurrency (parallel file operations)
 * Metrics: failure rate (EMFILE), time-to-EMFILE, throughput, leaked FDs
 */
import { ExperimentResult, GridCell } from '../types';
import { FDConfig, FDWorkloadConfig, runFDSimulation } from '../fd-simulator';

const CASE_ID = 'bm02-case1';
const CASE_NAME = 'Leak Probability × Concurrency';

const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const concurrencies = [1, 5, 10, 20, 50, 100];

const baseConfig: FDConfig = { fdLimit: 1024, openTimeMs: 5, openTimeJitter: 1, fileSize: 1024 };

export function runBm02Case1(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const conc of concurrencies) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const workload: FDWorkloadConfig = {
        durationMs: 30_000,
        concurrency: conc,
        arrivalIntervalMs: Math.max(1, Math.round(50 / conc)),
        leakProbability: lp,
        errorRate: 0,
        leakOnError: false,
      };
      row.push({
        xParam: lp, yParam: conc,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: `${conc}`,
        result: runFDSimulation(baseConfig, workload),
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
