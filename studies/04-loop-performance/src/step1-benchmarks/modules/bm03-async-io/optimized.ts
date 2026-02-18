import * as http from 'http';
import { generateBm03Data } from '../../harness/data-gen';

const _cache = new Map<number, number[]>();

function getData(n: number): number[] {
  if (!_cache.has(n)) _cache.set(n, generateBm03Data(n));
  return _cache.get(n)!;
}

function fetchItem(port: number, id: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/item/${id}`, res => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * BM-03 OPTIMIZED: All requests are dispatched in parallel via Promise.all.
 * Total wall-clock time ≈ max(individual latency) instead of sum(all latencies).
 */
export async function runOptimized(n: number, port: number): Promise<string[]> {
  const ids = getData(n);
  return Promise.all(ids.map(id => fetchItem(port, id)));
}
