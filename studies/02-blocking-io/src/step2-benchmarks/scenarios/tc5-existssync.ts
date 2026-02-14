/**
 * TC5: existsSync + statSync in Request Handler
 *
 * Scenario: File existence check per request (e.g., user avatar, uploaded file).
 * Bad:  fs.existsSync + fs.statSync — two sync syscalls per request.
 * Good: fs.stat (async) with LRU cache.
 */

import express from 'express';
import { existsSync, statSync, stat, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const statAsync = promisify(stat);

const FIXTURE_DIR = join(__dirname, '..', '..', '..', '.fixtures');
const AVATAR_DIR = join(FIXTURE_DIR, 'avatars');

function ensureFixture() {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });
  // Create a fixed-size corpus so request IDs map to mostly-existing files.
  for (let i = 0; i < 100; i++) {
    const file = join(AVATAR_DIR, `user-${i}.png`);
    if (!existsSync(file)) writeFileSync(file, Buffer.alloc(1024, 0)); // 1KB dummy
  }
}

export function createBadServer(): express.Express {
  ensureFixture();
  const app = express();

  app.get('/api/avatar/:userId', (req, res) => {
    const userId = req.params.userId;
    const filePath = join(AVATAR_DIR, `user-${userId}.png`);

    // BAD: existsSync + statSync means two blocking syscalls in the hot path.
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      res.json({ exists: true, size: stats.size, userId });
    } else {
      res.json({ exists: false, userId });
    }
  });

  return app;
}

export function createGoodServer(): express.Express {
  ensureFixture();
  const app = express();

  // Lightweight LRU-ish cache for stat results.
  // We keep this intentionally simple to focus on sync-vs-async impact.
  const cache = new Map<string, { exists: boolean; size: number; expiry: number }>();
  const CACHE_TTL = 5000;
  const MAX_CACHE = 500;

  app.get('/api/avatar/:userId', async (req, res) => {
    const userId = req.params.userId;
    const filePath = join(AVATAR_DIR, `user-${userId}.png`);
    const now = Date.now();

    // GOOD: async stat avoids event-loop blocking and cache avoids repeated I/O.
    let cached = cache.get(filePath);
    if (cached && now < cached.expiry) {
      res.json({ exists: cached.exists, size: cached.size, userId });
      return;
    }

    try {
      const stats = await statAsync(filePath);
      const entry = { exists: true, size: stats.size, expiry: now + CACHE_TTL };
      if (cache.size >= MAX_CACHE) {
        // Evict oldest inserted key (good enough for benchmark demonstration).
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(filePath, entry);
      res.json({ exists: true, size: stats.size, userId });
    } catch {
      const entry = { exists: false, size: 0, expiry: now + CACHE_TTL };
      cache.set(filePath, entry);
      res.json({ exists: false, userId });
    }
  });

  return app;
}

export const scenario = {
  name: 'TC5: existsSync + statSync in handler',
  description: 'File check per request — sync vs async+cache',
  endpoint: '/api/avatar/42',
};
