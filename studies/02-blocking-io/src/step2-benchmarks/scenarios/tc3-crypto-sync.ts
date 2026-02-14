/**
 * TC3: crypto.pbkdf2Sync in Auth Middleware
 *
 * Scenario: Password hashing on login endpoint.
 * Bad:  crypto.pbkdf2Sync — CPU-bound, blocks event loop for ~50-200ms.
 * Good: crypto.pbkdf2 (async callback, promisified).
 */

import express from 'express';
import { pbkdf2Sync, pbkdf2, randomBytes } from 'crypto';
import { promisify } from 'util';

// Default benchmark tuning for TC3 (can still be overridden by env vars).
// This ensures the async version has enough worker capacity in most local machines.
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = '16';

const pbkdf2Async = promisify(pbkdf2);

// Higher default workload to make sync-vs-async contrast visible on fast CPUs.
// Can be overridden per run: TC3_PBKDF2_ITERATIONS=500000 npm run bench:all
// We enforce a floor so accidental tiny values do not invalidate the benchmark.
const ITERATIONS = Math.max(100_000, Number(process.env.TC3_PBKDF2_ITERATIONS || '1000000'));
const KEY_LEN = 64;
const DIGEST = 'sha512';
// Shared salt keeps work deterministic; this benchmark compares sync-vs-async mechanics,
// not cryptographic variability across random salts.
const SALT = randomBytes(16);

export function createBadServer(): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/api/login', (req, res) => {
    const password = req.body?.password || 'test-password';

    // BAD: synchronous PBKDF2 blocks the event loop while CPU work is in progress.
    // Under concurrent load this causes request queueing and timeout cascades.
    const hash = pbkdf2Sync(password, SALT, ITERATIONS, KEY_LEN, DIGEST);
    res.json({ status: 'ok', hashLength: hash.length });
  });

  // Health check is useful during manual debugging of long-running crypto tests.
  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

export function createGoodServer(): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/api/login', async (req, res) => {
    const password = req.body?.password || 'test-password';

    // GOOD: async PBKDF2 runs in libuv worker threads, keeping event loop responsive.
    const hash = await pbkdf2Async(password, SALT, ITERATIONS, KEY_LEN, DIGEST);
    res.json({ status: 'ok', hashLength: hash.length });
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

export const scenario = {
  name: 'TC3: pbkdf2Sync in auth',
  description: 'Password hashing per login — sync vs async PBKDF2',
  endpoint: '/api/login',
  // Explicit POST payload ensures benchmark hits the login code path.
  method: 'POST' as const,
  body: JSON.stringify({ password: 'test-password-123' }),
  headers: { 'Content-Type': 'application/json' },
};
