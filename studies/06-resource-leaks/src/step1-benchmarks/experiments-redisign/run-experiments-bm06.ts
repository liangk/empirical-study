import * as path from 'path';
import { MetricKey, parseCaseFlag, printGrid, buildJsonOutput, writeResults } from './runner-utils';
import { runBm06Case1 } from './bm06/case1-leak-prob-x-listener-count';
import { runBm06Case2 } from './bm06/case2-closure-size-x-leak-prob';
import { runBm06Case3 } from './bm06/case3-event-freq-x-listener-count';
import { runBm06Case4 } from './bm06/case4-emitter-count-x-listeners';
import { runBm06Case5 } from './bm06/case5-once-vs-on-x-leak-rate';
const RESULTS_DIR = path.join(__dirname, 'bm06');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  leakedConnections: { key: 'leakedConnections', unit: 'listeners', format: v => v.toFixed(0) },
  heapGrowthBytes: { key: 'heapGrowthBytes', unit: 'bytes', format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
  totalCallbackInvocations: { key: 'totalCallbackInvocations', unit: 'calls', format: v => (v ?? 0) >= 1_000_000 ? `${((v ?? 0) / 1_000_000).toFixed(1)}M` : (v ?? 0) >= 1000 ? `${((v ?? 0) / 1000).toFixed(0)}K` : `${(v ?? 0).toFixed(0)}` },
  meanEmitLatencyMs: { key: 'meanEmitLatencyMs', unit: 'ms', format: v => (v ?? 0).toFixed(2) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  throughput: { key: 'throughput', unit: 'ops/s', format: v => v.toFixed(0) },
  peakActiveConnections: { key: 'peakActiveConnections', unit: 'listeners', format: v => v.toFixed(0) },
};
async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runBm06Case1(); printGrid('BM-06-R', r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'totalCallbackInvocations'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-06', r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'totalCallbackInvocations'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runBm06Case2(); printGrid('BM-06-R', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-06', r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runBm06Case3(); printGrid('BM-06-R', r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanEmitLatencyMs', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-06', r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanEmitLatencyMs', 'timeToExhaustion'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runBm06Case4(); printGrid('BM-06-R', r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'peakActiveConnections', 'meanEmitLatencyMs'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-06', r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'peakActiveConnections', 'meanEmitLatencyMs'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '5') { const r = runBm06Case5(); printGrid('BM-06-R', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-06', r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm06-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}
main().catch(err => { console.error(err); process.exit(1); });
