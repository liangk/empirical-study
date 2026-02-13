/**
 * TC1: readFileSync in Request Handler
 *
 * Scenario: Config or template file read on every request.
 * Bad:  fs.readFileSync inside handler — blocks event loop per request.
 * Good: fs.readFile (async) with caching.
 */

import express from 'express';
import { readFileSync, readFile, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(readFile);

// Create a test fixture file (~50KB — realistic config/template size)
const FIXTURE_DIR = join(__dirname, '..', '..', '..', '.fixtures');
const FIXTURE_FILE = join(FIXTURE_DIR, 'config.json');

function ensureFixture() {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  if (!existsSync(FIXTURE_FILE)) {
    const data: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      data[`key_${i}`] = `value_${i}_${'x'.repeat(80)}`;
    }
    writeFileSync(FIXTURE_FILE, JSON.stringify(data, null, 2));
  }
}

export function createBadServer(): express.Express {
  ensureFixture();
  const app = express();

  app.get('/api/config', (req, res) => {
    // BAD: Synchronous file read on every request
    const config = JSON.parse(readFileSync(FIXTURE_FILE, 'utf-8'));
    res.json({ status: 'ok', keys: Object.keys(config).length });
  });

  return app;
}

export function createGoodServer(): express.Express {
  ensureFixture();
  const app = express();

  // Cache for the config file
  let cachedConfig: any = null;
  let cacheExpiry = 0;
  const CACHE_TTL = 5000; // 5 seconds

  app.get('/api/config', async (req, res) => {
    // GOOD: Async file read with caching
    const now = Date.now();
    if (!cachedConfig || now > cacheExpiry) {
      const raw = await readFileAsync(FIXTURE_FILE, 'utf-8');
      cachedConfig = JSON.parse(raw);
      cacheExpiry = now + CACHE_TTL;
    }
    res.json({ status: 'ok', keys: Object.keys(cachedConfig).length });
  });

  return app;
}

export const scenario = {
  name: 'TC1: readFileSync in handler',
  description: 'Config/template read per request — sync vs async+cache',
  endpoint: '/api/config',
};
