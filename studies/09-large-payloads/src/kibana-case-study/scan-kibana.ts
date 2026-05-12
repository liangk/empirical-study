import * as fs from 'fs';
import * as path from 'path';
import { detectPayloadPatterns } from '../step3-static-analysis/detector/payload-detector';
import { enrichKibanaFinding } from './kibana-enrich';
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

async function main() {
  const repoRoot = path.resolve(parseArg('--repo', process.cwd())!);
  const outputPath = path.resolve(parseArg('--out', path.join(process.cwd(), 'kibana-findings.json'))!);

  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    console.error(`Repository root not found: ${repoRoot}`);
    process.exit(1);
  }

  console.log(`Scanning Kibana repo at ${repoRoot}...`);
  const findings = await detectPayloadPatterns(repoRoot);
  const enriched = findings.map((finding) => enrichKibanaFinding(finding, repoRoot));

  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2));

  console.log(`Wrote ${enriched.length} enriched findings to ${outputPath}`);
  printSummary(enriched);
}

function printSummary(findings: KibanaFinding[]) {
  const byPattern = new Map<string, number>();
  const byLayer = new Map<string, number>();
  const byPackage = new Map<string, number>();
  const byTest = new Map<string, number>();

  for (const finding of findings) {
    byPattern.set(finding.pattern, (byPattern.get(finding.pattern) ?? 0) + 1);
    byLayer.set(finding.layer, (byLayer.get(finding.layer) ?? 0) + 1);
    byPackage.set(finding.packageName ?? '<unknown>', (byPackage.get(finding.packageName ?? '<unknown>') ?? 0) + 1);
    byTest.set(finding.isTestFile ? 'test' : 'non-test', (byTest.get(finding.isTestFile ? 'test' : 'non-test') ?? 0) + 1);
  }

  console.log('\nSummary');
  console.log(`Total findings: ${findings.length}`);

  console.log('By pattern:');
  for (const [pattern, count] of Array.from(byPattern.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern}: ${count}`);
  }

  console.log('By layer:');
  for (const [layer, count] of Array.from(byLayer.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${layer}: ${count}`);
  }

  console.log('By package:');
  for (const [pkg, count] of Array.from(byPackage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${pkg}: ${count}`);
  }

  console.log(`Tests vs non-tests: ${byTest.get('test') ?? 0} test findings, ${byTest.get('non-test') ?? 0} non-test findings`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
