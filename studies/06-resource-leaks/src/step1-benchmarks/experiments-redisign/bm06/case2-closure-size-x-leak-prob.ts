/**
 * BM-06 Case 2: Closure Size × Leak Probability
 *
 * The memory impact of listener leaks depends on what each callback captures.
 * Common real-world patterns:
 * - Minimal closure (0 bytes): only the function pointer, negligible memory
 * - Component state (4KB): typical React/Vue component state captured in handler
 * - Large data (1MB): listeners attached after fetching data, capturing response
 * X-axis: closure size (bytes captured by listener)
 * Y-axis: leak probability
 * Fixed: 10/s creation rate, single emitter, 10 Hz emit, 30s duration
 * Metrics: heap growth, memory per leaked listener, time-to-OOM
 */
import { ExperimentResult, GridCell } from '../types';
import { ListenerConfig, ListenerWorkloadConfig, runListenerSimulation } from '../listener-simulator';

const CASE_ID = 'bm06-case2';
const CASE_NAME = 'Closure Size × Leak Probability';

const closureSizes = [0, 1_024, 4_096, 16_384, 65_536, 262_144, 1_048_576];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];

const baseConfig: ListenerConfig = { maxListenersPerEmitter: 100, maxHeapBytes: 512 * 1024 * 1024 };

export function runBm06Case2(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const lp of leakProbs) {
    const row: GridCell<number, number>[] = [];
    for (const closureSizeBytes of closureSizes) {
      const workload: ListenerWorkloadConfig = {
        durationMs: 30_000, emitterCount: 1,
        listenersPerComponent: 1, componentCreateRatePerSec: 10,
        eventEmitFrequencyHz: 10,
        leakProbability: lp, closureSizeBytes,
        listenerType: 'on',
      };
      const label = closureSizeBytes >= 1_048_576 ? `${closureSizeBytes / 1_048_576}MB`
        : closureSizeBytes >= 1024 ? `${closureSizeBytes / 1024}KB` : `${closureSizeBytes}B`;
      row.push({
        xParam: closureSizeBytes, yParam: lp,
        xLabel: label, yLabel: `${(lp * 100).toFixed(0)}%`,
        result: runListenerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Closure Size', yAxisName: 'Leak Probability',
    xValues: closureSizes, yValues: leakProbs,
    grid, metric: 'heapGrowthBytes', timestamp: new Date().toISOString(),
  };
}
