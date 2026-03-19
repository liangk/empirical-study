/**
 * BM-05 Case 4: Timer Type × Leak Probability
 *
 * setTimeout vs setInterval have fundamentally different leak semantics:
 * - setInterval: fires forever unless clearInterval() is called. Both CPU and memory.
 * - setTimeout: fires once and auto-removes from event loop. Memory only if closure
 *   is captured in an external reference after firing.
 * In practice, setTimeout leaks are rarer because the timer self-cancels.
 * setInterval leaks are more severe because they continuously consume CPU.
 * X-axis: timer type (timeout vs interval)
 * Y-axis: leak probability
 * Fixed: creation rate 20/s, 4KB closure, 1s interval, 30s duration
 * Metrics: leaked timers, heap growth, total callbacks, time-to-OOM
 */
import { ExperimentResult, GridCell } from '../types';
import { TimerConfig, TimerWorkloadConfig, TimerType, runTimerSimulation } from '../timer-simulator';

const CASE_ID = 'bm05-case4';
const CASE_NAME = 'Timer Type × Leak Probability';

const timerTypes: TimerType[] = ['timeout', 'interval'];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.0];

const baseConfig: TimerConfig = { maxHeapBytes: 512 * 1024 * 1024 };

export function runBm05Case4(): ExperimentResult<number, TimerType> {
  const grid: GridCell<number, TimerType>[][] = [];

  for (const timerType of timerTypes) {
    const row: GridCell<number, TimerType>[] = [];
    for (const lp of leakProbs) {
      const workload: TimerWorkloadConfig = {
        durationMs: 30_000, creationRatePerSec: 20,
        leakProbability: lp, closureSizeBytes: 4096,
        timerIntervalMs: 1000, timerLifetimeMs: 5000,
        timerType,
      };
      row.push({
        xParam: lp, yParam: timerType,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: timerType,
        result: runTimerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Timer Type',
    xValues: leakProbs, yValues: timerTypes,
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
