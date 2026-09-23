#!/usr/bin/env node
/**
 * Re-fetch every schema in corpus.tsv at its recorded blob SHA.
 *
 * Usage:
 *   GITHUB_TOKEN=... node scripts/restore-schemas.mjs
 *
 * Writes data/schemas/<file> for each row of data/corpus.tsv.
 *
 * A blob SHA is a hash of the content, so what comes back is byte-for-byte
 * what was analysed \u2014 the results reproduce exactly, not approximately. That
 * is the point of recording blob SHAs at collection time, and this is the
 * script that cashes it in.
 *
 * data/schemas/ is gitignored. Delete it again once the analysis is rerun.
 *
 * Resumable: files already present are skipped. A schema whose repository
 * has since been deleted or made private cannot be restored, and is listed
 * at the end \u2014 analyse-schemas.mjs will refuse to run until that is resolved,
 * because silently dropping it would change the corpus.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const SCHEMAS = join(DATA, 'schemas');

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required.');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'code-evolution-lab-study',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const columns = header.split('\t');
  return lines.filter(Boolean).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

/** Waits out rate limits instead of giving up, so no row is silently skipped. */
async function fetchBlob(repo, sha) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/git/blobs/${sha}`, { headers: HEADERS });
    if (res.status === 403 || res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? 0) * 1000;
      const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
      const wait = retryAfter || (resetAt > Date.now() ? resetAt - Date.now() + 2000 : 60_000);
      console.error(`  rate limited, waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const blob = await res.json();
    return Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  }
  return undefined;
}

mkdirSync(SCHEMAS, { recursive: true });
const corpus = readTsv(join(DATA, 'corpus.tsv'));
const unavailable = [];
const failed = [];

let n = 0;
for (const entry of corpus) {
  n++;
  if (n % 100 === 0) console.error(`  ${n} / ${corpus.length}`);
  const path = join(SCHEMAS, entry.file);
  if (existsSync(path)) continue;

  const schema = await fetchBlob(entry.repo, entry.sha);
  if (schema === null) { unavailable.push(entry.repo); continue; }
  if (schema === undefined) { failed.push(entry.repo); continue; }
  writeFileSync(path, schema);
}

const present = corpus.filter(e => existsSync(join(SCHEMAS, e.file))).length;
console.log('');
console.log(`${present} / ${corpus.length} schemas present`);
if (failed.length) {
  console.log(`${failed.length} failed to fetch \u2014 run again to retry them:`);
  for (const r of failed) console.log(`  ${r}`);
}
if (unavailable.length) {
  console.log(`${unavailable.length} no longer available (repository deleted or made private):`);
  for (const r of unavailable) console.log(`  ${r}`);
}
if (present === corpus.length) {
  console.log('');
  console.log('Next: node scripts/crosscheck-prisma.mjs && node scripts/analyse-schemas.mjs && node scripts/stratify.mjs');
}
