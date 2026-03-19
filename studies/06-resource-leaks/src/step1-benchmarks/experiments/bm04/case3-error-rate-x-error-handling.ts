/**
 * BM-04 Case 3: Error Rate × Error Handling Behavior
 *
 * Shows how HTTP errors (4xx/5xx, network resets) leak sockets when
 * req.on('error', ...) doesn't call req.destroy(). Critical for services
 * calling unreliable external APIs or microservices.
 * X-axis: error rate (0% to 30%)
 * Y-axis: error handling behavior (destroy-on-error vs no-destroy + base leak)
 * Metrics: leaked sockets, failure rate, time-to-exhaustion, throughput
 */
import { ExperimentResult, GridCell } from '../types';
import { SocketConfig, SocketWorkloadConfig, runSocketSimulation } from '../socket-simulator';

const CASE_ID = 'bm04-case3';
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

const baseConfig: SocketConfig = { maxSockets: 50, responseTimeMs: 50, responseTimeJitter: 10 };

export function runBm04Case3(): ExperimentResult<number, string> {
  const grid: GridCell<number, string>[][] = [];

  for (const b of behaviors) {
    const row: GridCell<number, string>[] = [];
    for (const er of errorRates) {
      const workload: SocketWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        timeoutMs: 5000, leakProbability: b.baseLeakProb,
        errorRate: er, destroyOnError: b.destroyOnError,
        responseSize: 1024, keepAlive: false,
      };
      row.push({
        xParam: er, yParam: b.label,
        xLabel: `${(er * 100).toFixed(0)}%`, yLabel: b.label,
        result: runSocketSimulation(baseConfig, workload),
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
