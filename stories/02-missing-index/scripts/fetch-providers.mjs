#!/usr/bin/env node
/**
 * Record each analysed schema's database provider and relation mode.
 *
 * Usage:
 *   GITHUB_TOKEN=... node scripts/fetch-providers.mjs
 *
 * Reads  data/results.tsv (the analysed schemas, with their blob SHAs)
 * Writes data/providers.tsv  repo, sha, provider, relationMode
 *
 * Why this exists. Whether "no @@index in the schema" means "no index in the
 * database" depends on the database. MySQL's InnoDB requires an index on every
 * foreign-key column and creates one itself when the constraint is added, so
 * on MySQL an unindexed-looking foreign key is indexed. PostgreSQL, SQLite and
 * SQL Server create nothing. Under `relationMode = "prisma"` no constraint
 * exists at all, so InnoDB never gets the chance either \u2014 Prisma's docs say to
 * add the index by hand in that mode.
 *
 * This was missed in the first analysis and found while drafting the article,
 * after the schema files had been deleted. Each schema is fetched again at
 * its recorded blob SHA, the two datasource settings are read, and the text
 * is discarded. Nothing but those two values is written to disk.
 *
 * Resumable: rows already in providers.tsv are skipped, and each result is
 * appended as it arrives, so an interrupted run can simply be started again.
 */

import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const OUT = join(DATA, 'providers.tsv');

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

/**
 * Waits out the hourly limit rather than giving up after a fixed number of
 * retries. A run of ~2,900 fetches fits in one hour's 5,000 requests, but a
 * token already partly spent can hit the limit mid-run, and a row recorded as
 * "fetch failed" would silently drop out of the provider split.
 */
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
    if (res.status === 404) return null; // repository deleted or made private since collection
    if (!res.ok) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    const blob = await res.json();
    return Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  }
  return undefined;
}

/** Comments stripped first, so a commented-out `// provider = "mysql"` is not read. */
function datasourceOf(schema) {
  const clean = schema.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const block = clean.match(/datasource\s+\w+\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const provider = block.match(/^\s*provider\s*=\s*"([^"]+)"/m)?.[1] ?? 'unknown';
  const relationMode =
    block.match(/^\s*(?:relationMode|referentialIntegrity)\s*=\s*"([^"]+)"/m)?.[1] ?? 'foreignKeys';
  return { provider, relationMode };
}

const results = readTsv(join(DATA, 'results.tsv'));
if (results.length === 0) {
  console.error('data/results.tsv has no rows. Rerun analyse-schemas.mjs first (restore-schemas.mjs if data/schemas/ is gone).');
  process.exit(1);
}

// Read from the local copy when it exists; otherwise fetch at the recorded SHA.
const fileOf = new Map(readTsv(join(DATA, 'corpus.tsv')).map(r => [r.repo, r.file]));
function localSchema(repo) {
  const file = fileOf.get(repo);
  const path = file && join(DATA, 'schemas', file);
  return path && existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

if (!existsSync(OUT)) writeFileSync(OUT, 'repo\tsha\tprovider\trelationMode\n');
const done = new Set(readTsv(OUT).map(r => r.repo));

let n = 0;
for (const row of results) {
  n++;
  if (done.has(row.repo)) continue;

  const schema = localSchema(row.repo) ?? (await fetchBlob(row.repo, row.sha));
  let provider;
  let relationMode;
  if (schema === null) {
    provider = 'unavailable';
    relationMode = '';
  } else if (schema === undefined) {
    provider = 'fetch-failed';
    relationMode = '';
  } else {
    ({ provider, relationMode } = datasourceOf(schema));
  }

  appendFileSync(OUT, `${row.repo}\t${row.sha}\t${provider}\t${relationMode}\n`);
  if (n % 50 === 0) console.error(`  ${n} / ${results.length}`);
}

const rows = readTsv(OUT);
const counts = {};
for (const r of rows) {
  const key = r.provider === 'mysql' ? `mysql (${r.relationMode})` : r.provider;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log('');
console.log(`${rows.length} / ${results.length} recorded`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}`);
console.log('');
console.log('Next: node scripts/by-provider.mjs');
