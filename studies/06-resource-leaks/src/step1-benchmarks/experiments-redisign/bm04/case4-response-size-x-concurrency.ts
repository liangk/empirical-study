/**
 * BM-04 Case 4: Response Size × Concurrency
 *
 * Large responses hold sockets open longer (time to receive all data).
 * This compounds with concurrency: at high parallelism, large responses
 * keep the socket pool saturated even without leaks. With leaks, it's catastrophic.
 * X-axis: response body size (bytes)
 * Y-axis: concurrency
 * Fixed: 5% leak probability, 5s timeout
 * Metrics: failure rate, p95 latency, throughput, leaked sockets
 */
import { ExperimentResult, GridCell } from '../types';
import { SocketConfig, SocketWorkloadConfig, runSocketSimulation } from '../socket-simulator';

const CASE_ID = 'bm04-case4';
const CASE_NAME = 'Response Size × Concurrency';

// Response size determines transfer time: 1KB @ 100MB/s = 0.01ms; 10MB = 100ms
const responseSizes = [1_024, 10_240, 102_400, 1_048_576, 5_242_880, 10_485_760];
const concurrencies = [1, 5, 10, 20, 50, 100];

export function runBm04Case4(): ExperimentResult<number, number> {
  const grid: GridCell<number, number>[][] = [];

  for (const conc of concurrencies) {
    const row: GridCell<number, number>[] = [];
    for (const responseSize of responseSizes) {
      // Simulate transfer time: ~100MB/s network, so 1KB = 0.01ms, 10MB = 100ms
      const transferMs = Math.max(1, responseSize / (100 * 1024 * 1024 / 1000));
      const config: SocketConfig = { maxSockets: 50, responseTimeMs: 10 + transferMs, responseTimeJitter: 2 };
      const workload: SocketWorkloadConfig = {
        durationMs: 30_000, concurrency: conc,
        arrivalIntervalMs: Math.max(1, Math.round(50 / conc)),
        timeoutMs: 30_000, leakProbability: 0.05,
        errorRate: 0, destroyOnError: true,
        responseSize, keepAlive: false,
      };
      const label = responseSize >= 1_048_576 ? `${responseSize / 1_048_576}MB`
        : responseSize >= 1024 ? `${responseSize / 1024}KB` : `${responseSize}B`;
      row.push({
        xParam: responseSize, yParam: conc,
        xLabel: label, yLabel: `${conc}`,
        result: runSocketSimulation(config, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Response Size', yAxisName: 'Concurrency',
    xValues: responseSizes, yValues: concurrencies,
    grid, metric: 'failureRate', timestamp: new Date().toISOString(),
  };
}
