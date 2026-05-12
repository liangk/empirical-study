// Benchmark types for Study 09: Large Payload Anti-Patterns

export interface BenchResult {
  payloadSize: number;       // bytes
  parseTimeMs: number;       // JSON.parse duration
  rssDeltaMb: number;        // memory delta (RSS before/after)
  eventLoopBlockMs: number;  // event loop lag if any
}

export interface TrialSet {
  module: string;
  variant: 'baseline' | 'optimized';
  payloadSize: number;
  trials: BenchResult[];
  mean: number;
  median: number;
  stddev: number;
  cv: number;
  p5: number;
  p95: number;
}

export interface ModuleResult {
  module: string;
  description: string;
  payloadSizes: number[];
  baseline: TrialSet[];
  optimized: TrialSet[];
  speedupBySize: Record<number, number>;
  timestamp: string;
}

export interface BenchmarkModule {
  id: string;
  description: string;
  runBaseline: (payloadSize: number) => Promise<BenchResult>;
  runOptimized: (payloadSize: number) => Promise<BenchResult>;
}

// Payload sizes: 1KB, 10KB, 100KB, 1MB, 10MB
export const PAYLOAD_SIZES = [
  1 * 1024,           // 1 KB
  10 * 1024,          // 10 KB
  100 * 1024,         // 100 KB
  1024 * 1024,        // 1 MB
  10 * 1024 * 1024,   // 10 MB
];

export const TRIALS = 30;
export const WARMUP = 5;
export const CV_THRESHOLD = 0.15;
