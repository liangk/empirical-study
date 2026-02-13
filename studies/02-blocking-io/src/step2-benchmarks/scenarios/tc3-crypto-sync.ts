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

const pbkdf2Async = promisify(pbkdf2);

// Realistic PBKDF2 params: 100,000 iterations, 64-byte key
const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
const SALT = randomBytes(16);

export function createBadServer(): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/api/login', (req, res) => {
    const password = req.body?.password || 'test-password';

    // BAD: Synchronous PBKDF2 — blocks event loop for ~50-200ms
    const hash = pbkdf2Sync(password, SALT, ITERATIONS, KEY_LEN, DIGEST);
    res.json({ status: 'ok', hashLength: hash.length });
  });

  // Health check to verify server is alive
  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

export function createGoodServer(): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/api/login', async (req, res) => {
    const password = req.body?.password || 'test-password';

    // GOOD: Async PBKDF2 — runs in libuv thread pool, doesn't block event loop
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
  method: 'POST' as const,
  body: JSON.stringify({ password: 'test-password-123' }),
  headers: { 'Content-Type': 'application/json' },
};
