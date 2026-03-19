/**
 * BM-02 Case 2: File Size × FD Limit (ulimit)
 *
 * Explores whether large files cause OOM before EMFILE.
 * Small files: each leaked FD is tiny (1KB); FD count is the bottleneck.
 * Large files: each leaked FD holds 1MB+ in memory; OOM arrives before EMFILE.
 * X-axis: file size (1KB to 100MB)
 * Y-axis: FD limit / ulimit (64 to 4096)
 * Metrics: time-to-EMFILE, heap growth from leaked FDs, throughput
 */
import { ExperimentResult, GridCell } from '../types';
import { FDConfig, FDWorkloadConfig, runFDSimulation } from '../fd-simulator';

const CASE_ID = 'bm02-case2';
const CASE_NAME = 'File Size × FD Limit';

const fileSizes = [1_024, 10_240, 102_400, 1_048_576, 10_485_760, 104_857_600];
const fdLimits = [64, 128, 256, 512, 1024, 4096];

const baseWorkload: FDWorkloadConfig = {
  durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
  leakProbability: 0.05, errorRate: 0, leakOnError: false,
};

export function runBm02Case2(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const fdLimit of fdLimits) {
    const row: GridCell<number, number>[] = [];
    for (const fileSize of fileSizes) {
      const config: FDConfig = { fdLimit, openTimeMs: 5, openTimeJitter: 1, fileSize };
      const workload: FDWorkloadConfig = { ...baseWorkload };
      row.push({
        xParam: fileSize, yParam: fdLimit,
        xLabel: fileSize >= 1_048_576 ? `${fileSize / 1_048_576}MB` : fileSize >= 1024 ? `${fileSize / 1024}KB` : `${fileSize}B`,
        yLabel: `${fdLimit}`,
        result: runFDSimulation(config, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'File Size', yAxisName: 'FD Limit (ulimit)',
    xValues: fileSizes, yValues: fdLimits,
    grid, metric: 'timeToExhaustion', timestamp: new Date().toISOString(),
  };
}
