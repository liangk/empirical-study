export type Pattern = 'baseline' | 'baseline-a' | 'optimized';

export type EffectSize = 'negligible' | 'small' | 'medium' | 'large';

export interface TrialRecord {
  moduleId: string;
  pattern: Pattern;
  environment: string;
  n: number;
  trial: number;
  wallTimeNs: number;
  cpuTimeMs: number;
  heapBeforeBytes: number;
  heapAfterBytes: number;
  rssBytes: number;
  timestampUtc: string;
  platform: string;
  nodeVersion: string;
}

export interface BenchmarkSummary {
  moduleId: string;
  pattern: Pattern;
  environment: string;
  n: number;
  trials: number;
  meanWallMs: number;
  medianWallMs: number;
  stddevWallMs: number;
  p05WallMs: number;
  p25WallMs: number;
  p75WallMs: number;
  p95WallMs: number;
  cvPct: number;
  minWallMs: number;
  maxWallMs: number;
  meanHeapDeltaBytes: number;
  peakHeapDeltaBytes: number;
  meanCpuTimeMs: number;
  flaggedHighCV: boolean;
  flaggedOutlier: boolean;
}

export interface ComparisonResult {
  moduleId: string;
  n: number;
  environment: string;
  speedupRatio: number;
  improvementPct: number;
  memoryReductionRatio: number | null;
  tStatistic: number;
  pValue: number;
  cohensD: number;
  effectSize: EffectSize;
  significant: boolean;
  hypothesisMet: boolean | null;
  anomaly: boolean;
}

export interface BenchmarkModule {
  id: string;
  name: string;
  description: string;
  hypothesis: string | null;
  nValues: number[];
  isAsync: boolean;
  runBaseline: (n: number) => Promise<unknown> | unknown;
  runBaselineA?: (n: number) => Promise<unknown> | unknown;
  runOptimized: (n: number) => Promise<unknown> | unknown;
}

export interface RunConfig {
  trials: number;
  warmupIterations: number;
  sleepBetweenTrialsMs: number;
  moduleFilter: string | null;
  nFilter: number | null;
}

export interface BenchmarkOutput {
  metadata: {
    timestamp: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    config: RunConfig;
  };
  trials: TrialRecord[];
  summaries: BenchmarkSummary[];
  comparisons: ComparisonResult[];
}
