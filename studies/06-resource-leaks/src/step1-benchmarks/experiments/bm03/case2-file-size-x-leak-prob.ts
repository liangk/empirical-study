/**
 * BM-03 Case 2: File Size × Leak Probability
 *
 * Explores the dual failure mode of stream leaks:
 * - Small files (1KB): EMFILE hits first — FD limit is the bottleneck
 * - Large files (10MB+): OOM hits first — buffered data is the bottleneck
 * ReadStream buffers up to 64KB (highWaterMark default); TransformStream buffers both sides.
 * X-axis: file size
 * Y-axis: leak probability
 * Fixed: concurrency 20, 1024 FD limit, 512MB heap limit
 * Metrics: time-to-EMFILE/OOM, heap growth, leaked streams, throughput
 */
import { ExperimentResult, GridCell } from '../types';
import { StreamConfig, StreamWorkloadConfig, runStreamSimulation } from '../stream-simulator';

const CASE_ID = 'bm03-case2';
const CASE_NAME = 'File Size × Leak Probability';

const fileSizes = [1_024, 10_240, 65_536, 524_288, 5_242_880, 52_428_800];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];

const baseConfig: StreamConfig = { fdLimit: 1024, maxHeapBytes: 512 * 1024 * 1024, streamTimeMs: 10, streamTimeJitter: 2 };

export function runBm03Case2(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const lp of leakProbs) {
    const row: GridCell<number, number>[] = [];
    for (const fileSize of fileSizes) {
      const workload: StreamWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        leakProbability: lp, errorRate: 0, destroyOnError: true,
        fileSize, streamType: 'read',
      };
      const label = fileSize >= 1_048_576 ? `${fileSize / 1_048_576}MB`
        : fileSize >= 1024 ? `${fileSize / 1024}KB` : `${fileSize}B`;
      row.push({
        xParam: fileSize, yParam: lp,
        xLabel: label, yLabel: `${(lp * 100).toFixed(0)}%`,
        result: runStreamSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'File Size', yAxisName: 'Leak Probability',
    xValues: fileSizes, yValues: leakProbs,
    grid, metric: 'heapGrowthBytes', timestamp: new Date().toISOString(),
  };
}
