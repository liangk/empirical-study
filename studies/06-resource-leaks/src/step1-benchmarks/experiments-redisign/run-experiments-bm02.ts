import * as path from 'path';
import { MetricKey, parseCaseFlag, printGrid, buildJsonOutput, writeResults } from './runner-utils';
import { runBm02Case1 } from './bm02/case1-leak-prob-x-concurrency';
import { runBm02Case2 } from './bm02/case2-file-size-x-fd-limit';
import { runBm02Case3 } from './bm02/case3-error-rate-x-leak-on-error';
import { runBm02Case4 } from './bm02/case4-open-rate-x-fd-limit';

const RESULTS_DIR = path.join(__dirname, 'bm02');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate: { key: 'failureRate', unit: '%', format: v => (v * 100).toFixed(1) },
  throughput: { key: 'throughput', unit: 'ops/s', format: v => v.toFixed(0) },
  leakedConnections: { key: 'leakedConnections', unit: 'FDs', format: v => v.toFixed(0) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  heapGrowthBytes: { key: 'heapGrowthBytes', unit: 'bytes', format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
  peakActiveConnections: { key: 'peakActiveConnections', unit: 'FDs', format: v => v.toFixed(0) },
};
async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runBm02Case1(); printGrid('BM-02-R', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-02', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runBm02Case2(); printGrid('BM-02-R', r, ['timeToExhaustion', 'heapGrowthBytes', 'failureRate', 'peakActiveConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-02', r, ['timeToExhaustion', 'heapGrowthBytes', 'failureRate', 'peakActiveConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runBm02Case3(); printGrid('BM-02-R', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-02', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runBm02Case4(); printGrid('BM-02-R', r, ['timeToExhaustion', 'failureRate', 'throughput', 'leakedConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-02', r, ['timeToExhaustion', 'failureRate', 'throughput', 'leakedConnections'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm02-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}
main().catch(err => { console.error(err); process.exit(1); });
