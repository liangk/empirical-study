import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, SimulationResult } from './types';
import { runBm04Case1 } from './bm04/case1-leak-prob-x-concurrency';
import { runBm04Case2 } from './bm04/case2-timeout-x-concurrency';
import { runBm04Case3 } from './bm04/case3-error-rate-x-error-handling';
import { runBm04Case4 } from './bm04/case4-response-size-x-concurrency';
import { runBm04Case5 } from './bm04/case5-keepalive-x-leak-prob';

const RESULTS_DIR = path.join(__dirname, 'bm04');
type MetricKey = keyof SimulationResult;

const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate:          { key: 'failureRate',          unit: '%',     format: v => (v * 100).toFixed(1) },
  throughput:           { key: 'throughput',            unit: 'req/s', format: v => v.toFixed(0) },
  leakedConnections:    { key: 'leakedConnections',    unit: 'sockets', format: v => v.toFixed(0) },
  timeToExhaustion:     { key: 'timeToExhaustion',     unit: 'ms',    format: v => v === Infinity ? '∞' : v.toFixed(0) },
  p95LatencyMs:         { key: 'p95LatencyMs',         unit: 'ms',    format: v => v.toFixed(0) },
  meanLatencyMs:        { key: 'meanLatencyMs',        unit: 'ms',    format: v => v.toFixed(1) },
  peakActiveConnections:{ key: 'peakActiveConnections', unit: 'sockets', format: v => v.toFixed(0) },
};

function printGrid<X, Y>(exp: ExperimentResult<X, Y>, metrics: MetricKey[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  [BM-04] ${exp.caseName}`);
  console.log(`  X: ${exp.xAxisName}  |  Y: ${exp.yAxisName}`);
  console.log(`${'═'.repeat(72)}`);
  for (const metricKey of metrics) {
    const ml = METRIC_LABELS[metricKey] || { key: metricKey, unit: '', format: (v: number) => v.toFixed(2) };
    console.log(`\n  ── ${metricKey} (${ml.unit}) ──`);
    const xLabels = exp.grid[0].map(c => c.xLabel);
    const colWidth = Math.max(10, ...xLabels.map(l => l.length + 2));
    const yColWidth = Math.max(24, ...exp.grid.map(row => row[0].yLabel.length + 2));
    console.log(`  ${''.padEnd(yColWidth)}${xLabels.map(l => l.padStart(colWidth)).join('')}`);
    console.log(`  ${''.padEnd(yColWidth)}${xLabels.map(() => '─'.repeat(colWidth)).join('')}`);
    for (const row of exp.grid) {
      const cells = row.map(cell => ml.format((cell.result[ml.key] as number) ?? 0).padStart(colWidth));
      console.log(`  ${row[0].yLabel.padEnd(yColWidth)}${cells.join('')}`);
    }
  }
}

function buildJsonOutput<X, Y>(exp: ExperimentResult<X, Y>, metrics: MetricKey[]): any {
  const tables: Record<string, any> = {};
  for (const metricKey of metrics) {
    const ml = METRIC_LABELS[metricKey] || { key: metricKey, unit: '', format: (v: number) => v };
    const rows = exp.grid.map(row => {
      const entry: Record<string, any> = { [exp.yAxisName]: row[0].yLabel };
      for (const cell of row) entry[cell.xLabel] = (cell.result[ml.key] as number) ?? 0;
      return entry;
    });
    tables[metricKey] = { unit: ml.unit, data: rows };
  }
  return { caseId: exp.caseId, caseName: exp.caseName, module: 'BM-04', xAxisName: exp.xAxisName, yAxisName: exp.yAxisName, tables, timestamp: exp.timestamp };
}

const args = process.argv.slice(2);
const caseFlag = (() => { const i = args.indexOf('--case'); return i !== -1 ? args[i + 1] : null; })();

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   BM-04: HTTP Socket Leak — 2D Impact Experiments                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allResults: any[] = [];

  if (!caseFlag || caseFlag === '1') {
    console.log('\n▶ Case 1: Leak Probability × Concurrency');
    const r = runBm04Case1();
    printGrid(r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']);
    allResults.push(buildJsonOutput(r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']));
  }
  if (!caseFlag || caseFlag === '2') {
    console.log('\n▶ Case 2: Timeout Duration × Concurrency');
    const r = runBm04Case2();
    printGrid(r, ['p95LatencyMs', 'failureRate', 'throughput', 'leakedConnections']);
    allResults.push(buildJsonOutput(r, ['p95LatencyMs', 'failureRate', 'throughput', 'leakedConnections']));
  }
  if (!caseFlag || caseFlag === '3') {
    console.log('\n▶ Case 3: Error Rate × Error Handling Behavior');
    const r = runBm04Case3();
    printGrid(r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']);
    allResults.push(buildJsonOutput(r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']));
  }
  if (!caseFlag || caseFlag === '4') {
    console.log('\n▶ Case 4: Response Size × Concurrency');
    const r = runBm04Case4();
    printGrid(r, ['failureRate', 'p95LatencyMs', 'throughput', 'leakedConnections']);
    allResults.push(buildJsonOutput(r, ['failureRate', 'p95LatencyMs', 'throughput', 'leakedConnections']));
  }
  if (!caseFlag || caseFlag === '5') {
    console.log('\n▶ Case 5: Keep-Alive × Leak Probability');
    const r = runBm04Case5();
    printGrid(r, ['failureRate', 'throughput', 'leakedConnections', 'timeToExhaustion']);
    allResults.push(buildJsonOutput(r, ['failureRate', 'throughput', 'leakedConnections', 'timeToExhaustion']));
  }

  const outFile = path.join(RESULTS_DIR, `experiments-bm04-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\n${'─'.repeat(72)}\nResults: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
