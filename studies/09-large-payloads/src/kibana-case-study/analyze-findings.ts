import * as fs from 'fs';
import * as path from 'path';
import type { KibanaFinding } from './types';

function parseArg(flag: string, defaultValue?: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  if (arg) {
    return arg.split('=')[1];
  }
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

function loadFindings(filePath: string): KibanaFinding[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as KibanaFinding[];
}

function summarize(findings: KibanaFinding[]) {
  const byPattern = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  const byLayer = new Map<string, number>();
  const byPackage = new Map<string, number>();
  const byTest = new Map<string, number>();

  for (const finding of findings) {
    byPattern.set(finding.pattern, (byPattern.get(finding.pattern) ?? 0) + 1);
    bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
    byLayer.set(finding.layer, (byLayer.get(finding.layer) ?? 0) + 1);
    byPackage.set(finding.packageName ?? '<unknown>', (byPackage.get(finding.packageName ?? '<unknown>') ?? 0) + 1);
    byTest.set(finding.isTestFile ? 'test' : 'non-test', (byTest.get(finding.isTestFile ? 'test' : 'non-test') ?? 0) + 1);
  }

  const total = findings.length;
  const packageList = Array.from(byPackage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30);

  return {
    totalFindings: total,
    byPattern: Object.fromEntries(Array.from(byPattern.entries()).sort((a, b) => b[1] - a[1])),
    bySeverity: Object.fromEntries(Array.from(bySeverity.entries()).sort((a, b) => b[1] - a[1])),
    byLayer: Object.fromEntries(Array.from(byLayer.entries()).sort((a, b) => b[1] - a[1])),
    byPackage: Object.fromEntries(packageList),
    tests: {
      testFindings: byTest.get('test') ?? 0,
      nonTestFindings: byTest.get('non-test') ?? 0,
    },
    topFiles: topFiles(findings, 20),
  };
}

function topFiles(findings: KibanaFinding[], limit: number) {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.repoRelativePath, (counts.get(finding.repoRelativePath) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, count]) => ({ file, count }));
}

async function main() {
  const inputPath = path.resolve(parseArg('--input', path.join(process.cwd(), 'kibana-findings.json'))!);
  const outputPath = path.resolve(parseArg('--out', path.join(process.cwd(), 'kibana-findings-summary.json'))!);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const findings = loadFindings(inputPath);
  const summary = summarize(findings);
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(`Wrote summary for ${findings.length} findings to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
