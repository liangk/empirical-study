import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, SimulationResult } from './types';
import { runBm06Case1 } from './bm06/case1-leak-prob-x-listener-count';
import { runBm06Case2 } from './bm06/case2-closure-size-x-leak-prob';
import { runBm06Case3 } from './bm06/case3-event-freq-x-listener-count';
import { runBm06Case4 } from './bm06/case4-emitter-count-x-listeners';
import { runBm06Case5 } from './bm06/case5-once-vs-on-x-leak-rate';

const RESULTS_DIR = path.join(__dirname, 'bm06');
type MetricKey = keyof SimulationResult;

const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  leakedConnections:        { key: 'leakedConnections',        unit: 'listeners', format: v => v.toFixed(0) },
  heapGrowthBytes:          { key: 'heapGrowthBytes',          unit: 'bytes',     format: v => (v ?? 0) >= 1_048_576 ? `${((v ?? 0) / 1_048_576).toFixed(1)}MB` : (v ?? 0) >= 1024 ? `${((v ?? 0) / 1024).toFixed(0)}KB` : `${(v ?? 0).toFixed(0)}B` },
  totalCallbackInvocations: { key: 'totalCallbackInvocations', unit: 'calls',     format: v => (v ?? 0) >= 1_000_000 ? `${((v ?? 0) / 1_000_000).toFixed(1)}M` : (v ?? 0) >= 1000 ? `${((v ?? 0) / 1000).toFixed(0)}K` : `${(v ?? 0).toFixed(0)}` },
  meanEmitLatencyMs:        { key: 'meanEmitLatencyMs',        unit: 'ms',        format: v => ((v ?? 0) * 1000).toFixed(1) + 'µs' },
  timeToExhaustion:         { key: 'timeToExhaustion',         unit: 'ms',        format: v => v === Infinity ? '∞' : v.toFixed(0) },
  throughput:               { key: 'throughput',               unit: 'ops/s',     format: v => v.toFixed(0) },
  peakActiveConnections:    { key: 'peakActiveConnections',    unit: 'listeners', format: v => v.toFixed(0) },
};

function printGrid<X, Y>(exp: ExperimentResult<X, Y>, metrics: MetricKey[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  [BM-06] ${exp.caseName}`);
  console.log(`  X: ${exp.xAxisName}  |  Y: ${exp.yAxisName}`);
  console.log(`${'═'.repeat(72)}`);
  for (const metricKey of metrics) {
    const ml = METRIC_LABELS[metricKey] || { key: metricKey, unit: '', format: (v: number) => v.toFixed(2) };
    console.log(`\n  ── ${metricKey} (${ml.unit}) ──`);
    const xLabels = exp.grid[0].map(c => c.xLabel);
    const colWidth = Math.max(10, ...xLabels.map(l => l.length + 2));
    const yColWidth = Math.max(20, ...exp.grid.map(row => row[0].yLabel.length + 2));
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
  return { caseId: exp.caseId, caseName: exp.caseName, module: 'BM-06', xAxisName: exp.xAxisName, yAxisName: exp.yAxisName, tables, timestamp: exp.timestamp };
}

const args = process.argv.slice(2);
const caseFlag = (() => { const i = args.indexOf('--case'); return i !== -1 ? args[i + 1] : null; })();

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   BM-06: Event Listener Leak — 2D Impact Experiments                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allResults: any[] = [];

  if (!caseFlag || caseFlag === '1') {
    console.log('\n▶ Case 1: Leak Probability × Listeners Per Component');
    const r = runBm06Case1();
    printGrid(r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'totalCallbackInvocations']);
    allResults.push(buildJsonOutput(r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'totalCallbackInvocations']));
  }
  if (!caseFlag || caseFlag === '2') {
    console.log('\n▶ Case 2: Closure Size × Leak Probability');
    const r = runBm06Case2();
    printGrid(r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput']);
    allResults.push(buildJsonOutput(r, ['heapGrowthBytes', 'leakedConnections', 'timeToExhaustion', 'throughput']));
  }
  if (!caseFlag || caseFlag === '3') {
    console.log('\n▶ Case 3: Event Frequency × Listener Count');
    const r = runBm06Case3();
    printGrid(r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanEmitLatencyMs']);
    allResults.push(buildJsonOutput(r, ['totalCallbackInvocations', 'leakedConnections', 'heapGrowthBytes', 'meanEmitLatencyMs']));
  }
  if (!caseFlag || caseFlag === '4') {
    console.log('\n▶ Case 4: Emitter Count × Listeners Per Emitter');
    const r = runBm06Case4();
    printGrid(r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'peakActiveConnections']);
    allResults.push(buildJsonOutput(r, ['leakedConnections', 'heapGrowthBytes', 'timeToExhaustion', 'peakActiveConnections']));
  }
  if (!caseFlag || caseFlag === '5') {
    console.log('\n▶ Case 5: Listener Type (once vs on) × Leak Probability');
    const r = runBm06Case5();
    printGrid(r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion']);
    allResults.push(buildJsonOutput(r, ['leakedConnections', 'heapGrowthBytes', 'totalCallbackInvocations', 'timeToExhaustion']));
  }

  const outFile = path.join(RESULTS_DIR, `experiments-bm06-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\n${'─'.repeat(72)}\nResults: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
