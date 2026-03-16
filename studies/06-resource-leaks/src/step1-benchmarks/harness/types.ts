/** A single trial measurement for one iteration within a leak benchmark. */
export interface LeakTrialRecord {
  module: string;
  pattern: 'leaky' | 'proper';
  n: number;
  trial: number;
  iteration: number;
  heapUsed: number;       // bytes
  rss: number;            // bytes
  activeHandles: number;
  activeRequests: number;
  resourceCount: number;  // module-specific: FDs, connections, listeners, timers
  iterationMs: number;    // wall-clock time for this iteration
  error?: string;         // if a system error occurred (EMFILE, pool timeout, etc.)
}

/** Summary statistics for one (module, pattern, n) combination. */
export interface LeakSummary {
  module: string;
  pattern: 'leaky' | 'proper';
  n: number;
  trials: number;
  /** Leak rate: median slope of resourceCount vs iteration across trials. */
  leakRateMedian: number;
  leakRateStddev: number;
  /** Memory growth rate: median slope of heapUsed vs iteration (bytes/iteration). */
  memGrowthMedian: number;
  memGrowthStddev: number;
  /** Final resource count at last iteration — median across trials. */
  finalResourceMedian: number;
  finalResourceStddev: number;
  /** Final heapUsed at last iteration — median across trials. */
  finalHeapMedian: number;
  finalHeapStddev: number;
  /** Time-to-failure: median iteration at which a system error occurred. null if no failure. */
  ttfMedian: number | null;
  ttfStddev: number | null;
  /** Per-iteration timing stats. */
  iterationMsMedian: number;
  iterationMsCv: number;
}

/** Comparison between leaky and proper patterns for one (module, n). */
export interface LeakComparison {
  module: string;
  n: number;
  leakyLeakRate: number;
  properLeakRate: number;
  leakyMemGrowth: number;
  properMemGrowth: number;
  leakyFinalResource: number;
  properFinalResource: number;
  leakyTtf: number | null;
  properTtf: number | null;
  /** Welch's t-test p-value on final resource count. */
  pValue: number;
  /** Cohen's d on final resource count. */
  cohensD: number;
  /** Per-iteration overhead: properIterationMs / leakyIterationMs. */
  cleanupOverhead: number;
}

/** A benchmark module defines the leaky and proper variants. */
export interface LeakBenchmarkModule {
  id: string;
  name: string;
  nValues: number[];

  /** Setup any shared state before trials begin (e.g., create temp files, start servers). */
  setup(): Promise<void>;

  /** Teardown shared state after all trials (e.g., delete temp files, stop servers). */
  teardown(): Promise<void>;

  /**
   * Run one iteration of the leaky pattern.
   * Returns module-specific resource count (FDs, connections, listeners, etc.).
   */
  runLeaky(iteration: number): Promise<number>;

  /**
   * Run one iteration of the proper cleanup pattern.
   * Returns module-specific resource count.
   */
  runProper(iteration: number): Promise<number>;

  /**
   * Reset state between trials (close leaked resources from previous trial).
   */
  reset(): Promise<void>;
}
