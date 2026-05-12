// Study 09: Large Payload Anti-Patterns - Benchmark Runner
// Measures JSON parse time, memory consumption, and event loop blocking

import * as path from 'path';
import * as fs from 'fs';
import { BenchResult, ModuleResult, PAYLOAD_SIZES, TRIALS, WARMUP, CV_THRESHOLD } from './types';
import { stats } from './stats';
import { runVariant, generateJsonPayload, measureParseTime } from './runner';

// --- Benchmark Modules ---

const MODULES = [
  {
    id: 'BM-01',
    description: 'JSON Parse Time by Size',
    runBaseline: async (size: number): Promise<BenchResult> => {
      const json = generateJsonPayload(size, false);
      const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
      return { payloadSize: size, parseTimeMs, rssDeltaMb, eventLoopBlockMs: 0 };
    },
    runOptimized: async (size: number): Promise<BenchResult> => {
      // Paginated: parse in 100KB chunks (only if size >= 100KB)
      const chunkSize = 100 * 1024; // 100KB chunks
      if (size < chunkSize) {
        // Small payload: parse directly without chunking overhead
        const json = generateJsonPayload(size, false);
        const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
        return { payloadSize: size, parseTimeMs, rssDeltaMb, eventLoopBlockMs: 0 };
      }
      const numChunks = Math.floor(size / chunkSize);
      let totalParseTime = 0;
      let maxRssDelta = 0;
      for (let i = 0; i < numChunks; i++) {
        const json = generateJsonPayload(chunkSize, false);
        const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
        totalParseTime += parseTimeMs;
        maxRssDelta = Math.max(maxRssDelta, rssDeltaMb);
      }
      return { payloadSize: size, parseTimeMs: totalParseTime, rssDeltaMb: maxRssDelta, eventLoopBlockMs: 0 };
    },
  },
  {
    id: 'BM-02',
    description: 'Parse Time and Memory by Size',
    runBaseline: async (size: number): Promise<BenchResult> => {
      const json = generateJsonPayload(size, false);
      const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
      // Force retention by accessing data
      const _ = JSON.parse(json).items?.length || 0;
      return { payloadSize: size, parseTimeMs, rssDeltaMb, eventLoopBlockMs: 0 };
    },
    runOptimized: async (size: number): Promise<BenchResult> => {
      // Paginated: parse in 100KB chunks (only if size >= 100KB) - identical to BM-01
      const chunkSize = 100 * 1024; // 100KB chunks
      if (size < chunkSize) {
        // Small payload: parse directly without chunking overhead
        const json = generateJsonPayload(size, false);
        const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
        // Force retention by accessing data
        const _ = JSON.parse(json).items?.length || 0;
        return { payloadSize: size, parseTimeMs, rssDeltaMb, eventLoopBlockMs: 0 };
      }
      const numChunks = Math.floor(size / chunkSize);
      let totalParseTime = 0;
      let maxRssDelta = 0;
      for (let i = 0; i < numChunks; i++) {
        const json = generateJsonPayload(chunkSize, false);
        const { parseTimeMs, rssDeltaMb } = measureParseTime(json);
        totalParseTime += parseTimeMs;
        maxRssDelta = Math.max(maxRssDelta, rssDeltaMb);
        // Force retention by accessing data
        const _ = JSON.parse(json).items?.length || 0;
      }
      return { payloadSize: size, parseTimeMs: totalParseTime, rssDeltaMb: maxRssDelta, eventLoopBlockMs: 0 };
    },
  },
  {
    id: 'BM-03',
    description: 'Unbounded vs Paginated Query (Simulated)',
    runBaseline: async (size: number): Promise<BenchResult> => {
      // Simulate unbounded query: generate and parse full payload
      const json = generateJsonPayload(size, false);
      const start = performance.now();
      const data = JSON.parse(json);
      const end = performance.now();
      const _ = data.items?.length || 0;
      return { payloadSize: size, parseTimeMs: end - start, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
    runOptimized: async (size: number): Promise<BenchResult> => {
      // Simulate paginated query: only 100 items
      const json = generateJsonPayload(10 * 1024, false); // 10KB = ~100 items
      const start = performance.now();
      const data = JSON.parse(json);
      const end = performance.now();
      const _ = data.items?.length || 0;
      return { payloadSize: 10 * 1024, parseTimeMs: end - start, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
  },
  {
    id: 'BM-04',
    description: 'Deep Nested Include vs Flat',
    runBaseline: async (size: number): Promise<BenchResult> => {
      // Deep nested: users.posts.comments structure
      const json = generateJsonPayload(Math.min(size, 1024 * 1024), true);
      const start = performance.now();
      const data = JSON.parse(json);
      const end = performance.now();
      const _ = data.users?.length || 0;
      return { payloadSize: json.length, parseTimeMs: end - start, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
    runOptimized: async (size: number): Promise<BenchResult> => {
      // Flat: separate endpoints at same payload size
      const json = generateJsonPayload(Math.min(size, 1024 * 1024), false);
      const start = performance.now();
      const data = JSON.parse(json);
      const end = performance.now();
      const _ = data.items?.length || 0;
      return { payloadSize: json.length, parseTimeMs: end - start, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
  },
  {
    id: 'BM-05',
    description: 'GraphQL Batch vs Cursor Pagination',
    runBaseline: async (size: number): Promise<BenchResult> => {
      // Batch: fetch all items in one query
      const json = generateJsonPayload(size, false);
      const start = performance.now();
      const data = JSON.parse(json);
      const end = performance.now();
      const _ = data.items?.length || 0;
      return { payloadSize: size, parseTimeMs: end - start, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
    runOptimized: async (size: number): Promise<BenchResult> => {
      // Cursor: fetch 50 items at a time, simulate 10 requests
      let totalParseTime = 0;
      const chunkSize = Math.max(1024, Math.floor(size / 10));
      for (let i = 0; i < 10; i++) {
        const json = generateJsonPayload(chunkSize, false);
        const start = performance.now();
        const data = JSON.parse(json);
        const end = performance.now();
        totalParseTime += end - start;
        const _ = data.items?.length || 0;
      }
      return { payloadSize: chunkSize * 10, parseTimeMs: totalParseTime, rssDeltaMb: 0, eventLoopBlockMs: 0 };
    },
  },
];

// --- Main ---

async function main() {
  const moduleArgIndex = process.argv.indexOf('--module');
  const moduleArg = process.argv.find(a => a.startsWith('--module'))?.split('=')[1]
    ?? (moduleArgIndex >= 0 ? process.argv[moduleArgIndex + 1] : undefined);
  const modules = moduleArg ? MODULES.filter(m => m.id === moduleArg) : MODULES;

  console.log(`Running ${modules.length} module(s): ${modules.map(m => m.id).join(', ')}`);
  console.log(`Payload sizes: ${PAYLOAD_SIZES.map(s => (s / 1024) + 'KB').join(', ')}`);
  console.log(`Trials: ${TRIALS}, Warmup: ${WARMUP}, CV threshold: ${CV_THRESHOLD * 100}%`);
  console.log('');

  const allResults: ModuleResult[] = [];

  for (const mod of modules) {
    console.log(`[${mod.id}] ${mod.description}`);
    const baselineTrials: any[] = [];
    const optimizedTrials: any[] = [];

    for (const size of PAYLOAD_SIZES) {
      process.stdout.write(`  ${(size / 1024)}KB baseline ... `);
      const bl = await runVariant(mod.runBaseline, size, mod.id, 'baseline');
      console.log(`${bl.median.toFixed(2)} ms (CV ${(bl.cv * 100).toFixed(1)}%)`);
      baselineTrials.push(bl);

      process.stdout.write(`  ${(size / 1024)}KB optimized ... `);
      const opt = await runVariant(mod.runOptimized, size, mod.id, 'optimized');
      console.log(`${opt.median.toFixed(2)} ms (CV ${(opt.cv * 100).toFixed(1)}%)`);
      optimizedTrials.push(opt);

      const speedup = bl.median / opt.median;
      console.log(`  → ${speedup.toFixed(1)}× faster`);
    }

    const speedupBySize: Record<number, number> = {};
    for (let i = 0; i < PAYLOAD_SIZES.length; i++) {
      speedupBySize[PAYLOAD_SIZES[i]] = baselineTrials[i].median / optimizedTrials[i].median;
    }

    allResults.push({
      module: mod.id,
      description: mod.description,
      payloadSizes: PAYLOAD_SIZES,
      baseline: baselineTrials,
      optimized: optimizedTrials,
      speedupBySize,
      timestamp: new Date().toISOString(),
    });
  }

  const outDir = path.join(__dirname, '..', '..', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `bench-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nResults written to ${outFile}`);
}

main().catch(console.error);
