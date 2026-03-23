import * as path from 'path';
import { MetricKey, parseCaseFlag, printGrid, buildJsonOutput, writeResults } from './runner-utils';
import { runBm05Case1 } from './bm05/case1-leak-prob-x-concurrency';
import { runBm05Case2 } from './bm05/case2-closure-size-x-leak-prob';
import { runBm05Case3 } from './bm05/case3-timer-interval-x-concurrency';
import { runBm05Case4 } from './bm05/case4-timer-type-x-leak-prob';
const RESULTS_DIR = path.join(__dirname, 'bm05');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  leakedConnections: { key: 'leakedConnections', unit: 'timers', format: v => v.toFixed(0) },
  heapGrowthBytes: { key: 'heapGrowthBytes', unit: 'bytes', format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
  totalCallbackInvocations: { key: 'totalCallbackInvocations', unit: 'calls', format: v => ((v ?? 0) >= 1_000_000 ? `${((v ?? 0) / 1_000_000).toFixed(1)}M` : (v ?? 0) >= 1000 ? `${((v ?? 0) / 1000).toFixed(0)}K` : `${(v ?? 0).toFixed(0)}`) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  throughput: { key: 'throughput', unit: 'ops/s', format: v => v.toFixed(0) },
  meanLatencyMs: { key: 'meanLatencyMs', unit: 'ms', format: v => v.toFixed(2) },
};
async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runBm05Case1(); printGrid('BM-05-R', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-05', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runBm05Case2(); printGrid('BM-05-R', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-05', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runBm05Case3(); printGrid('BM-05-R', r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanLatencyMs', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-05', r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanLatencyMs', 'timeToExhaustion'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runBm05Case4(); printGrid('BM-05-R', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-05', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm05-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}
main().catch(err => { console.error(err); process.exit(1); });
