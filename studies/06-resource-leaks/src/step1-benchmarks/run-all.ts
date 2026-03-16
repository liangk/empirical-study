import * as fs from 'fs';
import * as path from 'path';
import { bm01 } from './modules/bm01-db-connection/index';
import { bm02 } from './modules/bm02-file-descriptor/index';
import { bm03 } from './modules/bm03-stream-leak/index';
import { bm04 } from './modules/bm04-http-socket/index';
import { bm05 } from './modules/bm05-timer-leak/index';
import { bm06 } from './modules/bm06-event-listener/index';
import { runModule } from './harness/runner';
import { LeakBenchmarkModule, LeakTrialRecord, LeakSummary, LeakComparison } from './harness/types';

const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');
const ALL_MODULES: LeakBenchmarkModule[] = [bm01, bm02, bm03, bm04, bm05, bm06];

// Parse CLI flags
const args = process.argv.slice(2);
const moduleIdx = args.indexOf('--module');
const moduleFlag = moduleIdx !== -1 ? args[moduleIdx + 1] : null;

const trialsIdx = args.indexOf('--trials');
const trialsFlag = trialsIdx !== -1 ? parseInt(args[trialsIdx + 1], 10) : undefined;

const modules = moduleFlag
  ? ALL_MODULES.filter(m => m.id === moduleFlag)
  : ALL_MODULES;

if (moduleFlag && modules.length === 0) {
  console.error(`Unknown module: ${moduleFlag}. Valid: ${ALL_MODULES.map(m => m.id).join(', ')}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  console.log('=== Study 06: Resource Leak Benchmark ===');
  console.log(`Modules: ${modules.map(m => m.id).join(', ')}`);
  console.log(`Timestamp: ${timestamp}\n`);

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const allTrials: LeakTrialRecord[] = [];
  const allSummaries: LeakSummary[] = [];
  const allComparisons: LeakComparison[] = [];

  for (const mod of modules) {
    console.log(`\n[${mod.id}] ${mod.name}`);
    console.log('─'.repeat(60));

    await mod.setup();

    for (const n of mod.nValues) {
      const result = await runModule(mod, n, trialsFlag);
      // Flatten trial sets
      for (const trialSet of [...result.leakyTrials, ...result.properTrials]) {
        allTrials.push(...trialSet);
      }
      allSummaries.push(result.leakySummary, result.properSummary);
      allComparisons.push(result.comparison);
    }

    await mod.teardown();
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

  console.log('\n=== Leak Rate Summary ===');
  console.log(`${'Module'.padEnd(8)} ${'n'.padStart(6)} ${'Leaky Rate'.padStart(12)} ${'Proper Rate'.padStart(12)} ${'Cohen d'.padStart(10)} ${'p-value'.padStart(10)}`);
  for (const c of allComparisons) {
    const dStr = c.cohensD === Infinity ? '∞' : c.cohensD.toFixed(2);
    console.log(
      `${c.module.padEnd(8)} ${String(c.n).padStart(6)} ` +
      `${c.leakyLeakRate.toFixed(3).padStart(12)} ${c.properLeakRate.toFixed(3).padStart(12)} ` +
      `${dStr.padStart(10)} ${c.pValue.toFixed(6).padStart(10)}`
    );
  }
}

main().catch(err => { console.error(err); process.exit(1); });
