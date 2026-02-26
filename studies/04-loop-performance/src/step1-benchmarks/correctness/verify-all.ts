import { runBaseline as bm01Base } from '../modules/bm01-regex/baseline';
import { runOptimized as bm01OptFn } from '../modules/bm01-regex/optimized';
import { runBaseline as bm02Base } from '../modules/bm02-json/baseline';
import { runOptimized as bm02Opt } from '../modules/bm02-json/optimized';
import { runBaseline as bm03Base, startMockServer, stopMockServer } from '../modules/bm03-async-io/baseline';
import { runOptimized as bm03Opt } from '../modules/bm03-async-io/optimized';
import { runBaseline as bm04Base } from '../modules/bm04-nested-loops/baseline';
import { runOptimized as bm04Opt } from '../modules/bm04-nested-loops/optimized';
import { runBaseline as bm05Base, runBaselineA as bm05BaseA } from '../modules/bm05-nested-array/baseline';
import { runOptimized as bm05Opt } from '../modules/bm05-nested-array/optimized';
import { runBaseline as bm06Base } from '../modules/bm06-chained-array/baseline';
import { runOptimized as bm06Opt } from '../modules/bm06-chained-array/optimized';
import { verifyCorrectness as bm07Verify } from '../modules/bm07-dom/node-runner';

const TEST_N_VALUES = [0, 1, 10, 100];
const EDGE_LARGE_N = 1000;

interface TestResult { module: string; n: number; passed: boolean; detail: string; }

function assertEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function verifyBm01(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES, EDGE_LARGE_N];
  for (const n of ns) {
    const base = bm01Base(n);
    const opt = bm01OptFn(n);
    const passed = base === opt;
    results.push({ module: 'BM-01', n, passed, detail: passed ? 'ok' : `base=${base} opt=${opt}` });
  }
  return results;
}

async function verifyBm02(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES, EDGE_LARGE_N];
  for (const n of ns) {
    const base = bm02Base(n);
    const opt = bm02Opt(n);
    const passed = assertEqual(base, opt);
    results.push({ module: 'BM-02', n, passed, detail: passed ? 'ok' : 'output mismatch' });
  }
  return results;
}

async function verifyBm03(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [0, 1, 10]; // Keep n small for async test to avoid timeouts
  
  let server: any;
  let port = 0;
  
  try {
    const s = await startMockServer();
    server = s.server;
    port = s.port;

    for (const n of ns) {
      const baseStrs = await bm03Base(n, port);
      const optStrs = await bm03Opt(n, port);
      
      if (baseStrs.length !== optStrs.length) {
        results.push({ module: 'BM-03', n, passed: false, detail: `length mismatch: base=${baseStrs.length} opt=${optStrs.length}` });
        continue;
      }

      let allMatch = true;
      for (let i = 0; i < baseStrs.length; i++) {
        try {
          const bObj = JSON.parse(baseStrs[i]);
          const oObj = JSON.parse(optStrs[i]);
          // Ignore timestamp 'ts' field, only compare 'status'
          if (bObj.status !== oObj.status) {
            allMatch = false;
            break;
          }
        } catch (e) {
          allMatch = false;
          break;
        }
      }

      results.push({ module: 'BM-03', n, passed: allMatch, detail: allMatch ? 'ok' : 'content mismatch (ignoring timestamps)' });
    }
  } catch (err) {
    results.push({ module: 'BM-03', n: 0, passed: false, detail: `server error: ${err}` });
  } finally {
    if (server) await stopMockServer(server);
  }
  
  return results;
}

async function verifyBm04(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES, EDGE_LARGE_N];
  for (const n of ns) {
    const base = bm04Base(n);
    const opt = bm04Opt(n);
    const passed = assertEqual(base, opt);
    results.push({ module: 'BM-04', n, passed, detail: passed ? 'ok' : 'output mismatch' });
  }
  return results;
}

async function verifyBm05(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES, EDGE_LARGE_N];
  for (const n of ns) {
    const base = bm05Base(n);
    const baseA = bm05BaseA(n);
    const opt = bm05Opt(n);
    const passedA = baseA === base;
    const passedOpt = opt === base;
    results.push({ module: 'BM-05', n, passed: passedA, detail: passedA ? 'baseline-a ok' : `baseA=${baseA} base=${base}` });
    results.push({ module: 'BM-05', n, passed: passedOpt, detail: passedOpt ? 'optimized ok' : `opt=${opt} base=${base}` });
  }
  return results;
}

async function verifyBm06(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES, EDGE_LARGE_N];
  for (const n of ns) {
    const base = bm06Base(n);
    const opt = bm06Opt(n);
    const passed = assertEqual(base, opt);
    results.push({ module: 'BM-06', n, passed, detail: passed ? 'ok' : 'output mismatch' });
  }
  return results;
}

async function verifyBm07(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ns = [...TEST_N_VALUES.filter(n => n > 0), EDGE_LARGE_N];
  for (const n of ns) {
    const passed = bm07Verify(n);
    results.push({ module: 'BM-07', n, passed, detail: passed ? 'ok' : 'innerHTML mismatch' });
  }
  return results;
}

async function main(): Promise<void> {
  let moduleFilter: string | undefined;
  
  // Support both --module=BM-XX and --module BM-XX
  const argEq = process.argv.find(a => a.startsWith('--module='));
  if (argEq) {
    moduleFilter = argEq.split('=')[1];
  } else {
    const argIdx = process.argv.indexOf('--module');
    if (argIdx !== -1 && argIdx + 1 < process.argv.length) {
      moduleFilter = process.argv[argIdx + 1];
    }
  }

  const allResults: TestResult[] = [];

  const verifiers: Array<[string, () => Promise<TestResult[]>]> = [
    ['BM-01', verifyBm01],
    ['BM-02', verifyBm02],
    ['BM-03', verifyBm03],
    ['BM-04', verifyBm04],
    ['BM-05', verifyBm05],
    ['BM-06', verifyBm06],
    ['BM-07', verifyBm07],
  ];

  for (const [id, fn] of verifiers) {
    if (moduleFilter && id !== moduleFilter) continue;
    console.log(`\nVerifying ${id}...`);
    const results = await fn();
    for (const r of results) {
      const icon = r.passed ? '✓' : '✗';
      console.log(`  ${icon} n=${r.n}: ${r.detail}`);
    }
    allResults.push(...results);
  }

  const failed = allResults.filter(r => !r.passed);
  console.log(`\n--- Correctness Gate ---`);
  console.log(`  Total checks : ${allResults.length}`);
  console.log(`  Passed       : ${allResults.length - failed.length}`);
  console.log(`  Failed       : ${failed.length}`);

  if (failed.length > 0) {
    console.error('\n✗ CORRECTNESS GATE FAILED — fix mismatches before benchmarking.');
    process.exit(1);
  } else {
    console.log('\n✓ All correctness checks passed. Safe to benchmark.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
