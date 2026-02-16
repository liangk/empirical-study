/**
 * Study 03 — Step 2: Memory Leak Benchmark Orchestrator
 *
 * Runs all framework-specific memory leak benchmark scenarios and collects
 * heap growth, retained object count, and GC reclaim metrics.
 *
 * Each scenario simulates repeated component mount/unmount cycles to measure
 * memory growth from missing cleanup patterns.
 *
 * Usage:
 *   ts-node src/step2-benchmarks/run-all.ts [--cycles N] [--repeats K] [--framework react|vue|angular]
 *
 * This file is a scaffold — scenario implementations will be added as the
 * benchmark suite is developed.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  /** Cycle number (1-indexed). */
  cycle: number;
  /** Heap used in bytes (from process.memoryUsage()). */
  heapUsed: number;
  /** Heap total in bytes. */
  heapTotal: number;
  /** External memory in bytes (ArrayBuffers, etc.). */
  external: number;
  /** RSS (resident set size) in bytes. */
  rss: number;
}

export interface BenchmarkResult {
  /** Scenario name (e.g., "react-useEffect-leak"). */
  scenario: string;
  /** Framework being tested. */
  framework: 'react' | 'vue' | 'angular';
  /** "bad" (leaking) or "good" (proper cleanup). */
  variant: 'bad' | 'good';
  /** Number of mount/unmount cycles run. */
  cycles: number;
  /** Memory snapshot after each cycle. */
  snapshots: MemorySnapshot[];
  /** Heap growth from first to last snapshot (bytes). */
  totalHeapGrowth: number;
  /** Average heap growth per cycle (bytes). */
  avgHeapGrowthPerCycle: number;
  /** Peak heap used across all snapshots (bytes). */
  peakHeapUsed: number;
  /** Duration of the benchmark run (ms). */
  durationMs: number;
}

export interface ScenarioDefinition {
  name: string;
  framework: 'react' | 'vue' | 'angular';
  description: string;
  /** Function that simulates the "bad" (leaking) pattern for N cycles. */
  runBad: (cycles: number) => Promise<MemorySnapshot[]>;
  /** Function that simulates the "good" (cleanup) pattern for N cycles. */
  runGood: (cycles: number) => Promise<MemorySnapshot[]>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESULTS_DIR = join(__dirname, '..', '..', 'results');
const DEFAULT_CYCLES = 100;
const DEFAULT_REPEATS = 3;

// ---------------------------------------------------------------------------
// Scenario registry — import scenarios here as they are built
// ---------------------------------------------------------------------------

import { reactUseEffectScenario } from './scenarios/react-useeffect-leak';
import { vueOnMountedScenario } from './scenarios/vue-onmounted-leak';
import { angularSubscribeScenario } from './scenarios/angular-subscribe-leak';
import { vueWatchStopScenario } from './scenarios/vue-watch-stop-leak';
import { rafCancelScenario } from './scenarios/raf-cancel-leak';
// Note: observer-disconnect-leak requires DOM environment (browser/jsdom)
// import { observerDisconnectScenario } from './scenarios/observer-disconnect-leak';

const SCENARIOS: ScenarioDefinition[] = [
  reactUseEffectScenario,
  vueOnMountedScenario,
  angularSubscribeScenario,
  vueWatchStopScenario,
  rafCancelScenario,
  // observerDisconnectScenario, // Enable when running with jsdom/browser environment
];

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

function takeSnapshot(cycle: number): MemorySnapshot {
  if (global.gc) global.gc(); // Force GC if --expose-gc is enabled
  const mem = process.memoryUsage();
  return {
    cycle,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

function computeResult(
  scenario: string,
  framework: 'react' | 'vue' | 'angular',
  variant: 'bad' | 'good',
  cycles: number,
  snapshots: MemorySnapshot[],
  durationMs: number,
): BenchmarkResult {
  const first = snapshots[0]?.heapUsed || 0;
  const last = snapshots[snapshots.length - 1]?.heapUsed || 0;
  const totalHeapGrowth = last - first;
  const avgHeapGrowthPerCycle = cycles > 0 ? totalHeapGrowth / cycles : 0;
  const peakHeapUsed = Math.max(...snapshots.map(s => s.heapUsed));

  return {
    scenario,
    framework,
    variant,
    cycles,
    snapshots,
    totalHeapGrowth,
    avgHeapGrowthPerCycle,
    peakHeapUsed,
    durationMs,
  };
}

interface ScenarioStats {
  scenario: string;
  framework: 'react' | 'vue' | 'angular';
  cycles: number;
  repeats: number;
  bad: { meanGrowthKB: number; stdGrowthKB: number; rateKBPerCycle: number };
  good: { meanGrowthKB: number; stdGrowthKB: number; rateKBPerCycle: number };
  delta: { meanKB: number; stdKB: number; rateKBPerCycle: number };
  allRuns: Array<{ bad: BenchmarkResult; good: BenchmarkResult }>;
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

async function runScenarioWithRepeats(
  def: ScenarioDefinition,
  cycles: number,
  repeats: number,
  scenarioIndex: number,
  scenarioTotal: number,
): Promise<ScenarioStats> {
  console.log(`\n--- [${scenarioIndex}/${scenarioTotal}] ${def.name} (${def.framework}) ---`);
  console.log(`  ${def.description}`);
  console.log(`  Cycles: ${cycles}, Repeats: ${repeats}`);

  const allRuns: Array<{ bad: BenchmarkResult; good: BenchmarkResult }> = [];
  const badGrowths: number[] = [];
  const goodGrowths: number[] = [];

  for (let r = 1; r <= repeats; r++) {
    console.log(`  [Run ${r}/${repeats}] BAD...`);
    const badStart = Date.now();
    const badSnapshots = await def.runBad(cycles);
    const badDuration = Date.now() - badStart;
    const bad = computeResult(def.name, def.framework, 'bad', cycles, badSnapshots, badDuration);

    console.log(`  [Run ${r}/${repeats}] GOOD...`);
    const goodStart = Date.now();
    const goodSnapshots = await def.runGood(cycles);
    const goodDuration = Date.now() - goodStart;
    const good = computeResult(def.name, def.framework, 'good', cycles, goodSnapshots, goodDuration);

    allRuns.push({ bad, good });
    badGrowths.push(bad.totalHeapGrowth);
    goodGrowths.push(good.totalHeapGrowth);
  }

  const badMean = mean(badGrowths);
  const badStd = std(badGrowths);
  const goodMean = mean(goodGrowths);
  const goodStd = std(goodGrowths);
  const deltas = badGrowths.map((b, i) => b - goodGrowths[i]);
  const deltaMean = mean(deltas);
  const deltaStd = std(deltas);

  const toKB = (b: number) => b / 1024;
  const stats: ScenarioStats = {
    scenario: def.name,
    framework: def.framework,
    cycles,
    repeats,
    bad: { meanGrowthKB: toKB(badMean), stdGrowthKB: toKB(badStd), rateKBPerCycle: toKB(badMean) / cycles },
    good: { meanGrowthKB: toKB(goodMean), stdGrowthKB: toKB(goodStd), rateKBPerCycle: toKB(goodMean) / cycles },
    delta: { meanKB: toKB(deltaMean), stdKB: toKB(deltaStd), rateKBPerCycle: toKB(deltaMean) / cycles },
    allRuns,
  };

  // Print summary
  const fmt = (n: number) => n.toFixed(1);
  console.log(`\n  Summary (${repeats} runs):`);
  console.log(`    BAD:   mean = ${fmt(stats.bad.meanGrowthKB)} KB, std = ${fmt(stats.bad.stdGrowthKB)} KB, rate = ${fmt(stats.bad.rateKBPerCycle)} KB/cycle`);
  console.log(`    GOOD:  mean = ${fmt(stats.good.meanGrowthKB)} KB, std = ${fmt(stats.good.stdGrowthKB)} KB, rate = ${fmt(stats.good.rateKBPerCycle)} KB/cycle`);
  console.log(`    DELTA: mean = ${fmt(stats.delta.meanKB)} KB, std = ${fmt(stats.delta.stdKB)} KB, rate = ${fmt(stats.delta.rateKBPerCycle)} KB/cycle`);

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const cyclesIdx = args.indexOf('--cycles');
  const cycles = cyclesIdx >= 0 ? parseInt(args[cyclesIdx + 1], 10) : DEFAULT_CYCLES;
  const repeatsIdx = args.indexOf('--repeats');
  const repeats = repeatsIdx >= 0 ? parseInt(args[repeatsIdx + 1], 10) : DEFAULT_REPEATS;
  const frameworkIdx = args.indexOf('--framework');
  const frameworkFilter = frameworkIdx >= 0 ? args[frameworkIdx + 1] : undefined;

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  let scenarios = SCENARIOS;
  if (frameworkFilter) {
    scenarios = scenarios.filter(s => s.framework === frameworkFilter);
  }

  if (scenarios.length === 0) {
    console.log('No benchmark scenarios registered yet.');
    console.log('Implement scenario modules in src/step2-benchmarks/scenarios/ and register them in run-all.ts.');
    return;
  }

  console.log(`\n=== Study 03: Memory Leak Benchmarks ===`);
  console.log(`Cycles: ${cycles}, Repeats: ${repeats}`);
  console.log(`Scenarios: ${scenarios.length}`);

  const allStats: ScenarioStats[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const stats = await runScenarioWithRepeats(scenario, cycles, repeats, i + 1, scenarios.length);
    allStats.push(stats);
  }

  // Print final summary table
  console.log(`\n${'='.repeat(80)}`);
  console.log(`FINAL SUMMARY (mean ± std, KB)`);
  console.log(`${'='.repeat(80)}`);
  console.log(`${'Scenario'.padEnd(30)} ${'BAD'.padStart(18)} ${'GOOD'.padStart(18)} ${'DELTA'.padStart(18)}`);
  console.log(`${'-'.repeat(30)} ${'-'.repeat(18)} ${'-'.repeat(18)} ${'-'.repeat(18)}`);
  for (const s of allStats) {
    const fmt = (m: number, d: number) => `${m.toFixed(1)} ± ${d.toFixed(1)}`;
    console.log(
      `${s.scenario.padEnd(30)} ${fmt(s.bad.meanGrowthKB, s.bad.stdGrowthKB).padStart(18)} ` +
      `${fmt(s.good.meanGrowthKB, s.good.stdGrowthKB).padStart(18)} ` +
      `${fmt(s.delta.meanKB, s.delta.stdKB).padStart(18)}`
    );
  }
  console.log(`${'='.repeat(80)}`);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(RESULTS_DIR, `bench-${timestamp}.json`);
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      cycles,
      repeats,
      scenarioCount: scenarios.length,
      frameworkFilter: frameworkFilter || 'all',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    stats: allStats.map(s => ({
      scenario: s.scenario,
      framework: s.framework,
      cycles: s.cycles,
      repeats: s.repeats,
      bad: s.bad,
      good: s.good,
      delta: s.delta,
    })),
    rawRuns: allStats.map(s => ({ scenario: s.scenario, runs: s.allRuns })),
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
