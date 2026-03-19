/**
 * BM-04 Case 2: Timeout Duration × Concurrency
 *
 * Mirrors BM-01 Case 3 (Burst × Timeout) but for HTTP sockets.
 * Long timeouts cause sockets to accumulate in CLOSE_WAIT state;
 * short timeouts fail fast but don't reduce socket count.
 * X-axis: request timeout duration (ms)
 * Y-axis: concurrency
 * Fixed: 5% leak probability, 50ms server response time
 * Metrics: p95 latency, failure rate, throughput, leaked sockets
 */
import { ExperimentResult, GridCell } from '../types';
import { SocketConfig, SocketWorkloadConfig, runSocketSimulation } from '../socket-simulator';

const CASE_ID = 'bm04-case2';
const CASE_NAME = 'Timeout Duration × Concurrency';

const timeouts = [50, 100, 500, 1000, 2000, 5000, 10000];
const concurrencies = [1, 5, 10, 20, 50, 100];

const baseConfig: SocketConfig = { maxSockets: 50, responseTimeMs: 50, responseTimeJitter: 10 };

export function runBm04Case2(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const conc of concurrencies) {
    const row: GridCell<number, number>[] = [];
    for (const timeoutMs of timeouts) {
      const workload: SocketWorkloadConfig = {
        durationMs: 30_000, concurrency: conc,
        arrivalIntervalMs: Math.max(1, Math.round(50 / conc)),
        timeoutMs, leakProbability: 0.05,
        errorRate: 0, destroyOnError: true,
        responseSize: 1024, keepAlive: false,
      };
      row.push({
        xParam: timeoutMs, yParam: conc,
        xLabel: `${timeoutMs}ms`, yLabel: `${conc}`,
        result: runSocketSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Timeout (ms)', yAxisName: 'Concurrency',
    xValues: timeouts, yValues: concurrencies,
    grid, metric: 'p95LatencyMs', timestamp: new Date().toISOString(),
  };
}
