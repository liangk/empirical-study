/**
 * BM-04 Case 5: Keep-Alive × Leak Probability
 *
 * HTTP keep-alive fundamentally changes socket lifecycle: sockets persist across
 * requests instead of being created/destroyed per request. This means:
 * - Without leaks: keep-alive improves throughput (no TCP handshake overhead)
 * - With leaks: leaked connections consume keep-alive slots permanently,
 *   reducing the effective pool faster than non-keep-alive (since each slot
 *   is expected to be reused, the impact of losing it is larger)
 * X-axis: keep-alive enabled (false vs true)
 * Y-axis: leak probability
 * Fixed: concurrency 20, maxSockets 50
 * Metrics: failure rate, throughput, leaked sockets, time-to-exhaustion
 */
import { ExperimentResult, GridCell } from '../types';
import { SocketConfig, SocketWorkloadConfig, runSocketSimulation } from '../socket-simulator';

const CASE_ID = 'bm04-case5';
const CASE_NAME = 'Keep-Alive × Leak Probability';

const keepAliveOptions = [false, true];
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.15, 0.20];

const baseConfig: SocketConfig = { maxSockets: 50, responseTimeMs: 50, responseTimeJitter: 10 };

export function runBm04Case5(): ExperimentResult<number, boolean> {
  const grid: GridCell<number, boolean>[][] = [];

  for (const keepAlive of keepAliveOptions) {
    const row: GridCell<number, boolean>[] = [];
    for (const lp of leakProbs) {
      const workload: SocketWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        timeoutMs: 5000, leakProbability: lp,
        errorRate: 0, destroyOnError: true,
        responseSize: 1024, keepAlive,
      };
      row.push({
        xParam: lp, yParam: keepAlive,
        xLabel: `${(lp * 100).toFixed(0)}%`, yLabel: keepAlive ? 'keep-alive' : 'no-keep-alive',
        result: runSocketSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Leak Probability', yAxisName: 'Keep-Alive',
    xValues: leakProbs, yValues: keepAliveOptions,
    grid, metric: 'failureRate', timestamp: new Date().toISOString(),
  };
}
