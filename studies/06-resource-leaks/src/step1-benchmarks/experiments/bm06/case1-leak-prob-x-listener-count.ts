/**
 * BM-06 Case 1: Leak Probability × Target Listener Count
 *
 * Shows when listener leaks trigger MaxListenersExceededWarning (default: 11 per emitter).
 * The warning itself doesn't stop execution — it's a signal that's often missed in production.
 * Past the threshold, listeners accumulate unboundedly.
 * X-axis: leak probability (0% to 100%)
 * Y-axis: target listener count per component (how many listeners each "component" subscribes)
 * Fixed: single emitter, 10 Hz emit rate, 4KB closure, 10/s component creation rate
 * Metrics: leaked listeners, heap growth, time-to-MaxListenersExceeded, total callbacks
 */
import { ExperimentResult, GridCell } from '../types';
import { ListenerConfig, ListenerWorkloadConfig, runListenerSimulation } from '../listener-simulator';

const CASE_ID = 'bm06-case1';
const CASE_NAME = 'Leak Probability × Target Listener Count';

const leakProbs = [0, 0.01, 0.05, 0.10, 0.20, 0.50, 1.0];
const listenerCounts = [1, 2, 5, 10, 20, 50, 100];

const baseConfig: ListenerConfig = { maxListenersPerEmitter: 10, maxHeapBytes: 512 * 1024 * 1024 };

export function runBm06Case1(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const listenersPerComponent of listenerCounts) {
    const row: GridCell<number, number>[] = [];
    for (const lp of leakProbs) {
      const workload: ListenerWorkloadConfig = {
        durationMs: 30_000, emitterCount: 1,
        listenersPerComponent, componentCreateRatePerSec: 10,
        eventEmitFrequencyHz: 10,
        leakProbability: lp, closureSizeBytes: 4096,
        listenerType: 'on',
      };
      row.push({
        xParam: lp, yParam: listenersPerComponent,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: `${listenersPerComponent}`,
        result: runListenerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Listeners per Component',
    xValues: leakProbs, yValues: listenerCounts,
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
