/**
 * BM-03 Case 4: Stream Type × Leak Probability
 *
 * Different stream types have different memory profiles when leaked:
 * - ReadStream: buffers up to highWaterMark (64KB default) on the readable side
 * - WriteStream: buffers up to highWaterMark (16KB default) on the writable side
 * - Transform: buffers BOTH sides simultaneously (up to 80KB)
 * This case quantifies whether stream type changes time-to-OOM or time-to-EMFILE.
 * X-axis: stream type (read, write, transform)
 * Y-axis: leak probability
 * Fixed: concurrency 20, fileSize 1MB, 30s duration
 * Metrics: heap growth, time-to-exhaustion, leaked streams, throughput
 */
import { ExperimentResult, GridCell } from '../types';
import { StreamConfig, StreamWorkloadConfig, StreamType, runStreamSimulation } from '../stream-simulator';

const CASE_ID = 'bm03-case4';
const CASE_NAME = 'Stream Type × Leak Probability';

const streamTypes: StreamType[] = ['read', 'write', 'transform'];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];

const baseConfig: StreamConfig = { fdLimit: 1024, maxHeapBytes: 512 * 1024 * 1024, streamTimeMs: 20, streamTimeJitter: 5 };

export function runBm03Case4(): ExperimentResult<number, StreamType> {
  const grid: GridCell<number, StreamType>[][] = [];

  for (const streamType of streamTypes) {
    const row: GridCell<number, StreamType>[] = [];
    for (const lp of leakProbs) {
      const workload: StreamWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        leakProbability: lp, errorRate: 0, destroyOnError: true,
        fileSize: 1_048_576, streamType,
      };
      row.push({
        xParam: lp, yParam: streamType,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: streamType,
        result: runStreamSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Stream Type',
    xValues: leakProbs, yValues: streamTypes,
    grid, metric: 'heapGrowthBytes', timestamp: new Date().toISOString(),
  };
}
