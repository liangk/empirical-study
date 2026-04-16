/**
 * Study 07: Bundle Size Benchmark Runner
 *
 * Measures actual bundle size (raw + gzip) for 5 anti-pattern / optimized fixture pairs
 * using esbuild as the bundler. Outputs results to results/bench-<timestamp>.json.
 *
 * BM-01: lodash full default import vs lodash-es named import
 * BM-02: moment.js vs dayjs vs date-fns
 * BM-03: @mui/material barrel import vs direct path import
 * BM-04: antd barrel import vs antd/es/<component>
 * BM-05: react-icons namespace import vs named import
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as os from 'os';
import { execSync } from 'child_process';

interface BundleMetrics {
  label: string;
  rawBytes: number;
  gzipBytes: number;
}

interface BenchmarkResult {
  module: string;
  library: string;
  baseline: BundleMetrics;
  optimized: BundleMetrics | BundleMetrics[];
  sizeRatio: number;
  savingsKB: number;
  timestamp: string;
}

function gzipSize(buf: Buffer): number {
  return zlib.gzipSync(buf, { level: 9 }).length;
}

function bundleFixture(fixturePath: string, packages: string[]): BundleMetrics {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
  const outFile = path.join(tmpDir, 'out.js');

  try {
    const pkgJson = { name: 'tmp', version: '1.0.0', dependencies: {} as Record<string, string> };
    for (const pkg of packages) pkgJson.dependencies[pkg] = 'latest';
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
    execSync('npm install --silent', { cwd: tmpDir, stdio: 'pipe' });

    execSync(
      `npx esbuild "${fixturePath}" --bundle --minify --platform=browser --format=esm --outfile="${outFile}"`,
      { cwd: tmpDir, stdio: 'pipe', env: { ...process.env, NODE_PATH: path.join(tmpDir, 'node_modules') } }
    );

    const buf = fs.readFileSync(outFile);
    return { label: path.basename(fixturePath), rawBytes: buf.length, gzipBytes: gzipSize(buf) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const MODULES: Array<{
  id: string;
  library: string;
  baselineFixture: string;
  baselinePackages: string[];
  optimizedFixtures: Array<{ fixture: string; packages: string[] }>;
}> = [
  {
    id: 'BM-01', library: 'lodash',
    baselineFixture: path.join(__dirname, 'fixtures', 'bm01-lodash-baseline.js'),
    baselinePackages: ['lodash'],
    optimizedFixtures: [
      { fixture: path.join(__dirname, 'fixtures', 'bm01-lodash-optimized.js'), packages: ['lodash-es'] },
    ],
  },
  {
    id: 'BM-02', library: 'moment',
    baselineFixture: path.join(__dirname, 'fixtures', 'bm02-moment-baseline.js'),
    baselinePackages: ['moment'],
    optimizedFixtures: [
      { fixture: path.join(__dirname, 'fixtures', 'bm02-dayjs-optimized.js'), packages: ['dayjs'] },
      { fixture: path.join(__dirname, 'fixtures', 'bm02-datefns-optimized.js'), packages: ['date-fns'] },
    ],
  },
  {
    id: 'BM-03', library: '@mui/material',
    baselineFixture: path.join(__dirname, 'fixtures', 'bm03-mui-baseline.js'),
    baselinePackages: ['@mui/material', '@emotion/react', '@emotion/styled', 'react', 'react-dom'],
    optimizedFixtures: [
      { fixture: path.join(__dirname, 'fixtures', 'bm03-mui-optimized.js'), packages: ['@mui/material', '@emotion/react', '@emotion/styled', 'react', 'react-dom'] },
    ],
  },
  {
    id: 'BM-04', library: 'antd',
    baselineFixture: path.join(__dirname, 'fixtures', 'bm04-antd-baseline.js'),
    baselinePackages: ['antd', 'react', 'react-dom'],
    optimizedFixtures: [
      { fixture: path.join(__dirname, 'fixtures', 'bm04-antd-optimized.js'), packages: ['antd', 'react', 'react-dom'] },
    ],
  },
  {
    id: 'BM-05', library: 'react-icons',
    baselineFixture: path.join(__dirname, 'fixtures', 'bm05-icons-baseline.js'),
    baselinePackages: ['react-icons', 'react'],
    optimizedFixtures: [
      { fixture: path.join(__dirname, 'fixtures', 'bm05-icons-optimized.js'), packages: ['react-icons', 'react'] },
    ],
  },
];

async function main() {
  console.log(`DEBUG: MODULES array length: ${MODULES.length}`);
  console.log(`DEBUG: MODULES contents: ${JSON.stringify(MODULES.map(m => ({ id: m.id, library: m.library })), null, 2)}`);
  
  const moduleIndex = process.argv.indexOf('--module');
  const moduleArg = moduleIndex !== -1 
    ? (process.argv[moduleIndex + 1] ?? process.argv.find(a => a.startsWith('--module='))?.split('=')[1])
    : undefined;
  
  console.log(`DEBUG: moduleArg: ${moduleArg}`);

  const modules = moduleArg ? MODULES.filter(m => m.id === moduleArg) : MODULES;
  console.log(`Running modules: ${moduleArg ? moduleArg : 'ALL'} (${modules.length} modules)`);
  console.log(`Module IDs: ${modules.map(m => m.id).join(', ')}`);
  const results: BenchmarkResult[] = [];

  for (const mod of modules) {
    console.log(`\n[${mod.id}] ${mod.library}`);
    console.log('  Bundling baseline...');
    const baseline = bundleFixture(mod.baselineFixture, mod.baselinePackages);
    console.log(`  Baseline: ${(baseline.rawBytes / 1024).toFixed(1)} KB raw, ${(baseline.gzipBytes / 1024).toFixed(1)} KB gzip`);

    const optimizedResults: BundleMetrics[] = [];
    for (const opt of mod.optimizedFixtures) {
      console.log(`  Bundling optimized (${path.basename(opt.fixture)})...`);
      const metrics = bundleFixture(opt.fixture, opt.packages);
      console.log(`  Optimized: ${(metrics.rawBytes / 1024).toFixed(1)} KB raw, ${(metrics.gzipBytes / 1024).toFixed(1)} KB gzip`);
      optimizedResults.push(metrics);
    }

    const bestOptimized = optimizedResults.reduce((a, b) => a.gzipBytes < b.gzipBytes ? a : b);
    const sizeRatio = baseline.gzipBytes / bestOptimized.gzipBytes;
    const savingsKB = (baseline.gzipBytes - bestOptimized.gzipBytes) / 1024;

    console.log(`  → Savings: ${savingsKB.toFixed(1)} KB gzip (${sizeRatio.toFixed(1)}× smaller)`);

    results.push({
      module: mod.id, library: mod.library,
      baseline,
      optimized: optimizedResults.length === 1 ? optimizedResults[0] : optimizedResults,
      sizeRatio, savingsKB,
      timestamp: new Date().toISOString(),
    });
  }

  const outDir = path.join(__dirname, '..', '..', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `bench-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
