import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, SimulationResult } from './types';

export type MetricKey = keyof SimulationResult;
export type MetricLabelMap = Record<string, { key: MetricKey; unit: string; format: (v: number) => string }>;

export function printGrid<X, Y>(moduleLabel: string, exp: ExperimentResult<X, Y>, metrics: MetricKey[], metricLabels: MetricLabelMap): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  [${moduleLabel}] ${exp.caseName}`);
  console.log(`  X: ${exp.xAxisName}  |  Y: ${exp.yAxisName}`);
  console.log(`${'═'.repeat(72)}`);
  for (const metricKey of metrics) {
    const ml = metricLabels[metricKey] || { key: metricKey, unit: '', format: (v: number) => v.toFixed(2) };
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

export function buildJsonOutput<X, Y>(moduleLabel: string, exp: ExperimentResult<X, Y>, metrics: MetricKey[], metricLabels: MetricLabelMap): any {
  const tables: Record<string, any> = {};
  for (const metricKey of metrics) {
    const ml = metricLabels[metricKey] || { key: metricKey, unit: '', format: (v: number) => v };
    const rows = exp.grid.map(row => {
      const entry: Record<string, any> = { [exp.yAxisName]: row[0].yLabel };
      for (const cell of row) entry[cell.xLabel] = (cell.result[ml.key] as number) ?? 0;
      return entry;
    });
    tables[metricKey] = { unit: ml.unit, data: rows };
  }
  return { caseId: exp.caseId, caseName: exp.caseName, module: moduleLabel, xAxisName: exp.xAxisName, yAxisName: exp.yAxisName, tables, timestamp: exp.timestamp };
}

export function writeResults(resultsDir: string, fileName: string, allResults: any[]): string {
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const outFile = path.join(resultsDir, fileName);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  return outFile;
}

export function parseCaseFlag(): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf('--case');
  return i !== -1 ? args[i + 1] : null;
}
