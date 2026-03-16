import * as http from 'http';
import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-04: HTTP Socket Leak
 *
 * Makes outgoing http.request() calls without destroying the request on timeout/error.
 * Leaky pattern: swallow errors, never destroy.
 * Proper pattern: req.destroy() on error and timeout.
 *
 * Uses a local loopback HTTP server to avoid external dependencies.
 */

const PORT = 19876;
let server: http.Server | null = null;
const leakedRequests: http.ClientRequest[] = [];
let activeSocketCount = 0;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });
}

export const bm04: LeakBenchmarkModule = {
  id: 'BM-04',
  name: 'HTTP Socket Leak',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> {
    await startServer();
  },

  async teardown(): Promise<void> {
    await this.reset();
    await stopServer();
  },

  async runLeaky(_iteration: number): Promise<number> {
    return new Promise((resolve) => {
      const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/', method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          activeSocketCount++;
          resolve(activeSocketCount);
        });
      });
      req.on('error', () => {}); // Swallow error, no cleanup
      // Missing: req.setTimeout + req.destroy()
      leakedRequests.push(req);
      req.end();
    });
  },

  async runProper(_iteration: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/', method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          req.destroy();
          resolve(0);
        });
      });
      req.on('error', (err) => { req.destroy(); reject(err); });
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  },

  async reset(): Promise<void> {
    for (const req of leakedRequests) {
      try { req.destroy(); } catch { /* ok */ }
    }
    leakedRequests.length = 0;
    activeSocketCount = 0;
  },
};
