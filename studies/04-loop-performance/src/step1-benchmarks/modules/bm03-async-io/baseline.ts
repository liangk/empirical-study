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
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * BM-03 BASELINE: Sequential async I/O — each request is awaited before the next starts.
 * Total time = sum of all individual request round-trips.
 */
export async function runBaseline(n: number, port: number): Promise<string[]> {
  const ids = getData(n);
  const results: string[] = [];
  for (const id of ids) {
    const body = await fetchItem(port, id);
    results.push(body);
  }
  return results;
}

/** Start a mock HTTP server on a random port. Returns { server, port }. */
export function startMockServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise(resolve => {
    const server = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
      }, 2);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

/** Stop the mock server. */
export function stopMockServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}
