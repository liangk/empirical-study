/**
 * BM-03 Case 3: Error Rate × Error Handling Behavior
 *
 * Shows how stream errors leak FDs and memory when stream.destroy() is not
 * called in the 'error' event handler. Critical pattern: createReadStream on
 * files that may not exist, or network streams that disconnect mid-transfer.
 * X-axis: error rate (0% to 30%)
 * Y-axis: error handling behavior (destroy-on-error vs no-destroy + base leak)
 * Metrics: leaked streams, heap growth, failure rate, time-to-exhaustion
 */
import { ExperimentResult, GridCell } from '../types';
import { StreamConfig, StreamWorkloadConfig, runStreamSimulation } from '../stream-simulator';

const CASE_ID = 'bm03-case3';
const CASE_NAME = 'Error Rate × Error Handling Behavior';

const errorRates = [0, 0.01, 0.05, 0.10, 0.15, 0.20, 0.30];

interface ErrorBehavior { destroyOnError: boolean; baseLeakProb: number; label: string; }
const behaviors: ErrorBehavior[] = [
  { destroyOnError: true,  baseLeakProb: 0,    label: 'destroy+0%leak' },
  { destroyOnError: true,  baseLeakProb: 0.02, label: 'destroy+2%leak' },
  { destroyOnError: true,  baseLeakProb: 0.05, label: 'destroy+5%leak' },
  { destroyOnError: true,  baseLeakProb: 0.10, label: 'destroy+10%leak' },
  { destroyOnError: false, baseLeakProb: 0,    label: 'no-destroy+0%leak' },
  { destroyOnError: false, baseLeakProb: 0.02, label: 'no-destroy+2%leak' },
  { destroyOnError: false, baseLeakProb: 0.05, label: 'no-destroy+5%leak' },
  { destroyOnError: false, baseLeakProb: 0.10, label: 'no-destroy+10%leak' },
];

const baseConfig: StreamConfig = { fdLimit: 1024, maxHeapBytes: 512 * 1024 * 1024, streamTimeMs: 10, streamTimeJitter: 2 };

export function runBm03Case3(): ExperimentResult<number, string> {
  const grid: GridCell<number, string>[][] = [];

  for (const b of behaviors) {
    const row: GridCell<number, string>[] = [];
    for (const er of errorRates) {
      const workload: StreamWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        leakProbability: b.baseLeakProb, errorRate: er, destroyOnError: b.destroyOnError,
        fileSize: 65_536, streamType: 'read',
      };
      row.push({
        xParam: er, yParam: b.label,
        xLabel: `${(er * 100).toFixed(0)}%`, yLabel: b.label,
        result: runStreamSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Error Rate', yAxisName: 'Error Handling Behavior',
    xValues: errorRates, yValues: behaviors.map(b => b.label),
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
