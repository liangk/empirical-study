/**
 * BM-05 Case 3: Timer Interval × Timer Creation Rate
 *
 * Short-interval timers cause CPU saturation when leaked: a 1ms interval timer
 * fires 1000 times/second. With 100 leaked timers, that's 100,000 callbacks/sec.
 * Long-interval timers are primarily a memory problem (closure retention).
 * This case maps the two failure modes:
 * - Short interval + many timers = CPU/event loop saturation
 * - Long interval + large closure = memory accumulation
 * X-axis: timer interval (ms)
 * Y-axis: timer creation rate (simulates concurrency)
 * Fixed: 100% leak (all leaked), 1KB closure, 30s duration
 * Metrics: total callback invocations, event loop delay proxy, heap growth
 */
import { ExperimentResult, GridCell } from '../types';
import { TimerConfig, TimerWorkloadConfig, runTimerSimulation } from '../timer-simulator';

const CASE_ID = 'bm05-case3';
const CASE_NAME = 'Timer Interval × Creation Rate';

const timerIntervals = [1, 10, 50, 100, 500, 1000, 5000];
const creationRates = [1, 5, 10, 20, 50, 100];

const baseConfig: TimerConfig = { maxHeapBytes: 512 * 1024 * 1024 };

export function runBm05Case3(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const rate of creationRates) {
    const row: GridCell<number, number>[] = [];
    for (const timerIntervalMs of timerIntervals) {
      const workload: TimerWorkloadConfig = {
        durationMs: 30_000, creationRatePerSec: rate,
        leakProbability: 1.0, closureSizeBytes: 1024,
        timerIntervalMs, timerLifetimeMs: 5000,
        timerType: 'interval',
      };
      row.push({
        xParam: timerIntervalMs, yParam: rate,
        xLabel: `${timerIntervalMs}ms`, yLabel: `${rate}/s`,
        result: runTimerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Timer Interval (ms)', yAxisName: 'Creation Rate (timers/sec)',
    xValues: timerIntervals, yValues: creationRates,
    grid, metric: 'totalCallbackInvocations', timestamp: new Date().toISOString(),
  };
}
