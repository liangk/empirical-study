import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { runTrials } from './harness/runner';
import { summarize, compare } from './harness/stats';
import type { BenchmarkModule, BenchmarkOutput, BenchmarkSummary, ComparisonResult, RunConfig, TrialRecord } from './harness/types';
import { runBaseline as bm01Base } from './modules/bm01-regex/baseline';
import { runOptimized as bm01Opt } from './modules/bm01-regex/optimized';
import { runBaseline as bm02Base } from './modules/bm02-json/baseline';
import { runOptimized as bm02Opt } from './modules/bm02-json/optimized';
import { runBaseline as bm04Base } from './modules/bm04-nested-loops/baseline';
import { runOptimized as bm04Opt } from './modules/bm04-nested-loops/optimized';
import { runBaseline as bm05Base } from './modules/bm05-nested-array/baseline';
import { runOptimized as bm05Opt } from './modules/bm05-nested-array/optimized';
import { runBaseline as bm06Base } from './modules/bm06-chained-array/baseline';
import { runOptimized as bm06Opt } from './modules/bm06-chained-array/optimized';

const RESULTS_DIR = join(__dirname, '..', '..', 'results');

const DEFAULT_CONFIG: RunConfig = {
  trials: 30,
  warmupIterations: 50,
  sleepBetweenTrialsMs: 200,
  moduleFilter: null,
  nFilter: null,
};

const N_VALUES = [10, 100, 1_000, 10_000, 100_000];

const MODULES: BenchmarkModule[] = [
  {
    id: 'BM-01', name: 'Regex Compilation Inside Loop',
    description: 'Regex literal compiled on every iteration vs. hoisted constant.',
    hypothesis: 'H2', nValues: N_VALUES, isAsync: false,
    runBaseline: (n) => bm01Base(n),
    runOptimized: (n) => bm01Opt(n),
  },
  {
    id: 'BM-02', name: 'JSON Parsing Inside Loop',
    description: 'JSON.parse() called every iteration vs. cached before loop.',
    hypothesis: null, nValues: N_VALUES, isAsync: false,
    runBaseline: (n) => bm02Base(n),
    runOptimized: (n) => bm02Opt(n),
  },
  {
    id: 'BM-04', name: 'Nested Loops — O(n²) vs O(n) via Map',
    description: 'Inner linear scan vs. Map.get() O(1) lookup.',
    hypothesis: 'H1+H4', nValues: N_VALUES, isAsync: false,
    runBaseline: (n) => bm04Base(n),
    runOptimized: (n) => bm04Opt(n),
  },
  {
    id: 'BM-05', name: 'Nested Array Methods (forEach-in-forEach)',
    description: 'Nested forEach callback overhead vs. direct for-loop.',
    hypothesis: null, nValues: N_VALUES, isAsync: false,
    runBaseline: (n) => bm05Base(n),
    runOptimized: (n) => bm05Opt(n),
  },
  {
    id: 'BM-06', name: 'Chained Array Methods (filter+map)',
    description: 'Two-pass filter().map() with intermediate array vs. single-pass reduce.',
    hypothesis: null, nValues: N_VALUES, isAsync: false,
    runBaseline: (n) => bm06Base(n),
    runOptimized: (n) => bm06Opt(n),
  },
];

function parseArgs(): RunConfig {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    trials: parseInt(get('--trials') ?? String(DEFAULT_CONFIG.trials), 10),
    warmupIterations: parseInt(get('--warmup') ?? String(DEFAULT_CONFIG.warmupIterations), 10),
    sleepBetweenTrialsMs: DEFAULT_CONFIG.sleepBetweenTrialsMs,
    moduleFilter: get('--module') ?? null,
    nFilter: get('--n') ? parseInt(get('--n')!, 10) : null,
  };
}

function hypothesisFn(id: string): ((speedup: number) => boolean) | undefined {
  if (id === 'BM-01') return (s) => s >= 5;
  if (id === 'BM-04') return (s) => s >= 100;
  return undefined;
}

async function main(): Promise<void> {
  const config = parseArgs();

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const activeModules = MODULES.filter(m =>
    !config.moduleFilter || m.id === config.moduleFilter,
  );

  if (activeModules.length === 0) {
    console.error(`No modules match filter: ${config.moduleFilter}`);
    process.exit(1);
  }

  console.log('\n=== Study 04: Loop Performance Benchmarks ===');
  console.log(`Modules : ${activeModules.map(m => m.id).join(', ')}`);
  console.log(`n values: ${config.nFilter ? [config.nFilter] : N_VALUES}`);
  console.log(`Trials  : ${config.trials}  Warmup: ${config.warmupIterations}`);
  console.log(`Node    : ${process.version}  Platform: ${process.platform}\n`);
  console.log('NOTE: BM-03 (async I/O) and BM-07 (DOM) require separate runners.');
  console.log('      Run bench:bm03 and open bm07-dom/*.html in Chrome separately.\n');

  const allTrials: TrialRecord[] = [];
  const allSummaries: BenchmarkSummary[] = [];
  const allComparisons: ComparisonResult[] = [];

  const nValues = config.nFilter ? [config.nFilter] : N_VALUES;
  const env = `node_${process.version}`;

  for (const mod of activeModules) {
    console.log(`\n--- ${mod.id}: ${mod.name} ---`);
    for (const n of nValues) {
      if (!mod.nValues.includes(n)) continue;

      const baseTrials = await runTrials(mod, 'baseline', n, config);
      const optTrials = await runTrials(mod, 'optimized', n, config);

      allTrials.push(...baseTrials, ...optTrials);

      const baseSummary = summarize(baseTrials, mod.id, 'baseline', n, env);
      const optSummary = summarize(optTrials, mod.id, 'optimized', n, env);
      allSummaries.push(baseSummary, optSummary);

      const comparison = compare(baseSummary, optSummary, baseTrials, optTrials, hypothesisFn(mod.id));
      allComparisons.push(comparison);

      const flag = comparison.anomaly ? '⚠ ANOMALY' : comparison.hypothesisMet === false ? '✗ H-MISS' : comparison.hypothesisMet ? '✓ H-MET' : '';
      console.log(
        `  n=${n}: speedup=${comparison.speedupRatio.toFixed(2)}×  p=${comparison.pValue.toFixed(4)}  d=${comparison.cohensD.toFixed(2)} (${comparison.effectSize})  ${flag}`,
      );
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output: BenchmarkOutput = {
    metadata: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      config,
    },
    trials: allTrials,
    summaries: allSummaries,
    comparisons: allComparisons,
  };

  const outputPath = join(RESULTS_DIR, `bench-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  const flagged = allSummaries.filter(s => s.flaggedHighCV);
  if (flagged.length > 0) {
    console.warn(`\n⚠ ${flagged.length} configuration(s) have CV > 10% — review before publishing:`);
    flagged.forEach(s => console.warn(`  ${s.moduleId} ${s.pattern} n=${s.n}: CV=${s.cvPct.toFixed(1)}%`));
  }
  const anomalies = allComparisons.filter(c => c.anomaly);
  if (anomalies.length > 0) {
    console.warn(`\n⚠ ${anomalies.length} configuration(s) show speedup < 1.0 (optimization slower):`);
    anomalies.forEach(c => console.warn(`  ${c.moduleId} n=${c.n}: speedup=${c.speedupRatio.toFixed(3)}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
