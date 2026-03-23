/**
 * BM-05 Case 1: Leak Probability × Timer Creation Rate
 *
 * Shows how setInterval without clearInterval scales with timer creation rate.
 * Each leaked timer: (1) permanently occupies a V8 timer slot, (2) fires the
 * callback repeatedly consuming CPU, (3) retains its closure (4KB default) preventing GC.
 * X-axis: leak probability (0% to 20%)
 * Y-axis: timer creation rate (timers/sec)
 * Metrics: leaked timers, heap growth, total callback invocations, time-to-OOM
 */
import { ExperimentResult, GridCell } from '../types';
import { TimerConfig, TimerWorkloadConfig, runTimerSimulation } from '../timer-simulator';

const CASE_ID = 'bm05-case1';
const CASE_NAME = 'Leak Probability × Timer Creation Rate';

const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const creationRates = [1, 5, 10, 20, 50, 100];

const baseConfig: TimerConfig = { maxHeapBytes: 1 * 1024 * 1024, maxMeanLatencyMs: 5 };

export function runBm05Case1(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const rate of creationRates) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const workload: TimerWorkloadConfig = {
        durationMs: 30_000, creationRatePerSec: rate,
        leakProbability: lp, closureSizeBytes: 4096,
        timerIntervalMs: 1000, timerLifetimeMs: 5000,
        timerType: 'interval',
      };
      row.push({
        xParam: lp, yParam: rate,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: `${rate}/s`,
        result: runTimerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Creation Rate (timers/sec)',
    xValues: leakProbs, yValues: creationRates,
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
