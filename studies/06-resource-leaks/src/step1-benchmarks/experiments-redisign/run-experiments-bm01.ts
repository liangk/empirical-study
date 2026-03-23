import * as path from 'path';
import { SimulationResult } from './types';
import { buildJsonOutput, MetricKey, parseCaseFlag, printGrid, writeResults } from './runner-utils';
import { runCase1 } from './bm01/case1-leak-prob-x-concurrency';
import { runCase2 } from './bm01/case2-query-time-x-pool-size';
import { runCase3 } from './bm01/case3-burst-x-timeout';
import { runCase4 } from './bm01/case4-error-rate-x-leak-on-error';
import { runCase5 } from './bm01/case5-leak-prob-x-max-conns';

const RESULTS_DIR = path.join(__dirname, 'bm01');
const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate: { key: 'failureRate', unit: '%', format: v => (v * 100).toFixed(1) },
  throughput: { key: 'throughput', unit: 'req/s', format: v => v.toFixed(0) },
  p95LatencyMs: { key: 'p95LatencyMs', unit: 'ms', format: v => v.toFixed(0) },
  leakedConnections: { key: 'leakedConnections', unit: '', format: v => v.toFixed(0) },
  timeToExhaustion: { key: 'timeToExhaustion', unit: 'ms', format: v => v === Infinity ? '∞' : v.toFixed(0) },
  meanLatencyMs: { key: 'meanLatencyMs', unit: 'ms', format: v => v.toFixed(1) },
  peakActiveConnections: { key: 'peakActiveConnections', unit: '', format: v => v.toFixed(0) },
};

async function main(): Promise<void> {
  const caseFlag = parseCaseFlag();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const allResults: any[] = [];
  if (!caseFlag || caseFlag === '1') { const r = runCase1(); printGrid('BM-01-R', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-01', r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '2') { const r = runCase2(); printGrid('BM-01-R', r, ['throughput', 'failureRate', 'leakedConnections', 'meanLatencyMs'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-01', r, ['throughput', 'failureRate', 'leakedConnections', 'meanLatencyMs'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '3') { const r = runCase3(); printGrid('BM-01-R', r, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-01', r, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '4') { const r = runCase4(); printGrid('BM-01-R', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-01', r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput'], METRIC_LABELS)); }
  if (!caseFlag || caseFlag === '5') { const r = runCase5(); printGrid('BM-01-R', r, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput'], METRIC_LABELS); allResults.push(buildJsonOutput('BM-01', r, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput'], METRIC_LABELS)); }
  const outFile = writeResults(RESULTS_DIR, `experiments-bm01-redesign-${timestamp}.json`, allResults);
  console.log(`\nResults: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
