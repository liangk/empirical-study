/**
 * TC4: writeFileSync in Request Handler
 *
 * Scenario: Audit log / file write per request.
 * Bad:  fs.writeFileSync / appendFileSync — blocks event loop during disk I/O.
 * Good: fs.appendFile (async) with buffered writes.
 */

import express from 'express';
import { appendFileSync, appendFile, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const appendFileAsync = promisify(appendFile);

const FIXTURE_DIR = join(__dirname, '..', '..', '..', '.fixtures');
const LOG_FILE_BAD = join(FIXTURE_DIR, 'audit-bad.log');
const LOG_FILE_GOOD = join(FIXTURE_DIR, 'audit-good.log');

function ensureFixture() {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  // Reset log files
  writeFileSync(LOG_FILE_BAD, '');
  writeFileSync(LOG_FILE_GOOD, '');
}

export function createBadServer(): express.Express {
  ensureFixture();
  const app = express();

  app.get('/api/action', (req, res) => {
    const entry = `[${new Date().toISOString()}] action from ${req.ip}\n`;

    // BAD: Synchronous append on every request
    appendFileSync(LOG_FILE_BAD, entry);
    res.json({ status: 'logged' });
  });

  return app;
}

export function createGoodServer(): express.Express {
  ensureFixture();
  const app = express();

  // Buffered write approach
  let buffer: string[] = [];
  let flushTimer: NodeJS.Timeout | null = null;
  const FLUSH_INTERVAL = 100; // flush every 100ms

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      if (buffer.length === 0) return;
      const batch = buffer.join('');
      buffer = [];
      await appendFileAsync(LOG_FILE_GOOD, batch);
    }, FLUSH_INTERVAL);
  }

  app.get('/api/action', (req, res) => {
    const entry = `[${new Date().toISOString()}] action from ${req.ip}\n`;

    // GOOD: Buffer writes and flush asynchronously
    buffer.push(entry);
    scheduleFlush();
    res.json({ status: 'logged' });
  });

  return app;
}

export const scenario = {
  name: 'TC4: writeFileSync in handler',
  description: 'Audit log write per request — sync vs buffered async',
  endpoint: '/api/action',
};
