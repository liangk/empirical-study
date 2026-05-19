// Benchmark types for Study 10: ReDoS Vulnerabilities

export interface BenchResult {
  inputSize: number;         // characters in input string
  matchTimeMs: number;       // regex match duration
  complexityScore: number;   // ret.js complexity score
  backtracks: number;        // estimated backtracking count
  eventLoopBlockMs: number;  // event loop lag if any
  timeoutHit: boolean;       // whether match timed out
}

export interface TrialSet {
  module: string;
  variant: 'vulnerable' | 'safe';
  inputSize: number;
  trials: BenchResult[];
  mean: number;
  median: number;
  stddev: number;
  cv: number;
  p5: number;
  p95: number;
  timeoutCount: number;
  timeoutRate: number;
}

export interface ModuleResult {
  module: string;
  description: string;
  inputSizes: number[];
  vulnerable: TrialSet[];
  safe: TrialSet[];
  speedupBySize: Record<number, number>;
  timestamp: string;
}

export interface BenchmarkModule {
  id: string;
  description: string;
  runVulnerable: (inputSize: number) => Promise<BenchResult>;
  runSafe: (inputSize: number) => Promise<BenchResult>;
}

// Input sizes for malicious inputs
export const INPUT_SIZES = [
  10,   // small
  20,
  40,
  60,
  80,
  100,  // medium
  1000, // large
  10000,
];

export const TRIALS = 30;
export const WARMUP = 5;
export const TIMEOUT_MS = 5000; // 5 second timeout for matches