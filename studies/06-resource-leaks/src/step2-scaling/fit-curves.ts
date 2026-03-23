import * as fs from 'fs';
import * as path from 'path';
import { linearRegression, median } from '../step1-benchmarks/harness/stats';

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'results');
const BM_DIRS = ['bm01', 'bm02', 'bm03', 'bm04', 'bm05', 'bm06'] as const;

interface ExperimentTable {
  unit: string;
  data: Array<Record<string, number | string | null>>;
}

interface ExperimentFileCase {
  caseId: string;
  caseName: string;
  xAxisName: string;
  yAxisName: string;
  tables: Record<string, ExperimentTable>;
}

interface ScalingResult {
  module: string;
  caseId: string;
  caseName: string;
  sourceFile: string;
  xAxisName: string;
  yAxisName: string;
  metrics: MetricScalingResult[];
  observedTimeToExhaustion: ObservedTimeToExhaustionSummary | null;
}

interface MetricScalingResult {
  metric: string;
  unit: string;
  sampleCount: number;
  nullCount: number;
  distinctXCount: number;
  distinctYCount: number;
  medianValue: number;
  fitByX: { a: number; b: number; rSquared: number } | null;
  fitByY: { a: number; b: number; rSquared: number } | null;
}

interface ObservedTimeToExhaustionSummary {
  finiteSampleCount: number;
  medianMs: number;
  medianHuman: string;
  minMs: number;
  maxMs: number;
}

type ExperimentSource = 'classic' | 'redesign';

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}hr`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function parseNumericLabel(label: string): number | null {
  const normalized = label.replace(/,/g, '').trim();
  if (normalized === '∞' || normalized.toLowerCase() === 'infinity') return null;

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (Number.isNaN(value)) return null;

  if (/mb/i.test(normalized)) return value * 1024 * 1024;
  if (/kb/i.test(normalized)) return value * 1024;
  if (/hz/i.test(normalized)) return value;
  if (/%/.test(normalized)) return value / 100;
  return value;
}

function summarizeObservedTimeToExhaustion(table: ExperimentTable | undefined): ObservedTimeToExhaustionSummary | null {
  if (!table) return null;

  const values: number[] = [];
  for (const row of table.data) {
    for (const cellValue of Object.values(row)) {
      if (typeof cellValue === 'number' && Number.isFinite(cellValue)) values.push(cellValue);
    }
  }

  if (values.length === 0) return null;

  const medianMs = median(values);
  return {
    finiteSampleCount: values.length,
    medianMs,
    medianHuman: humanDuration(medianMs / 1000),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  };
}

function getLatestExperimentFile(dir: string): string | null {
  const files = fs.readdirSync(dir)
    .filter(file => file.startsWith('experiments') && file.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] ?? null;
}

function parseExperimentSource(): ExperimentSource {
  const args = process.argv.slice(2);
  const i = args.indexOf('--source');
  const selected = i !== -1 ? args[i + 1] : null;
  if (selected === 'classic') return 'classic';
  if (selected === 'redesign') return 'redesign';

  const redesignDir = path.join(__dirname, '..', 'step1-benchmarks', 'experiments-redisign');
  if (fs.existsSync(redesignDir)) return 'redesign';
  return 'classic';
}

function getExperimentsDir(source: ExperimentSource): string {
  return path.join(__dirname, '..', 'step1-benchmarks', source === 'redesign' ? 'experiments-redisign' : 'experiments');
}

function loadAllExperiments(source: ExperimentSource): Array<{ module: string; fileName: string; cases: ExperimentFileCase[] }> {
  const loaded: Array<{ module: string; fileName: string; cases: ExperimentFileCase[] }> = [];
  const experimentsDir = getExperimentsDir(source);

  for (const bmDir of BM_DIRS) {
    const dir = path.join(experimentsDir, bmDir);
    if (!fs.existsSync(dir)) continue;

    const latestFile = getLatestExperimentFile(dir);
    if (!latestFile) continue;

    const absolutePath = path.join(dir, latestFile);
    const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as ExperimentFileCase[];
    const moduleName = bmDir.toUpperCase().replace('BM', 'BM-');
    loaded.push({ module: moduleName, fileName: latestFile, cases: raw });
  }

  return loaded;
}

function fitMetricTables(experiments: Array<{ module: string; fileName: string; cases: ExperimentFileCase[] }>): ScalingResult[] {
  const results: ScalingResult[] = [];

  for (const experimentSet of experiments) {
    for (const experimentCase of experimentSet.cases) {
      const metrics: MetricScalingResult[] = [];
      const observedTimeToExhaustion = summarizeObservedTimeToExhaustion(experimentCase.tables.timeToExhaustion);

      for (const [metric, table] of Object.entries(experimentCase.tables ?? {})) {
        const xSamples: number[] = [];
        const ySamples: number[] = [];
        const values: number[] = [];
        let nullCount = 0;

        for (const row of table.data) {
          const yRaw = row[experimentCase.yAxisName];
          const yValue = typeof yRaw === 'string' ? parseNumericLabel(yRaw) : typeof yRaw === 'number' ? yRaw : null;
          if (yValue === null) continue;

          for (const [column, cellValue] of Object.entries(row)) {
            if (column === experimentCase.yAxisName) continue;
            if (cellValue === null) {
              nullCount += 1;
              continue;
            }
            if (typeof cellValue !== 'number' || !Number.isFinite(cellValue)) continue;

            const xValue = parseNumericLabel(column);
            if (xValue === null) continue;

            xSamples.push(xValue);
            ySamples.push(yValue);
            values.push(cellValue);
          }
        }

        if (values.length === 0) continue;

        const distinctXCount = new Set(xSamples).size;
        const distinctYCount = new Set(ySamples).size;
        const fitByX = distinctXCount >= 2 ? linearRegression(xSamples, values) : null;
        const fitByY = distinctYCount >= 2 ? linearRegression(ySamples, values) : null;

        metrics.push({
          metric,
          unit: table.unit,
          sampleCount: values.length,
          nullCount,
          distinctXCount,
          distinctYCount,
          medianValue: median(values),
          fitByX,
          fitByY,
        });
      }

      results.push({
        module: experimentSet.module,
        caseId: experimentCase.caseId,
        caseName: experimentCase.caseName,
        sourceFile: experimentSet.fileName,
        xAxisName: experimentCase.xAxisName,
        yAxisName: experimentCase.yAxisName,
        metrics,
        observedTimeToExhaustion,
      });
    }
  }

  return results;
}

if (require.main === module) {
  const source = parseExperimentSource();
  const experiments = loadAllExperiments(source);

  if (experiments.length === 0) {
    console.error(`No experiment files found under ${getExperimentsDir(source)}.`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const results = fitMetricTables(experiments);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(OUTPUT_DIR, `scaling-${source}-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log(`Scaling source: ${source}`);
  console.log(`Scaling results: ${outFile}\n`);

  for (const r of results) {
    console.log(`[${r.module}] ${r.caseId} - ${r.caseName}`);
    for (const metric of r.metrics) {
      const xFit = metric.fitByX ? `x-fit: y = ${metric.fitByX.a.toFixed(4)} + ${metric.fitByX.b.toFixed(6)}*x (R²=${metric.fitByX.rSquared.toFixed(3)})` : 'x-fit: n/a';
      const yFit = metric.fitByY ? `y-fit: y = ${metric.fitByY.a.toFixed(4)} + ${metric.fitByY.b.toFixed(6)}*y (R²=${metric.fitByY.rSquared.toFixed(3)})` : 'y-fit: n/a';
      console.log(`  ${metric.metric} [${metric.unit}] median=${metric.medianValue.toFixed(4)} | samples=${metric.sampleCount}, nulls=${metric.nullCount}, distinctX=${metric.distinctXCount}, distinctY=${metric.distinctYCount} | ${xFit} | ${yFit}`);
    }
    if (r.observedTimeToExhaustion) {
      console.log(`  Observed TTE: median=${r.observedTimeToExhaustion.medianHuman} (${r.observedTimeToExhaustion.medianMs.toFixed(0)}ms), min=${r.observedTimeToExhaustion.minMs.toFixed(0)}ms, max=${r.observedTimeToExhaustion.maxMs.toFixed(0)}ms, finiteSamples=${r.observedTimeToExhaustion.finiteSampleCount}`);
    }
    console.log();
  }
}
