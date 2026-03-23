/**
 * BM-06 Case 4: Emitter Count × Listeners Per Emitter
 *
 * MaxListenersExceededWarning is per-emitter. With many emitters each getting
 * few leaked listeners, the warning may never fire — yet total memory grows.
 * With one emitter getting many leaked listeners, the warning fires early.
 * This case maps the cross-component leak pattern:
 * - Shared global emitter (1 emitter, many components subscribing)
 * - Per-component emitters (many emitters, few listeners each)
 * X-axis: emitter count (1 = shared global; 100 = per-component)
 * Y-axis: target listeners per emitter
 * Fixed: 5% leak probability, 4KB closure, 10 Hz, 30s duration
 * Metrics: leaked listeners, MaxListenersExceeded time, heap growth, emit latency
 */
import { ExperimentResult, GridCell } from '../types';
import { ListenerConfig, ListenerWorkloadConfig, runListenerSimulation } from '../listener-simulator';

const CASE_ID = 'bm06-case4';
const CASE_NAME = 'Emitter Count × Listeners Per Emitter';

const emitterCounts = [1, 2, 5, 10, 20, 50, 100];
const listenersPerEmitter = [1, 5, 10, 20, 50, 100];

const baseConfig: ListenerConfig = { maxListenersPerEmitter: 10, maxHeapBytes: 512 * 1024 * 1024 };

export function runBm06Case4(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const listenersPerComponent of listenersPerEmitter) {
    const row: GridCell<number, number>[] = [];
    for (const emitterCount of emitterCounts) {
      const workload: ListenerWorkloadConfig = {
        durationMs: 30_000, emitterCount,
        listenersPerComponent, componentCreateRatePerSec: 10,
        eventEmitFrequencyHz: 10,
        leakProbability: 0.05, closureSizeBytes: 4096,
        listenerType: 'on',
      };
      row.push({
        xParam: emitterCount, yParam: listenersPerComponent,
        xLabel: `${emitterCount}`, yLabel: `${listenersPerComponent}`,
        result: runListenerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Emitter Count', yAxisName: 'Listeners Per Emitter',
    xValues: emitterCounts, yValues: listenersPerEmitter,
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
