import * as fs from 'fs';
import * as path from 'path';
import { AnalysisSummary } from './analyze';

export async function buildReport(analysisPath: string, outputPath: string) {
  const absoluteAnalysis = path.resolve(analysisPath);
  if (!fs.existsSync(absoluteAnalysis)) {
    throw new Error(`Analysis file not found: ${absoluteAnalysis}`);
  }

  const raw = fs.readFileSync(absoluteAnalysis, 'utf8');
  const summary: AnalysisSummary = JSON.parse(raw);
  const markdown = renderMarkdownReport(summary);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Report written to ${outputPath}`);

  const contentPath = path.resolve('content/cache-opportunities-report.md');
  fs.mkdirSync(path.dirname(contentPath), { recursive: true });
  fs.writeFileSync(contentPath, markdown, 'utf8');
  console.log(`Report also copied to ${contentPath}`);
}

function renderMarkdownReport(summary: AnalysisSummary): string {
  return `# Caching Opportunity Study: Summary Report

## Key Metrics

- Total findings: ${summary.totalFindings}
- Total repeated call occurrences: ${summary.totalOccurrences}
- Files with findings: ${summary.totalFiles}

## Findings by category

${renderCountsTable(summary.categoryCounts)}

## Repeated occurrences by category

${renderCountsTable(summary.categoryOccurrences)}

## Findings by severity

${renderCountsTable(summary.severityCounts)}

## Top files

${renderTopTable(summary.topFiles, ['file', 'count'])}

## Top repeated signatures

${renderTopTable(summary.topSignatures, ['signature', 'category', 'findings', 'occurrences'])}

## Recommended cache strategies

${renderRecommendationTable(summary.recommendations)}

## Next steps

1. Review high-frequency repeated fetch and DB query signatures.
2. Prioritize cache patterns for low-risk, high-impact opportunities.
3. Add memoization or caching layers where repeated identical calls are found.
4. Preserve cache invalidation rules when data freshness matters.
`;
}

function renderRecommendationTable(recommendations: Array<{ category: string; strategy: string; note: string }>): string {
  if (!recommendations || !recommendations.length) {
    return 'No category-based recommendations could be inferred from the analysis.';
  }
  const rows = recommendations
    .map((item) => `| ${escapeMarkdown(item.category)} | ${escapeMarkdown(item.strategy)} | ${escapeMarkdown(item.note)} |`)
    .join('\n');
  return `| Category | Strategy | Note |
|---|---|---|
${rows}`;
}

function renderCountsTable(counts: Record<string, number>): string {
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
  return `| Category | Count |
|---|---|
${rows}`;
}

function renderTopTable(rows: any[], columns: string[]): string {
  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${columns.map((col) => escapeMarkdown(String(row[col] ?? ''))).join(' | ')} |`)
    .join('\n');
  return `${header}
${divider}
${body}`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|');
}

if (require.main === module) {
  const analysis = process.argv.includes('--analysis')
    ? process.argv[process.argv.indexOf('--analysis') + 1]
    : 'results/summary.json';
  const output = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : 'results/cache-opportunities-report.md';
  buildReport(analysis, output).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
