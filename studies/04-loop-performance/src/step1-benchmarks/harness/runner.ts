import { performance } from 'perf_hooks';
import type { BenchmarkModule, RunConfig, TrialRecord } from './types';

const NS_PER_MS = 1e6;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function forceGC(): void {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function memSnapshot(): { heapUsed: number; rss: number } {
  const m = process.memoryUsage();
  return { heapUsed: m.heapUsed, rss: m.rss };
}

async function runOnce(fn: () => Promise<unknown> | unknown): Promise<{
  wallTimeNs: number;
  cpuTimeMs: number;
  heapBeforeBytes: number;
  heapAfterBytes: number;
  rssBytes: number;
}> {
  forceGC();
  const memBefore = memSnapshot();
  const cpuBefore = process.cpuUsage();
  const start = process.hrtime.bigint();

  await fn();

  const wallTimeNs = Number(process.hrtime.bigint() - start);
  const cpuDelta = process.cpuUsage(cpuBefore);
  const memAfter = memSnapshot();

  return {
    wallTimeNs,
    cpuTimeMs: (cpuDelta.user + cpuDelta.system) / 1000,
    heapBeforeBytes: memBefore.heapUsed,
    heapAfterBytes: memAfter.heapUsed,
    rssBytes: memAfter.rss,
  };
}

export async function runTrials(
  mod: BenchmarkModule,
  pattern: 'baseline' | 'baseline-a' | 'optimized',
  n: number,
  config: RunConfig,
): Promise<TrialRecord[]> {
  const fn = pattern === 'baseline' ? mod.runBaseline
    : pattern === 'baseline-a' ? mod.runBaselineA!
    : mod.runOptimized;
  const env = `node_${process.version}`;

  console.log(`  [${mod.id}/${pattern}] n=${n}: warming up (${config.warmupIterations} iters)...`);
  for (let w = 0; w < config.warmupIterations; w++) await fn(n);

  console.log(`  [${mod.id}/${pattern}] n=${n}: collecting ${config.trials} trials...`);
  const trials: TrialRecord[] = [];

  for (let t = 0; t < config.trials; t++) {
    const result = await runOnce(() => fn(n));
    trials.push({
      moduleId: mod.id,
      pattern,
      environment: env,
      n,
      trial: t + 1,
      wallTimeNs: result.wallTimeNs,
      cpuTimeMs: result.cpuTimeMs,
      heapBeforeBytes: result.heapBeforeBytes,
      heapAfterBytes: result.heapAfterBytes,
      rssBytes: result.rssBytes,
      timestampUtc: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
    });
    await sleep(config.sleepBetweenTrialsMs);
  }

  const walls = trials.map(tr => tr.wallTimeNs / NS_PER_MS);
  const m = walls.reduce((a, b) => a + b, 0) / walls.length;
  const sd = Math.sqrt(walls.reduce((acc, x) => acc + (x - m) ** 2, 0) / (walls.length - 1));
  const cv = (sd / m) * 100;

  if (cv > 10) {
    console.warn(`  ⚠  [${mod.id}/${pattern}] n=${n}: CV=${cv.toFixed(1)}% > 10% — flag for review`);
  } else {
    console.log(`  ✓  [${mod.id}/${pattern}] n=${n}: mean=${m.toFixed(3)}ms  CV=${cv.toFixed(1)}%`);
  }

  return trials;
}

export async function sanityCheck(
  mod: BenchmarkModule,
  n: number,
  sanityTrials = 5,
): Promise<void> {
  console.log(`  Sanity check [${mod.id}] n=${n}...`);
  const cfg: RunConfig = {
    trials: sanityTrials,
    warmupIterations: 10,
    sleepBetweenTrialsMs: 50,
    moduleFilter: null,
    nFilter: null,
  };
  const baseTrials = await runTrials(mod, 'baseline', n, cfg);
  const optTrials = await runTrials(mod, 'optimized', n, cfg);
  const baseWall = baseTrials.map(t => t.wallTimeNs / NS_PER_MS);
  const optWall = optTrials.map(t => t.wallTimeNs / NS_PER_MS);
  const baseMean = baseWall.reduce((a, b) => a + b, 0) / baseWall.length;
  const optMean = optWall.reduce((a, b) => a + b, 0) / optWall.length;
  console.log(`  Sanity: baseline=${baseMean.toFixed(3)}ms  optimized=${optMean.toFixed(3)}ms`);
}
