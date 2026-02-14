// Source span metadata (not used in every output field today, but kept for extension).
export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// One normalized blocking-I/O finding emitted by the detector.
export interface ScanIssue {
  // Stable-ish identifier for human debugging and result traceability.
  id: string;
  // Normalized family label used for aggregation charts.
  type: string;
  // Severity reflects likely production risk based on context + loop multipliers.
  severity: 'critical' | 'high' | 'medium' | 'low';
  // Repo-relative path (prefixed with repo name in scanner output).
  filePath: string;
  // 1-based source line number where the call expression starts.
  lineNumber: number;
  title: string;
  description: string;
  // Compact source snippet for quick triage without opening full file.
  code: string;
  // Coarse execution context bucket used in prevalence analysis.
  context: 'request_path' | 'background_path' | 'startup_path' | 'tooling_path' | 'unknown_path';
  // Fine-grained reason for context assignment (auditable heuristic detail).
  contextDetail: string;
  // List of matched heuristics that contributed to classification.
  matchedBy: string[];
  // Optional function name where the issue is enclosed (for code review navigation).
  enclosingFunction?: string;
  // Ancestor node fingerprint to explain ancestry-based decisions.
  ancestorKinds?: string[];
  // Raw method name found in source (e.g., readFileSync).
  method: string;
  // Best-effort async counterpart suggestion (e.g., readFile).
  asyncAlternative: string;
}

// Context passed into detector for each file-level analysis.
export interface AnalysisContext {
  sourceCode: string;
  filePath: string;
  ast: any;
}

// Per-repository scan output, later aggregated across the sample set.
export interface ScanResult {
  repoUrl: string;
  repoName: string;
  filesScanned: number;
  issues: ScanIssue[];
  scanDurationMs: number;
  // Optional non-fatal error marker (e.g., clone failure).
  error?: string;
}

// Cross-repository summary used for reporting and article generation.
export interface AggregatedResults {
  totalRepos: number;
  totalFilesScanned: number;
  totalIssues: number;
  reposWithIssues: number;
  // Fraction of repos that contained >=1 issue.
  prevalenceRate: number;
  byType: Record<string, number>;
  byContext: Record<string, number>;
  byContextDetail: Record<string, number>;
  byHeuristic: Record<string, number>;
  bySeverity: Record<string, number>;
  byMethod: Record<string, number>;
  // Highest-issue repos to support qualitative follow-up inspection.
  topOffenders: Array<{ repo: string; issueCount: number }>;
}
