import * as fs from 'fs';
import * as path from 'path';

interface SummaryRecord {
  module: string;
  pattern: 'baseline' | 'optimized';
  n: number;
  median: number;
}

interface ScalingResult {
  module: string;
  pattern: 'baseline' | 'optimized';
  a: number;
  b: number;
  rSquared: number;
  empiricalLabel: string;
  theoreticalLabel: string;
  dataPoints: { n: number; median: number; fitted: number }[];
}

function olsLogLog(ns: number[], ts: number[]): { a: number; b: number; rSquared: number } {
  const logN = ns.map(Math.log);
  const logT = ts.map(Math.log);
  const n = logN.length;
  const meanX = logN.reduce((a, b) => a + b, 0) / n;
  const meanY = logT.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (logN[i] - meanX) * (logT[i] - meanY);
    ssXX += (logN[i] - meanX) ** 2;
    ssYY += (logT[i] - meanY) ** 2;
  }
  const b = ssXY / ssXX;
  const logA = meanY - b * meanX;
  const a = Math.exp(logA);
  const rSquared = ssXX === 0 || ssYY === 0 ? 1 : (ssXY ** 2) / (ssXX * ssYY);
  return { a, b, rSquared };
}

function empiricalLabel(b: number): string {
  if (b < 0.15) return 'O(1)';
  if (b < 0.55) return 'O(log n)';
  if (b < 1.15) return 'O(n)';
  if (b < 1.65) return 'O(n log n)';
  if (b < 2.2) return 'O(n²)';
  return `O(n^${b.toFixed(2)})`;
}

function theoreticalLabel(module: string, pattern: 'baseline' | 'optimized'): string {
  const map: Record<string, { baseline: string; optimized: string }> = {
    'BM-01': { baseline: 'O(n)', optimized: 'O(log n)' },
    'BM-02': { baseline: 'O(n log n)', optimized: 'O(1)' },
    'BM-03': { baseline: 'O(n)', optimized: 'O(log n)' },
    'BM-04': { baseline: 'O(n)', optimized: 'O(log n)' },
    'BM-05': { baseline: 'O(n)', optimized: 'O(n)' },
  };
  return map[module]?.[pattern] ?? 'Unknown';
}

function fitScaling(summaries: SummaryRecord[]): ScalingResult[] {
  const grouped = new Map<string, SummaryRecord[]>();
  for (const s of summaries) {
    const key = `${s.module}::${s.pattern}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const results: ScalingResult[] = [];
  for (const [key, records] of grouped) {
    const [module, pattern] = key.split('::') as [string, 'baseline' | 'optimized'];
    const sorted = records.sort((a, b) => a.n - b.n);
    const ns = sorted.map(r => r.n);
    const ts = sorted.map(r => r.median);

    if (ns.length < 2) continue;

    const { a, b, rSquared } = olsLogLog(ns, ts);
    const dataPoints = sorted.map(r => ({
      n: r.n,
      median: r.median,
      fitted: a * Math.pow(r.n, b),
    }));

    results.push({
      module, pattern, a, b, rSquared,
      empiricalLabel: empiricalLabel(b),
      theoreticalLabel: theoreticalLabel(module, pattern),
      dataPoints,
    });
  }
  return results;
}

function main() {
  const resultsDir = path.join(__dirname, '..', '..', 'results');
  const args = process.argv.slice(2);
  const inputFlag = args[args.indexOf('--input') + 1];

  let summaryFile: string;
  if (inputFlag) {
    summaryFile = inputFlag.includes('summary') ? inputFlag
      : inputFlag.replace('bench-', 'summary-');
  } else {
    const files = fs.readdirSync(resultsDir).filter(f => f.startsWith('summary-')).sort();
    if (files.length === 0) { console.error('No summary files found in results/'); process.exit(1); }
    summaryFile = path.join(resultsDir, files[files.length - 1]);
  }

  console.log(`Reading: ${summaryFile}`);
  const summaries: SummaryRecord[] = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const results = fitScaling(summaries);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(resultsDir, `scaling-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log(`\nScaling analysis → ${outFile}\n`);
  console.log(`${'Module'.padEnd(8)} ${'Pattern'.padEnd(10)} ${'b'.padStart(6)} ${'R²'.padStart(6)} ${'Empirical'.padStart(12)} ${'Theoretical'.padStart(12)}`);
  for (const r of results) {
    console.log(
      `${r.module.padEnd(8)} ${r.pattern.padEnd(10)} ${r.b.toFixed(3).padStart(6)} ${r.rSquared.toFixed(3).padStart(6)} ` +
      `${r.empiricalLabel.padStart(12)} ${r.theoreticalLabel.padStart(12)}`
    );
  }
}

main();
