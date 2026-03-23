import * as path from 'path';
import { MetricKey, parseCaseFlag, printGrid, buildJsonOutput, writeResults } from './runner-utils';
import { runBm04Case1 } from './bm04/case1-leak-prob-x-concurrency';
import { runBm04Case2 } from './bm04/case2-timeout-x-concurrency';
import { runBm04Case3 } from './bm04/case3-error-rate-x-error-handling';
import { runBm04Case4 } from './bm04/case4-response-size-x-concurrency';
import { runBm04Case5 } from './bm04/case5-keepalive-x-leak-prob';
const RESULTS_DIR = path.join(__dirname, 'bm04');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate: { key: 'failureRate', unit: '%', format: v => (v * 100).toFixed(1) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  throughput: { key: 'throughput', unit: 'ops/s', format: v => v.toFixed(0) },
  leakedConnections: { key: 'leakedConnections', unit: 'sockets', format: v => v.toFixed(0) },
  p95LatencyMs: { key: 'p95LatencyMs', unit: 'ms', format: v => v.toFixed(0) },
  peakActiveConnections: { key: 'peakActiveConnections', unit: 'sockets', format: v => v.toFixed(0) },
};
async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runBm04Case1(); printGrid('BM-04-R', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-04', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runBm04Case2(); printGrid('BM-04-R', r, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-04', r, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runBm04Case3(); printGrid('BM-04-R', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-04', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runBm04Case4(); printGrid('BM-04-R', r, ['failureRate', 'p95LatencyMs', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-04', r, ['failureRate', 'p95LatencyMs', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '5') { const r = runBm04Case5(); printGrid('BM-04-R', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-04', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm04-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}
main().catch(err => { console.error(err); process.exit(1); });
