/**
 * Supplemental statistics for Study 04 article:
 *   1. Cohen's d + Welch t-test for BM-01 at n=100,000 (regex hoisting)
 *   2. Bootstrap 95% CI on power-law exponent b for all modules
 *   3. Per-repo anti-pattern breakdown (top-15 by count)
 *
 * Run: node -r ts-node/register src/step2-scaling/supplemental-stats.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Results live under studies/04-loop-performance/results
const RESULTS_DIR = path.resolve(__dirname, '../../results');

// ─── Utilities ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function cohensD(a: number[], b: number[]): number {
  const pooled = Math.sqrt((std(a) ** 2 + std(b) ** 2) / 2);
  return pooled === 0 ? Infinity : (mean(a) - mean(b)) / pooled;
}

/** Welch's t-test (two-tailed), returns p-value approximation via t-distribution */
function welchT(a: number[], b: number[]): { t: number; df: number; p: string } {
  const na = a.length, nb = b.length;
  const ma = mean(a), mb = mean(b);
  const va = std(a) ** 2, vb = std(b) ** 2;
  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return { t: Infinity, df: na + nb - 2, p: '< 0.001' };
  const t = (ma - mb) / se;
  const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  // Approximate p-value using normal distribution for large df
  const z = Math.abs(t);
  let p: string;
  if (z > 3.29) p = '< 0.001';
  else if (z > 2.58) p = '< 0.01';
  else if (z > 1.96) p = '< 0.05';
  else p = '>= 0.05';
  return { t: Math.round(t * 100) / 100, df: Math.round(df), p };
}

/** Bootstrap 95% CI for power-law exponent b */
function bootstrapExponentCI(xs: number[], ys: number[], B = 2000): { lower: number; upper: number; mean: number } {
  const logX = xs.map(Math.log);
  const logY = ys.map(Math.log);

  function fitB(lx: number[], ly: number[]): number {
    const n = lx.length;
    const mx = lx.reduce((a, b) => a + b, 0) / n;
    const my = ly.reduce((a, b) => a + b, 0) / n;
    const num = lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0);
    const den = lx.reduce((s, x) => s + (x - mx) ** 2, 0);
    return den === 0 ? 0 : num / den;
  }

  const observed = fitB(logX, logY);
  const boots: number[] = [];
  for (let b = 0; b < B; b++) {
    const idx = Array.from({ length: logX.length }, () => Math.floor(Math.random() * logX.length));
    boots.push(fitB(idx.map(i => logX[i]), idx.map(i => logY[i])));
  }
  boots.sort((a, b) => a - b);
  return {
    lower: Math.round(boots[Math.floor(0.025 * B)] * 1000) / 1000,
    upper: Math.round(boots[Math.floor(0.975 * B)] * 1000) / 1000,
    mean: Math.round(observed * 1000) / 1000,
  };
}

// ─── Load data ────────────────────────────────────────────────────────────────

function latestFile(pattern: string): string {
  // Normalize to forward slashes so glob works on Windows paths
  const normalized = pattern.replace(/\\/g, '/');
  const files = glob.sync(normalized).sort();
  if (!files.length) throw new Error(`No file matching: ${normalized}`);
  return files[files.length - 1];
}

const benchFile = latestFile(path.join(RESULTS_DIR, 'bench-*.json'));
const scalingFile = latestFile(path.join(RESULTS_DIR, 'scaling-*.json'));
const realworldFile = latestFile(path.join(RESULTS_DIR, 'realworld-*.json'));

console.log(`\nLoading bench: ${path.basename(benchFile)}`);
console.log(`Loading scaling: ${path.basename(scalingFile)}`);
console.log(`Loading realworld: ${path.basename(realworldFile)}`);

const bench = JSON.parse(fs.readFileSync(benchFile, 'utf8'));
const scaling = JSON.parse(fs.readFileSync(scalingFile, 'utf8'));
const realworld: any[] = JSON.parse(fs.readFileSync(realworldFile, 'utf8'));

// ─── 1. BM-01 Cohen's d at n=100,000 ─────────────────────────────────────────

console.log('\n\n=== 1. BM-01 Formal Stats at n=100,000 (regex-in-loop) ===\n');

const bm01Base = bench.trials
  .filter((t: any) => t.moduleId === 'BM-01' && t.pattern === 'baseline' && t.n === 100000)
  .map((t: any) => t.wallTimeNs / 1e6);
const bm01Opt = bench.trials
  .filter((t: any) => t.moduleId === 'BM-01' && t.pattern === 'optimized' && t.n === 100000)
  .map((t: any) => t.wallTimeNs / 1e6);

if (bm01Base.length && bm01Opt.length) {
  const d = cohensD(bm01Base, bm01Opt);
  const { t, df, p } = welchT(bm01Base, bm01Opt);
  const speedup = mean(bm01Base) / mean(bm01Opt);
  console.log(`  Baseline: mean=${mean(bm01Base).toFixed(3)}ms  std=${std(bm01Base).toFixed(3)}ms  n=${bm01Base.length}`);
  console.log(`  Optimized: mean=${mean(bm01Opt).toFixed(3)}ms  std=${std(bm01Opt).toFixed(3)}ms  n=${bm01Opt.length}`);
  console.log(`  Speedup: ${speedup.toFixed(2)}×`);
  console.log(`  Cohen's d: ${d.toFixed(3)}  (< 0.2 = negligible, 0.2-0.5 = small, 0.5-0.8 = medium, > 0.8 = large)`);
  console.log(`  Welch t: ${t}  df: ${df}  p: ${p}`);
  const verdict = Math.abs(d) < 0.2 ? 'NEGLIGIBLE — V8 caches regex, hoisting has no practical benefit' :
    Math.abs(d) < 0.5 ? 'SMALL — marginal benefit, not worth optimizing for' :
    'MEANINGFUL — hoisting has real impact';
  console.log(`  Verdict: ${verdict}`);
} else {
  console.log('  No BM-01 n=100000 data found.');
}

// Also check all n values for BM-01
console.log('\n  BM-01 speedup across all n:');
for (const n of [10, 100, 1000, 10000, 100000]) {
  const b = bench.trials.filter((t: any) => t.moduleId === 'BM-01' && t.pattern === 'baseline' && t.n === n).map((t: any) => t.wallTimeNs / 1e6);
  const o = bench.trials.filter((t: any) => t.moduleId === 'BM-01' && t.pattern === 'optimized' && t.n === n).map((t: any) => t.wallTimeNs / 1e6);
  if (!b.length || !o.length) continue;
  const d = cohensD(b, o);
  const speedup = mean(b) / mean(o);
  console.log(`    n=${String(n).padEnd(7)} base=${mean(b).toFixed(3)}ms opt=${mean(o).toFixed(3)}ms speedup=${speedup.toFixed(2)}× d=${d.toFixed(2)}`);
}

// ─── 2. Bootstrap CI on scaling exponents ────────────────────────────────────

console.log('\n\n=== 2. Bootstrap 95% CI on Power-Law Exponents ===\n');
console.log('Module    | Pattern   | b (mean) | 95% CI           | Overlap? | Verdict');
console.log('----------|-----------|----------|------------------|----------|--------');

const modules = ['BM-01', 'BM-02', 'BM-04', 'BM-05', 'BM-06'];
const nVals = [10, 100, 1000, 10000, 100000];

const ciResults: Record<string, { base: ReturnType<typeof bootstrapExponentCI>; opt: ReturnType<typeof bootstrapExponentCI> }> = {};

for (const mod of modules) {
  const baseXY: { x: number; y: number }[] = [];
  const optXY: { x: number; y: number }[] = [];

  for (const n of nVals) {
    const b = bench.trials.filter((t: any) => t.moduleId === mod && t.pattern === 'baseline' && t.n === n).map((t: any) => t.wallTimeNs / 1e6);
    const o = bench.trials.filter((t: any) => t.moduleId === mod && t.pattern === 'optimized' && t.n === n).map((t: any) => t.wallTimeNs / 1e6);
    if (b.length) baseXY.push({ x: n, y: mean(b) });
    if (o.length) optXY.push({ x: n, y: mean(o) });
  }

  if (baseXY.length < 3 || optXY.length < 3) continue;

  const baseCI = bootstrapExponentCI(baseXY.map(p => p.x), baseXY.map(p => p.y));
  const optCI = bootstrapExponentCI(optXY.map(p => p.x), optXY.map(p => p.y));
  ciResults[mod] = { base: baseCI, opt: optCI };

  // Check CI overlap
  const overlaps = baseCI.lower <= optCI.upper && optCI.lower <= baseCI.upper;
  const verdict = overlaps ? 'CIs overlap — no significant scaling difference' : 'CIs distinct — scaling differs';

  console.log(`${mod.padEnd(10)}| baseline   | ${String(baseCI.mean).padEnd(8)} | [${baseCI.lower}, ${baseCI.upper}]`.padEnd(60) + `| ${overlaps ? 'YES' : 'NO'}      | ${verdict}`);
  console.log(`${' '.repeat(10)}| optimized  | ${String(optCI.mean).padEnd(8)} | [${optCI.lower}, ${optCI.upper}]`);
  console.log('');
}

// ─── 3. Per-repo breakdown ────────────────────────────────────────────────────

console.log('\n=== 3. Per-Repo Anti-Pattern Breakdown (Top 15) ===\n');

const repoCounts: Record<string, { repo: string; domain: string; count: number; byKind: Record<string, number> }> = {};

for (const entry of realworld) {
  const repoName = entry.repo?.name ?? 'unknown';
  const domain = entry.repo?.domain ?? 'unknown';
  const profiles: any[] = entry.profiles ?? [];
  if (!repoCounts[repoName]) {
    repoCounts[repoName] = { repo: repoName, domain, count: 0, byKind: {} };
  }
  for (const p of profiles) {
    repoCounts[repoName].count++;
    const k = p.patternType ?? 'unknown';
    repoCounts[repoName].byKind[k] = (repoCounts[repoName].byKind[k] ?? 0) + 1;
  }
}

const sorted = Object.values(repoCounts).sort((a, b) => b.count - a.count).slice(0, 15);

console.log('Rank | Repository                      | Domain              | Total | nested | seq-await | regex | json | nested-arr');
console.log('-----|----------------------------------|---------------------|-------|--------|-----------|-------|------|----------');
sorted.forEach((r, i) => {
  const nl = r.byKind['nested-loops'] ?? 0;
  const sa = r.byKind['sequential-await-in-loop'] ?? 0;
  const rx = r.byKind['regex-in-loop'] ?? 0;
  const jp = r.byKind['json-parse-in-loop'] ?? 0;
  const na = r.byKind['nested-array-methods'] ?? 0;
  console.log(
    `${String(i + 1).padEnd(5)}| ${r.repo.padEnd(33)}| ${r.domain.padEnd(21)}| ${String(r.count).padEnd(6)}| ${String(nl).padEnd(7)}| ${String(sa).padEnd(10)}| ${String(rx).padEnd(6)}| ${String(jp).padEnd(5)}| ${na}`
  );
});

// ─── Write output ─────────────────────────────────────────────────────────────

const outFile = path.join(RESULTS_DIR, `supplemental-stats-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  bm01Stats: { base: bm01Base, opt: bm01Opt },
  bootstrapCI: ciResults,
  perRepoBreakdown: sorted,
}, null, 2));
console.log(`\nResults written to: ${outFile}`);
