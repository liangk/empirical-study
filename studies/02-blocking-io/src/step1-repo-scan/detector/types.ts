export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ScanIssue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  filePath: string;
  lineNumber: number;
  title: string;
  description: string;
  code: string;
  context: 'request_handler' | 'loop' | 'init' | 'other';
  method: string;
  asyncAlternative: string;
}

export interface AnalysisContext {
  sourceCode: string;
  filePath: string;
  ast: any;
}

export interface ScanResult {
  repoUrl: string;
  repoName: string;
  filesScanned: number;
  issues: ScanIssue[];
  scanDurationMs: number;
  error?: string;
}

export interface AggregatedResults {
  totalRepos: number;
  totalFilesScanned: number;
  totalIssues: number;
  reposWithIssues: number;
  prevalenceRate: number;
  byType: Record<string, number>;
  byContext: Record<string, number>;
  bySeverity: Record<string, number>;
  byMethod: Record<string, number>;
  topOffenders: Array<{ repo: string; issueCount: number }>;
}
