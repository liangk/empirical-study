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
 *   ts-node src/step2-benchmarks/run-all.ts [--cycles N] [--framework react|vue|angular]
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

// ---------------------------------------------------------------------------
// Scenario registry — import scenarios here as they are built
// ---------------------------------------------------------------------------

import { reactUseEffectScenario } from './scenarios/react-useeffect-leak';
import { vueOnMountedScenario } from './scenarios/vue-onmounted-leak';
import { angularSubscribeScenario } from './scenarios/angular-subscribe-leak';

const SCENARIOS: ScenarioDefinition[] = [
  reactUseEffectScenario,
  vueOnMountedScenario,
  angularSubscribeScenario,
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

async function runScenario(def: ScenarioDefinition, cycles: number): Promise<{ bad: BenchmarkResult; good: BenchmarkResult }> {
  console.log(`\n--- ${def.name} (${def.framework}) ---`);
  console.log(`  ${def.description}`);

  // Run bad variant
  console.log(`  Running BAD (leaking) variant... ${cycles} cycles`);
  const badStart = Date.now();
  const badSnapshots = await def.runBad(cycles);
  const badDuration = Date.now() - badStart;
  const bad = computeResult(def.name, def.framework, 'bad', cycles, badSnapshots, badDuration);

  // Run good variant
  console.log(`  Running GOOD (cleanup) variant... ${cycles} cycles`);
  const goodStart = Date.now();
  const goodSnapshots = await def.runGood(cycles);
  const goodDuration = Date.now() - goodStart;
  const good = computeResult(def.name, def.framework, 'good', cycles, goodSnapshots, goodDuration);

  // Print comparison
  const formatBytes = (b: number) => `${(b / 1024).toFixed(1)} KB`;
  console.log(`\n  Results:`);
  console.log(`    BAD:  heap growth = ${formatBytes(bad.totalHeapGrowth)}, peak = ${formatBytes(bad.peakHeapUsed)}, ${badDuration}ms`);
  console.log(`    GOOD: heap growth = ${formatBytes(good.totalHeapGrowth)}, peak = ${formatBytes(good.peakHeapUsed)}, ${goodDuration}ms`);
  const ratio = good.totalHeapGrowth > 0
    ? (bad.totalHeapGrowth / good.totalHeapGrowth).toFixed(1)
    : '∞';
  console.log(`    Leak ratio: ${ratio}x`);

  return { bad, good };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const cyclesIdx = args.indexOf('--cycles');
  const cycles = cyclesIdx >= 0 ? parseInt(args[cyclesIdx + 1], 10) : DEFAULT_CYCLES;
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
  console.log(`Cycles: ${cycles}`);
  console.log(`Scenarios: ${scenarios.length}`);

  const allResults: Array<{ bad: BenchmarkResult; good: BenchmarkResult }> = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, cycles);
    allResults.push(result);
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(RESULTS_DIR, `bench-${timestamp}.json`);
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      cycles,
      scenarioCount: scenarios.length,
      frameworkFilter: frameworkFilter || 'all',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    results: allResults,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
