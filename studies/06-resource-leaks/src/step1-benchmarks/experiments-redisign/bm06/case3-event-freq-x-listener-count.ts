/**
 * BM-06 Case 3: Event Emit Frequency × Leaked Listener Count
 *
 * EventEmitter.emit() iterates through all listeners in O(n).
 * High-frequency events (WebSocket messages, metrics, data streams) combined
 * with many accumulated listeners creates CPU saturation.
 * This case answers: at what listener count × frequency does emit become a bottleneck?
 * X-axis: event emit frequency (Hz)
 * Y-axis: number of listeners (simulates accumulated leaks at 100% leak rate)
 * Fixed: 100% leak rate, 1KB closure, 30s duration
 * Metrics: total callback invocations, emit latency, heap growth
 */
import { ExperimentResult, GridCell } from '../types';
import { ListenerConfig, ListenerWorkloadConfig, runListenerSimulation } from '../listener-simulator';

const CASE_ID = 'bm06-case3';
const CASE_NAME = 'Event Frequency × Listener Count';

const emitFreqs = [1, 10, 50, 100, 500, 1000];
const targetListenerCounts = [1, 10, 50, 100, 500, 1000];

const baseConfig: ListenerConfig = { maxListenersPerEmitter: 10000, maxHeapBytes: 512 * 1024 * 1024 };

export function runBm06Case3(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const listenersPerComponent of targetListenerCounts) {
    const row: GridCell<number, number>[] = [];
    for (const eventEmitFrequencyHz of emitFreqs) {
      const workload: ListenerWorkloadConfig = {
        durationMs: 30_000, emitterCount: 1,
        listenersPerComponent, componentCreateRatePerSec: 1,
        eventEmitFrequencyHz,
        leakProbability: 1.0, closureSizeBytes: 1024,
        listenerType: 'on',
      };
      row.push({
        xParam: eventEmitFrequencyHz, yParam: listenersPerComponent,
        xLabel: `${eventEmitFrequencyHz}Hz`, yLabel: `${listenersPerComponent}`,
        result: runListenerSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Event Frequency (Hz)', yAxisName: 'Listener Count',
    xValues: emitFreqs, yValues: targetListenerCounts,
    grid, metric: 'totalCallbackInvocations', timestamp: new Date().toISOString(),
  };
}
