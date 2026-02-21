export type Pattern = 'baseline' | 'optimized';

export interface DbTrialRecord {
  module: string;
  pattern: Pattern;
  n: number;
  trial: number;
  wallTimeMs: number;
  planType?: string;
}

export interface BenchmarkSummary {
  module: string;
  pattern: Pattern;
  n: number;
  trials: number;
  mean: number;
  median: number;
  stddev: number;
  p05: number;
  p95: number;
  cv: number;
}

export interface ComparisonResult {
  module: string;
  n: number;
  baselineMedian: number;
  optimizedMedian: number;
  speedup: number;
  tStatistic: number;
  pValue: number;
  cohensD: number;
  baselinePlanType: string;
  optimizedPlanType: string;
}

export interface BenchmarkModule {
  id: string;
  name: string;
  nValues: number[];
  /**
   * Run the query WITHOUT the relevant index (seq scan).
   * Returns wall-clock time in ms.
   */
  runBaseline(n: number): Promise<number>;
  /**
   * Run the query WITH the relevant index (index scan).
   * Returns wall-clock time in ms.
   */
  runOptimized(n: number): Promise<number>;
  /**
   * Create the index that distinguishes optimized from baseline.
   */
  createIndex(): Promise<void>;
  /**
   * Drop the index to restore baseline state.
   */
  dropIndex(): Promise<void>;
  /**
   * Optional: set up the baseline state before running baseline trials.
   * Used by BM-04 and BM-05 where baseline itself requires a specific index state.
   */
  setupBaseline?(): Promise<void>;
  /**
   * Returns true if baseline and optimized produce identical result sets.
   */
  verify(n: number): Promise<boolean>;
  /**
   * Capture EXPLAIN ANALYZE plan type for the query.
   */
  explainPlanType(n: number): Promise<string>;
}
