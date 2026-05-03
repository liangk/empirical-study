/**
 * Study 08: DOM Manipulation Benchmark Runner
 *
 * Launches each fixture HTML in headless Chromium via Playwright.
 * Each fixture exposes window.__runBenchmark(n) → Promise<BenchResult>.
 * Collects 30 trials per n × variant, discards first 5 (warmup).
 *
 * BM-01: Layout thrashing (read offsetWidth → write style in loop vs. batch)
 * BM-02: innerHTML in loop vs. single template string
 * BM-03: Style mutation per-property vs. CSS class toggle
 * BM-04: DOM query in loop vs. cached reference
 * BM-05: appendChild × n vs. DocumentFragment batch insert
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { chromium } from 'playwright';

interface BenchResult {
  durationMs: number;
  fps: number;
  longTaskCount: number;
}

interface TrialSet {
  module: string;
  variant: 'baseline' | 'optimized';
  n: number;
  trials: BenchResult[];
  mean: number;
  median: number;
  stddev: number;
  cv: number;
  p5: number;
  p95: number;
}

interface ModuleResult {
  module: string;
  description: string;
  nValues: number[];
  baseline: TrialSet[];
  optimized: TrialSet[];
  speedupByN: Record<number, number>;
  timestamp: string;
}

const N_VALUES = [100, 500, 1000, 5000, 10000];
const TRIALS = 30;
const WARMUP = 5;
const CV_THRESHOLD = 0.15;
const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function serveFixtures(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(FIXTURE_DIR, req.url === '/' ? 'index.html' : req.url!);
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath);
        const ct = ext === '.html' ? 'text/html' : 'application/javascript';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const cv = stddev / mean;
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { mean, median, stddev, cv, p5, p95 };
}

async function runVariant(
  page: import('playwright').Page,
  baseUrl: string,
  fixture: string,
  n: number,
  module: string,
  variant: 'baseline' | 'optimized'
): Promise<TrialSet> {
  const url = `${baseUrl}/${fixture}`;
  const allTrials: BenchResult[] = [];

  for (let trial = 0; trial < TRIALS; trial++) {
    await page.goto(url, { waitUntil: 'load' });
    const result = await page.evaluate(async (nodeCount: number) => {
      // This code runs in the browser context where window exists
      return await (globalThis as any).__runBenchmark(nodeCount);
    }, n);
    allTrials.push(result as BenchResult);
  }

  const accepted = allTrials.slice(WARMUP);
  const durations = accepted.map(t => t.durationMs);
  const s = stats(durations);

  if (s.cv > CV_THRESHOLD) {
    console.warn(`    ⚠ CV=${(s.cv * 100).toFixed(1)}% > ${CV_THRESHOLD * 100}% for ${module} ${variant} n=${n}`);
  }

  return { module, variant, n, trials: accepted, ...s };
}

const MODULES: Array<{
  id: string;
  description: string;
  baselineFixture: string;
  optimizedFixture: string;
}> = [
  {
    id: 'BM-01',
    description: 'Forced synchronous layout (layout thrashing)',
    baselineFixture: 'bm01-layout-thrash-baseline.html',
    optimizedFixture: 'bm01-layout-thrash-optimized.html',
  },
  {
    id: 'BM-02',
    description: 'innerHTML in loop vs. single template string',
    baselineFixture: 'bm02-innerhtml-baseline.html',
    optimizedFixture: 'bm02-innerhtml-optimized.html',
  },
  {
    id: 'BM-03',
    description: 'Style mutation per-property vs. CSS class toggle',
    baselineFixture: 'bm03-style-mutation-baseline.html',
    optimizedFixture: 'bm03-style-mutation-optimized.html',
  },
  {
    id: 'BM-04',
    description: 'DOM query in loop vs. cached reference',
    baselineFixture: 'bm04-query-cache-baseline.html',
    optimizedFixture: 'bm04-query-cache-optimized.html',
  },
  {
    id: 'BM-05',
    description: 'appendChild × n vs. DocumentFragment batch insert',
    baselineFixture: 'bm05-list-render-baseline.html',
    optimizedFixture: 'bm05-list-render-optimized.html',
  },
];

async function main() {
  const moduleArgIndex = process.argv.indexOf('--module');
  const moduleArg = process.argv.find(a => a.startsWith('--module'))?.split('=')[1]
    ?? (moduleArgIndex >= 0 ? process.argv[moduleArgIndex + 1] : undefined);
  const modules = moduleArg ? MODULES.filter(m => m.id === moduleArg) : MODULES;

  console.log(`Running ${modules.length} module(s): ${modules.map(m => m.id).join(', ')}`);

  const { server, baseUrl } = await serveFixtures();
  console.log(`Fixture server running at ${baseUrl}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const version = browser.version();
  console.log(`Browser version: ${version}`);
  const allResults: ModuleResult[] = [];

  try {
    for (const mod of modules) {
      console.log(`\n[${mod.id}] ${mod.description}`);
      const baselineTrials: TrialSet[] = [];
      const optimizedTrials: TrialSet[] = [];

      for (const n of N_VALUES) {
        process.stdout.write(`  n=${n} baseline ... `);
        const bl = await runVariant(page, baseUrl, mod.baselineFixture, n, mod.id, 'baseline');
        console.log(`${bl.median.toFixed(1)} ms (CV ${(bl.cv * 100).toFixed(1)}%)`);

        process.stdout.write(`  n=${n} optimized ... `);
        const opt = await runVariant(page, baseUrl, mod.optimizedFixture, n, mod.id, 'optimized');
        console.log(`${opt.median.toFixed(1)} ms (CV ${(opt.cv * 100).toFixed(1)}%)`);

        const speedup = bl.median / opt.median;
        console.log(`  → ${speedup.toFixed(1)}× faster`);

        baselineTrials.push(bl);
        optimizedTrials.push(opt);
      }

      const speedupByN: Record<number, number> = {};
      for (let i = 0; i < N_VALUES.length; i++) {
        speedupByN[N_VALUES[i]] = baselineTrials[i].median / optimizedTrials[i].median;
      }

      allResults.push({
        module: mod.id,
        description: mod.description,
        nValues: N_VALUES,
        baseline: baselineTrials,
        optimized: optimizedTrials,
        speedupByN,
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  const outDir = path.join(__dirname, '..', '..', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `bench-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nResults written to ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
