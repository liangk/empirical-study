/**
 * BM-02 Case 4: Open Rate × FD Limit
 *
 * Explores how sustained file operation rates exhaust different ulimit configurations.
 * Unlike Case 1 (concurrency), this tests throughput-based exhaustion:
 * higher open rates create more FDs per second, hitting limits faster.
 * X-axis: file open rate (operations per second)
 * Y-axis: FD limit / ulimit
 * Fixed: 5% leak probability, 30s duration
 * Metrics: time-to-EMFILE, failure rate, throughput, leaked FDs
 */
import { ExperimentResult, GridCell } from '../types';
import { FDConfig, FDWorkloadConfig, runFDSimulation } from '../fd-simulator';

const CASE_ID = 'bm02-case4';
const CASE_NAME = 'Open Rate × FD Limit';

const openRatesPerSec = [10, 50, 100, 200, 500, 1000];
const fdLimits = [64, 128, 256, 512, 1024, 4096];

export function runBm02Case4(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const fdLimit of fdLimits) {
    const row: GridCell<number, number>[] = [];
    for (const rate of openRatesPerSec) {
      const arrivalIntervalMs = Math.max(1, Math.round(1000 / rate));
      const config: FDConfig = { fdLimit, openTimeMs: 5, openTimeJitter: 1, fileSize: 1024 };
      const workload: FDWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs,
        leakProbability: 0.05, errorRate: 0, leakOnError: false,
      };
      row.push({
        xParam: rate, yParam: fdLimit,
        xLabel: `${rate}/s`, yLabel: `${fdLimit}`,
        result: runFDSimulation(config, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Open Rate (ops/sec)', yAxisName: 'FD Limit (ulimit)',
    xValues: openRatesPerSec, yValues: fdLimits,
    grid, metric: 'timeToExhaustion', timestamp: new Date().toISOString(),
  };
}
