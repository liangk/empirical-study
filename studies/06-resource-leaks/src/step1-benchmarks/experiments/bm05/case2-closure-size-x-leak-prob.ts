/**
 * BM-05 Case 2: Closure Size × Leak Probability
 *
 * The memory impact of a timer leak depends entirely on what the callback captures.
 * A closure capturing a 0-byte primitive vs a 1MB ArrayBuffer changes the OOM timeline
 * by orders of magnitude. This is the most operationally critical BM-05 case:
 * - React/Vue components with setInterval capturing full component state (100KB+)
 * - Background polling functions capturing DB query results (1MB+)
 * X-axis: closure size (bytes captured by timer callback)
 * Y-axis: leak probability
 * Fixed: creation rate 20/s, 1s interval, 30s duration
 * Metrics: heap growth, memory per leaked timer, time-to-OOM
 */
import { ExperimentResult, GridCell } from '../types';
import { TimerConfig, TimerWorkloadConfig, runTimerSimulation } from '../timer-simulator';

const CASE_ID = 'bm05-case2';
const CASE_NAME = 'Closure Size × Leak Probability';

const closureSizes = [0, 1_024, 4_096, 16_384, 65_536, 262_144, 1_048_576];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];

const baseConfig: TimerConfig = { maxHeapBytes: 512 * 1024 * 1024 };

export function runBm05Case2(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const lp of leakProbs) {
    const row: GridCell<number, number>[] = [];
    for (const closureSizeBytes of closureSizes) {
      const workload: TimerWorkloadConfig = {
        durationMs: 30_000, creationRatePerSec: 20,
        leakProbability: lp, closureSizeBytes,
        timerIntervalMs: 1000, timerLifetimeMs: 5000,
        timerType: 'interval',
      };
      const label = closureSizeBytes >= 1_048_576 ? `${closureSizeBytes / 1_048_576}MB`
        : closureSizeBytes >= 1024 ? `${closureSizeBytes / 1024}KB` : `${closureSizeBytes}B`;
      row.push({
        xParam: closureSizeBytes, yParam: lp,
        xLabel: label, yLabel: `${(lp * 100).toFixed(0)}%`,
        result: runTimerSimulation(baseConfig, workload),
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
