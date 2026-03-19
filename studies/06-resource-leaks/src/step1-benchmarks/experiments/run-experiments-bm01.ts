import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, GridCell, SimulationResult } from './types';
import { runCase1 } from './bm01/case1-leak-prob-x-concurrency';
import { runCase2 } from './bm01/case2-query-time-x-pool-size';
import { runCase3 } from './bm01/case3-burst-x-timeout';
import { runCase4 } from './bm01/case4-error-rate-x-leak-on-error';
import { runCase5 } from './bm01/case5-leak-prob-x-max-conns';

const RESULTS_DIR = path.join(__dirname, 'bm01');

type MetricKey = keyof SimulationResult;

const METRIC_LABELS: Record<string, { key: MetricKey; unit: string; format: (v: number) => string }> = {
  failureRate:          { key: 'failureRate',          unit: '%',    format: v => (v * 100).toFixed(1) },
  throughput:           { key: 'throughput',            unit: 'req/s', format: v => v.toFixed(0) },
  p95LatencyMs:         { key: 'p95LatencyMs',         unit: 'ms',   format: v => v.toFixed(0) },
  leakedConnections:    { key: 'leakedConnections',    unit: '',     format: v => v.toFixed(0) },
  timeToExhaustion:     { key: 'timeToExhaustion',     unit: 'ms',   format: v => v === Infinity ? '∞' : v.toFixed(0) },
  meanLatencyMs:        { key: 'meanLatencyMs',        unit: 'ms',   format: v => v.toFixed(1) },
  peakActiveConnections:{ key: 'peakActiveConnections', unit: '',     format: v => v.toFixed(0) },
  successfulRequests:   { key: 'successfulRequests',   unit: '',     format: v => v.toFixed(0) },
  failedRequests:       { key: 'failedRequests',       unit: '',     format: v => v.toFixed(0) },
};

function printGrid<X, Y>(exp: ExperimentResult<X, Y>, metrics: MetricKey[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  ${exp.caseName}`);
  console.log(`  X: ${exp.xAxisName}  |  Y: ${exp.yAxisName}`);
  console.log(`${'═'.repeat(72)}`);

  for (const metricKey of metrics) {
    const ml = METRIC_LABELS[metricKey] || { key: metricKey, unit: '', format: (v: number) => v.toFixed(2) };
    console.log(`\n  ── ${metricKey} (${ml.unit || 'value'}) ──`);

    // Header row
    const xLabels = exp.grid[0].map(c => c.xLabel);
    const colWidth = Math.max(10, ...xLabels.map(l => l.length + 2));
    const yColWidth = Math.max(22, ...exp.grid.map(row => row[0].yLabel.length + 2));

    console.log(`  ${''.padEnd(yColWidth)}${xLabels.map(l => l.padStart(colWidth)).join('')}`);
    console.log(`  ${''.padEnd(yColWidth)}${xLabels.map(() => '─'.repeat(colWidth)).join('')}`);

    for (const row of exp.grid) {
      const yLabel = row[0].yLabel;
      const cells = row.map(cell => {
        const val = cell.result[ml.key] as number;
        return ml.format(val).padStart(colWidth);
      });
      console.log(`  ${yLabel.padEnd(yColWidth)}${cells.join('')}`);
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
      for (const cell of row) {
        entry[cell.xLabel] = cell.result[ml.key] as number;
      }
      rows.push(entry);
    }
    tables[metricKey] = { unit: ml.unit, data: rows };
  }
  return { caseId: exp.caseId, caseName: exp.caseName, xAxisName: exp.xAxisName, yAxisName: exp.yAxisName, tables, timestamp: exp.timestamp };
}

// Parse CLI
const args = process.argv.slice(2);
const caseIdx = args.indexOf('--case');
const caseFlag = caseIdx !== -1 ? args[caseIdx + 1] : null;

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   Study 06 — Two-Dimensional Impact Experiments                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const allResults: any[] = [];

  // Case 1
  if (!caseFlag || caseFlag === '1') {
    console.log('\n▶ Running Case 1: Leak Probability × Concurrency ...');
    const r1 = runCase1();
    printGrid(r1, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']);
    allResults.push(buildJsonOutput(r1, ['failureRate', 'timeToExhaustion', 'throughput', 'leakedConnections']));
  }

  // Case 2
  if (!caseFlag || caseFlag === '2') {
    console.log('\n▶ Running Case 2: Query Time × Pool Size ...');
    const r2 = runCase2();
    printGrid(r2, ['throughput', 'failureRate', 'leakedConnections', 'meanLatencyMs']);
    allResults.push(buildJsonOutput(r2, ['throughput', 'failureRate', 'leakedConnections', 'meanLatencyMs']));
  }

  // Case 3
  if (!caseFlag || caseFlag === '3') {
    console.log('\n▶ Running Case 3: Burst Size × Acquire Timeout ...');
    const r3 = runCase3();
    printGrid(r3, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections']);
    allResults.push(buildJsonOutput(r3, ['p95LatencyMs', 'failureRate', 'throughput', 'peakActiveConnections']));
  }

  // Case 4
  if (!caseFlag || caseFlag === '4') {
    console.log('\n▶ Running Case 4: Error Rate × Leak-on-Error Behavior ...');
    const r4 = runCase4();
    printGrid(r4, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']);
    allResults.push(buildJsonOutput(r4, ['leakedConnections', 'failureRate', 'timeToExhaustion', 'throughput']));
  }

  // Case 5
  if (!caseFlag || caseFlag === '5') {
    console.log('\n▶ Running Case 5: Leak Probability × DB Max Connections ...');
    const r5 = runCase5();
    printGrid(r5, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput']);
    allResults.push(buildJsonOutput(r5, ['timeToExhaustion', 'failureRate', 'leakedConnections', 'throughput']));
  }

  // Write JSON results
  const outFile = path.join(RESULTS_DIR, `experiments-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Results: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
