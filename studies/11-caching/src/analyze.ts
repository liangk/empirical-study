import * as fs from 'fs';
import * as path from 'path';

export interface CacheFinding {
  file: string;
  line: number;
  column: number;
  category: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  signature: string;
  snippet: string;
  occurrenceCount?: number;
  occurrences: Array<{ file: string; line: number; column: number; snippet: string }>;
}

export interface AnalysisSummary {
  totalFindings: number;
  totalOccurrences: number;
  totalFiles: number;
  categoryCounts: Record<string, number>;
  categoryOccurrences: Record<string, number>;
  severityCounts: Record<string, number>;
  topFiles: Array<{ file: string; count: number }>;
  topSignatures: Array<{ signature: string; category: string; findings: number; occurrences: number }>;
  recommendations: Array<{ category: string; strategy: string; note: string }>;
}

export async function analyzeStudyResults(inputPath: string, outputPath: string) {
  const findings = loadFindings(inputPath);
  const summary = summarizeFindings(findings);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Analysis written to ${outputPath}`);
  return summary;
}

export function loadFindings(inputPath: string): CacheFinding[] {
  const absoluteInput = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Input path not found: ${absoluteInput}`);
  }

  const stats = fs.statSync(absoluteInput);
  if (stats.isDirectory()) {
    const files = fs.readdirSync(absoluteInput).filter((file) => file.endsWith('.json'));
    return files.flatMap((file) => readFindings(path.join(absoluteInput, file)));
  }

  return readFindings(absoluteInput);
}

function readFindings(filePath: string): CacheFinding[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return parsed;
}

export function summarizeFindings(findings: CacheFinding[]): AnalysisSummary {
  const categoryCounts: Record<string, number> = {};
  const categoryOccurrences: Record<string, number> = {};
  const severityCounts: Record<string, number> = {};
  const fileCounts: Record<string, number> = {};
  const signatureCounts: Record<string, { category: string; findings: number; occurrences: number }> = {};

  for (const finding of findings) {
    const occurrenceCount = finding.occurrenceCount ?? finding.occurrences?.length ?? 1;
    categoryCounts[finding.category] = (categoryCounts[finding.category] ?? 0) + 1;
    categoryOccurrences[finding.category] = (categoryOccurrences[finding.category] ?? 0) + occurrenceCount;
    severityCounts[finding.severity] = (severityCounts[finding.severity] ?? 0) + 1;
    fileCounts[finding.file] = (fileCounts[finding.file] ?? 0) + 1;
    signatureCounts[finding.signature] = {
      category: finding.category,
      findings: (signatureCounts[finding.signature]?.findings ?? 0) + 1,
      occurrences: (signatureCounts[finding.signature]?.occurrences ?? 0) + occurrenceCount,
    };
  }

  const topFiles = Object.entries(fileCounts)
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topSignatures = Object.entries(signatureCounts)
    .map(([signature, value]) => ({
      signature,
      category: value.category,
      findings: value.findings,
      occurrences: value.occurrences,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  return {
    totalFindings: findings.length,
    totalOccurrences: findings.reduce((total, finding) => total + (finding.occurrenceCount ?? finding.occurrences?.length ?? 1), 0),
    totalFiles: Object.keys(fileCounts).length,
    categoryCounts,
    categoryOccurrences,
    severityCounts,
    topFiles,
    topSignatures,
    recommendations: generateRecommendations(categoryCounts),
  };
}

function generateRecommendations(categoryCounts: Record<string, number>) {
  const recommendations: Array<{ category: string; strategy: string; note: string }> = [];
  const mapping: Record<string, { strategy: string; note: string }> = {
    repeated_http_fetch: {
      strategy: 'Use response caching, request deduplication, or memoized API wrappers.',
      note: 'Repeated external fetches often benefit from short-lived in-memory caches or shared HTTP cache layers.',
    },
    repeated_graphql_query: {
      strategy: 'Cache GraphQL operation results and reuse persisted query signatures.',
      note: 'GraphQL reuse is best served by operation-level caching and response normalization.',
    },
    repeated_db_query: {
      strategy: 'Add application-layer or ORM result caching for repeated database queries.',
      note: 'Repeated DB calls can often be cached at the query result or session layer.',
    },
    repeated_pure_compute: {
      strategy: 'Memoize expensive pure computations or compute values once per request.',
      note: 'Pure compute reuse is a low-risk optimization when inputs are stable within the same flow.',
    },
  };

  for (const [category, count] of Object.entries(categoryCounts)) {
    if (mapping[category]) {
      recommendations.push({ category, strategy: mapping[category].strategy, note: mapping[category].note });
    }
  }

  return recommendations;
}

if (require.main === module) {
  const input = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : 'results/cache-opportunities.json';
  const output = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : 'results/summary.json';
  analyzeStudyResults(input, output).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
