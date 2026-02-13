import { PrismaClient } from "@prisma/client";

export interface BenchmarkResult {
  testCase: string;
  variant: "bad" | "good";
  datasetSize: number;
  queryCount: number;
  executionTimeMs: number;
  runs: number;
  timings: number[];
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
}

export function createTrackedPrisma() {
  let queryCount = 0;
  const prisma = new PrismaClient({
    log: [{ emit: "event", level: "query" }],
  });

  (prisma.$on as any)("query", () => {
    queryCount++;
  });

  return {
    prisma,
    getQueryCount: () => queryCount,
    resetQueryCount: () => { queryCount = 0; },
  };
}

export async function benchmark(
  name: string,
  variant: "bad" | "good",
  fn: () => Promise<any>,
  tracked: ReturnType<typeof createTrackedPrisma>,
  runs: number = 5
): Promise<BenchmarkResult> {
  // Warmup run
  tracked.resetQueryCount();
  await fn();
  const queryCount = tracked.getQueryCount();

  // Timed runs
  const timings: number[] = [];
  for (let i = 0; i < runs; i++) {
    tracked.resetQueryCount();
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  timings.sort((a, b) => a - b);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const median = timings[Math.floor(timings.length / 2)];
  const p95 = timings[Math.floor(timings.length * 0.95)];
  const p99 = timings[Math.floor(timings.length * 0.99)];

  const datasetSize = await tracked.prisma.user.count();

  return {
    testCase: name,
    variant,
    datasetSize,
    queryCount,
    executionTimeMs: avg,
    runs,
    timings,
    avgMs: Math.round(avg * 100) / 100,
    medianMs: Math.round(median * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    p99Ms: Math.round(p99 * 100) / 100,
  };
}

export function printResult(r: BenchmarkResult) {
  console.log(`\n--- ${r.testCase} [${r.variant.toUpperCase()}] ---`);
  console.log(`  Dataset:    ${r.datasetSize} users`);
  console.log(`  Queries:    ${r.queryCount}`);
  console.log(`  Avg:        ${r.avgMs}ms`);
  console.log(`  Median:     ${r.medianMs}ms`);
  console.log(`  P95:        ${r.p95Ms}ms`);
  console.log(`  P99:        ${r.p99Ms}ms`);
  console.log(`  All runs:   [${r.timings.map((t) => t.toFixed(1)).join(", ")}]ms`);
}

export function printComparison(bad: BenchmarkResult, good: BenchmarkResult) {
  const speedup = bad.avgMs / good.avgMs;
  const queryReduction = ((bad.queryCount - good.queryCount) / bad.queryCount) * 100;

  console.log(`\n=== ${bad.testCase} COMPARISON ===`);
  console.log(`  Dataset:         ${bad.datasetSize} users`);
  console.log(`  Bad queries:     ${bad.queryCount}`);
  console.log(`  Good queries:    ${good.queryCount}`);
  console.log(`  Query reduction: ${queryReduction.toFixed(2)}%`);
  console.log(`  Bad avg time:    ${bad.avgMs}ms`);
  console.log(`  Good avg time:   ${good.avgMs}ms`);
  console.log(`  Speedup:         ${speedup.toFixed(1)}x`);
}
