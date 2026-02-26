import * as fs from 'fs';
import * as path from 'path';
import { bm01 } from './modules/bm01-lookup/baseline';
import { bm02 } from './modules/bm02-sort/baseline';
import { bm03 } from './modules/bm03-fk-scan/baseline';
import { bm04 } from './modules/bm04-composite/baseline';
import { bm05 } from './modules/bm05-covering/baseline';
import { runModule, vacuumAnalyze } from './harness/runner';
import { disconnect } from './harness/db';
import { BenchmarkModule, DbTrialRecord, BenchmarkSummary, ComparisonResult } from './harness/types';

const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');
const ALL_MODULES: BenchmarkModule[] = [bm01, bm02, bm03, bm04, bm05];

// Parse CLI flags
const args = process.argv.slice(2);
const moduleFlag = args[args.indexOf('--module') + 1] ?? null;
const trialsFlag = args[args.indexOf('--trials') + 1] ? parseInt(args[args.indexOf('--trials') + 1]) : undefined;

const modules = moduleFlag
  ? ALL_MODULES.filter(m => m.id === moduleFlag)
  : ALL_MODULES;

if (moduleFlag && modules.length === 0) {
  console.error(`Unknown module: ${moduleFlag}. Valid: ${ALL_MODULES.map(m => m.id).join(', ')}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  console.log('=== Study 05: Missing Index Benchmark ===');
  console.log(`Modules: ${modules.map(m => m.id).join(', ')}`);
  console.log(`Timestamp: ${timestamp}\n`);

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const allTrials: DbTrialRecord[] = [];
  const allSummaries: BenchmarkSummary[] = [];
  const allComparisons: ComparisonResult[] = [];

  for (const mod of modules) {
    console.log(`\n[${mod.id}] ${mod.name}`);
    console.log('─'.repeat(60));

    for (const n of mod.nValues) {
      // Seed verification: ensure table has at least n rows
      // (seeding is done separately via `npm run seed`)
      await vacuumAnalyze();

      const result = await runModule(mod, n, trialsFlag);
      allTrials.push(...result.baselineTrials, ...result.optimizedTrials);
      allSummaries.push(result.baselineSummary, result.optimizedSummary);
      allComparisons.push(result.comparison);
    }
  }

  // Write results
  const benchFile = path.join(RESULTS_DIR, `bench-${timestamp}.json`);
  const summaryFile = path.join(RESULTS_DIR, `summary-${timestamp}.json`);
  const comparisonFile = path.join(RESULTS_DIR, `comparison-${timestamp}.json`);

  fs.writeFileSync(benchFile, JSON.stringify(allTrials, null, 2));
  fs.writeFileSync(summaryFile, JSON.stringify(allSummaries, null, 2));
  fs.writeFileSync(comparisonFile, JSON.stringify(allComparisons, null, 2));

  console.log('\n=== Results ===');
  console.log(`Trials:     ${benchFile}`);
  console.log(`Summary:    ${summaryFile}`);
  console.log(`Comparison: ${comparisonFile}`);

  console.log('\n=== Speedup Summary ===');
  console.log(`${'Module'.padEnd(8)} ${'n'.padStart(10)} ${'Baseline(ms)'.padStart(14)} ${'Optimized(ms)'.padStart(14)} ${'Speedup'.padStart(10)} ${'Plan'.padStart(18)}`);
  for (const c of allComparisons) {
    console.log(
      `${c.module.padEnd(8)} ${c.n.toLocaleString().padStart(10)} ` +
      `${c.baselineMedian.toFixed(2).padStart(14)} ${c.optimizedMedian.toFixed(2).padStart(14)} ` +
      `${c.speedup.toFixed(2).padStart(9)}× ` +
      `${(c.baselinePlanType + ' → ' + c.optimizedPlanType).padStart(18)}`
    );
  }

  await disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
