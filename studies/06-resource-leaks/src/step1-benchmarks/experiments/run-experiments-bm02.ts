import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, GridCell, SimulationResult } from './types';
import { runBm02Case1 } from './bm02/case1-leak-prob-x-concurrency';
import { runBm02Case2 } from './bm02/case2-file-size-x-fd-limit';
import { runBm02Case3 } from './bm02/case3-error-rate-x-leak-on-error';
import { runBm02Case4 } from './bm02/case4-open-rate-x-fd-limit';

const RESULTS_DIR = path.join(__dirname, 'bm02');

type MetricKey = keyof SimulationResult;

const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate:          { key: 'failureRate',          unit: '%',    format: v => (v * 100).toFixed(1) },
  throughput:           { key: 'throughput',            unit: 'ops/s', format: v => v.toFixed(0) },
  leakedConnections:    { key: 'leakedConnections',    unit: 'FDs',  format: v => v.toFixed(0) },
  timeToExhaustion:     { key: 'timeToExhaustion',     unit: 'ms',   format: v => v === Infinity ? '∞' : v.toFixed(0) },
  heapGrowthBytes:      { key: 'heapGrowthBytes',      unit: 'bytes', format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
  peakActiveConnections:{ key: 'peakActiveConnections', unit: 'FDs', format: v => v.toFixed(0) },
};

function printGrid<X, Y>(exp: ExperimentResult<X, Y>, metrics: MetricKey[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  [BM-02] ${exp.caseName}`);
  console.log(`  X: ${exp.xAxisName}  |  Y: ${exp.yAxisName}`);
  console.log(`${'═'.repeat(72)}`);

  for (const metricKey of metrics) {
    const ml = METRIC_LABELS[metricKey] || { key: metricKey, unit: '', format: (v: number) => v.toFixed(2) };
    console.log(`\n  ── ${metricKey} (${ml.unit}) ──`);
    const xLabels = exp.grid[0].map(c => c.xLabel);
    const colWidth = Math.max(10, ...xLabels.map(l => l.length + 2));
    const yColWidth = Math.max(22, ...exp.grid.map(row => row[0].yLabel.length + 2));
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
    const rows: any[] = [];
    for (const row of exp.grid) {
      const entry: Record<string, any> = { [exp.yAxisName]: row[0].yLabel };
      for (const cell of row) entry[cell.xLabel] = (cell.result[ml.key] as number) ?? 0;
      rows.push(entry);
    }
    tables[metricKey] = { unit: ml.unit, data: rows };
  }
  return { caseId: exp.caseId, caseName: exp.caseName, module: 'BM-02', xAxisName: exp.xAxisName, yAxisName: exp.yAxisName, tables, timestamp: exp.timestamp };
}

const args = process.argv.slice(2);
const caseIdx = args.indexOf('--case');
const caseFlag = caseIdx !== -1 ? args[caseIdx + 1] : null;

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   BM-02: File Descriptor Exhaustion — 2D Impact Experiments         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allResults: any[] = [];

  if (!caseFlag || caseFlag === '1') {
    console.log('\n▶ Case 1: Leak Probability × Concurrency');
    const r = runBm02Case1();
    printGrid(r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']);
    allResults.push(buildJsonOutput(r, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']));
  }
  if (!caseFlag || caseFlag === '2') {
    console.log('\n▶ Case 2: File Size × FD Limit');
    const r = runBm02Case2();
    printGrid(r, ['timeToExhaustion', 'heapGrowthBytes', 'failureRate', 'throughput']);
    allResults.push(buildJsonOutput(r, ['timeToExhaustion', 'heapGrowthBytes', 'failureRate', 'throughput']));
  }
  if (!caseFlag || caseFlag === '3') {
    console.log('\n▶ Case 3: Error Rate × Leak-on-Error Behavior');
    const r = runBm02Case3();
    printGrid(r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']);
    allResults.push(buildJsonOutput(r, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']));
  }
  if (!caseFlag || caseFlag === '4') {
    console.log('\n▶ Case 4: Open Rate × FD Limit');
    const r = runBm02Case4();
    printGrid(r, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput']);
    allResults.push(buildJsonOutput(r, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput']));
  }

  const outFile = path.join(RESULTS_DIR, `experiments-bm02-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Results: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
