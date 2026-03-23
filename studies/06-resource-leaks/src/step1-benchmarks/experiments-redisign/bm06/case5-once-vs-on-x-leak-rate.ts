/**
 * BM-06 Case 5: Listener Type (once vs on) × Leak Rate
 *
 * emitter.once() auto-removes the listener after the first event fire.
 * This means once() leaks ONLY if the closure is externally retained after firing.
 * emitter.on() requires explicit emitter.off() — no auto-removal.
 * In practice, once() leaks are much rarer and smaller:
 * - Until the first event: listener holds memory (identical to on())
 * - After first event fires: listener removed from emitter, memory freed (unless retained)
 * This case quantifies the real-world difference between on() and once() leak behavior.
 * X-axis: listener type (on vs once)
 * Y-axis: leak probability
 * Fixed: creation rate 10/s, single emitter, 10 Hz emit, 4KB closure, 30s duration
 * Metrics: leaked listeners, heap growth, total callbacks, time-to-MaxListenersExceeded
 */
import { ExperimentResult, GridCell } from '../types';
import { ListenerConfig, ListenerWorkloadConfig, ListenerType, runListenerSimulation } from '../listener-simulator';

const CASE_ID = 'bm06-case5';
const CASE_NAME = 'Listener Type (once vs on) × Leak Probability';

const listenerTypes: ListenerType[] = ['on', 'once'];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.0];

const baseConfig: ListenerConfig = { maxListenersPerEmitter: 10, maxHeapBytes: 512 * 1024 * 1024 };

export function runBm06Case5(): ExperimentResult<number, ListenerType> {
  const grid: GridCell<number, ListenerType>[][] = [];

  for (const listenerType of listenerTypes) {
    const row: GridCell<number, ListenerType>[] = [];
    for (const lp of leakProbs) {
      const workload: ListenerWorkloadConfig = {
        durationMs: 30_000, emitterCount: 1,
        listenersPerComponent: 1, componentCreateRatePerSec: 10,
        eventEmitFrequencyHz: 10,
        leakProbability: lp, closureSizeBytes: 4096,
        listenerType,
      };
      row.push({
        xParam: lp, yParam: listenerType,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: listenerType,
        result: runListenerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Listener Type',
    xValues: leakProbs, yValues: listenerTypes,
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
