import * as path from 'path';
import { MetricKey, parseCaseFlag, printGrid, buildJsonOutput, writeResults } from './runner-utils';
import { runBm03Case1 } from './bm03/case1-leak-prob-x-concurrency';
import { runBm03Case2 } from './bm03/case2-file-size-x-leak-prob';
import { runBm03Case3 } from './bm03/case3-error-rate-x-error-handling';
import { runBm03Case4 } from './bm03/case4-stream-type-x-leak-prob';
const RESULTS_DIR = path.join(__dirname, 'bm03');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate: { key: 'failureRate', unit: '%', format: v => (v * 100).toFixed(1) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  throughput: { key: 'throughput', unit: 'ops/s', format: v => v.toFixed(0) },
  leakedConnections: { key: 'leakedConnections', unit: 'streams', format: v => v.toFixed(0) },
  heapGrowthBytes: { key: 'heapGrowthBytes', unit: 'bytes', format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
};
async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runBm03Case1(); printGrid('BM-03-R', r, ['failureRate', 'timeToExhaustion', 'leakedConnections', 'heapGrowthBytes'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-03', r, ['failureRate', 'timeToExhaustion', 'leakedConnections', 'heapGrowthBytes'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runBm03Case2(); printGrid('BM-03-R', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'failureRate'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-03', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'failureRate'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runBm03Case3(); printGrid('BM-03-R', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-03', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runBm03Case4(); printGrid('BM-03-R', r, ['failureRate', 'heapGrowthBytes', 'leakedConnections', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-03', r, ['failureRate', 'heapGrowthBytes', 'leakedConnections', 'timeToExhaustion'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm03-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}
main().catch(err => { console.error(err); process.exit(1); });
