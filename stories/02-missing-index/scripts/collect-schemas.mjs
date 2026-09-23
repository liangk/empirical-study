#!/usr/bin/env node
/**
 * Collect a corpus of real Prisma schemas from GitHub.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node scripts/collect-schemas.mjs
 *   GITHUB_TOKEN=ghp_... node scripts/collect-schemas.mjs --limit 50   # smoke test
 *
 * Writes:
 *   data/schemas/<owner>__<repo>.prisma   the schema text, as fetched
 *   data/corpus.tsv                       one row per included schema
 *   data/excluded.tsv                     one row per rejection, with the reason
 *
 * Every exclusion is recorded with the rule that caused it, so the funnel is
 * reproducible and the article can state "searched N, excluded M for these
 * reasons, analysed K" without anyone having to take it on trust. The previous
 * study could not do that: its exclusions were decided by hand, in a terminal,
 * and reconstructed afterwards.
 *
 * Each schema is pinned to the blob SHA it was fetched at. The N+1 study
 * cloned at HEAD without recording commits and the SHAs had to be recovered by
 * date afterwards; this records them at collection time.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORY = join(HERE, '..');
const SCHEMA_DIR = join(STORY, 'data', 'schemas');

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required. A fine-grained token with public repo read access is enough.');
  process.exit(1);
}

const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i === -1 ? Infinity : Number(process.argv[i + 1]);
})();

// ---------------------------------------------------------------------------
// Inclusion criteria
// ---------------------------------------------------------------------------

/**
 * A schema with no relations says nothing about whether Prisma indexes foreign
 * keys, and a three-model minimum keeps out the single-table demos that a
 * search for `schema.prisma` otherwise fills up with.
 */
const MIN_MODELS = 3;
const MIN_RELATIONS = 1;

/** Anything not maintained in the last year is not what people ship today. */
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Templates and tutorials are written to be copied, not run. Their schemas are
 * illustrative, and including them would measure what example code looks like
 * rather than what production schemas look like.
 */
const TEMPLATE_WORDS = /\b(template|starter|boilerplate|example|examples|tutorial|demo|playground|scaffold|sample)\b/i;

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

const API = 'https://api.github.com';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'code-evolution-lab-study',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: HEADERS });

    if (res.status === 403 || res.status === 429) {
      // Secondary rate limit, or the code-search 10/minute budget.
      const retryAfter = Number(res.headers.get('retry-after') ?? 0);
      const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
      const waitMs = retryAfter > 0
        ? retryAfter * 1000
        : resetAt > Date.now()
          ? Math.min(resetAt - Date.now() + 1000, 120_000)
          : 60_000;
      console.error(`  rate limited, waiting ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      if (attempt === retries) throw new Error(`${res.status} ${res.statusText} for ${path}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }

    return res.json();
  }
  throw new Error(`gave up on ${path}`);
}

/**
 * Code search caps any single query at 1000 results, so the search is
 * partitioned by file size. The ranges are arbitrary but exhaustive and
 * non-overlapping, which is what matters: every schema.prisma on GitHub falls
 * into exactly one of them.
 *
 * Size correlates with how developed a schema is, so the partitions are *not*
 * interchangeable. A run that stops early after walking them in order samples
 * only the smallest schemas on GitHub — which are the least likely to have had
 * anyone think about indexes, and would make the headline figure look far
 * worse than it is. `--limit` therefore fills each partition in turn rather
 * than taking the first N overall.
 */
const SIZE_PARTITIONS = [
  '<1000', '1000..2000', '2000..4000', '4000..8000',
  '8000..16000', '16000..32000', '>32000',
];

async function* searchSchemas() {
  const seen = new Set();

  // With a limit, take an equal share from each size partition so a small run
  // is a spread across schema sizes rather than a census of the tiniest ones.
  const perPartition = LIMIT === Infinity ? Infinity : Math.ceil(LIMIT / SIZE_PARTITIONS.length);

  for (const size of SIZE_PARTITIONS) {
    let yieldedHere = 0;

    for (let page = 1; page <= 10; page++) {
      if (yieldedHere >= perPartition) break;

      // The code search API requires a free-text term alongside qualifiers;
      // `model` appears in every schema that declares anything.
      const q = encodeURIComponent(`model filename:schema.prisma size:${size}`);
      const data = await api(`/search/code?q=${q}&per_page=100&page=${page}`);

      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (yieldedHere >= perPartition) break;

        // `filename:schema.prisma` is a prefix match, so it also returns
        // schema.prisma_old, schema.prisma.bak and similar. Those are
        // abandoned files; whatever they say about indexes is not what the
        // project ships.
        const name = item.path.split('/').pop() ?? '';
        if (name !== 'schema.prisma') continue;

        const key = `${item.repository.full_name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        yieldedHere++;
        yield { item, partition: size };
      }

      if (items.length < 100) break;
      // Code search allows 10 requests per minute.
      await sleep(6500);
    }
    console.error(`partition size:${size} done (${seen.size} repos so far)`);
  }
}

// ---------------------------------------------------------------------------
// Schema shape — the two checks that need the file, not the metadata
// ---------------------------------------------------------------------------

function countModels(schema) {
  return (schema.match(/^\s*model\s+\w+\s*\{/gm) ?? []).length;
}

function countRelations(schema) {
  return (schema.match(/@relation\s*\([^)]*fields:\s*\[/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

const included = [];
const excluded = [];
let candidatesChecked = 0;

function exclude(fullName, reason, detail = '') {
  excluded.push({ repo: fullName, reason, detail });
}

/**
 * One line per 20 candidates checked, whatever happened to them. Progress used
 * to print only when a schema was *included*, and the small-size partitions
 * reject nearly everything as stale or too small — several silent minutes that
 * look exactly like a hang.
 */
function progress(partition) {
  candidatesChecked++;
  if (candidatesChecked % 20 !== 0) return;
  console.error(
    `  [${partition}] checked ${candidatesChecked}  ` +
    `included ${included.length}  excluded ${excluded.length}`
  );
}

async function run() {
  mkdirSync(SCHEMA_DIR, { recursive: true });

  const repoCache = new Map();

  for await (const { item, partition } of searchSchemas()) {
    if (included.length >= LIMIT) break;
    progress(partition);

    const fullName = item.repository.full_name;
    const [owner, repo] = fullName.split('/');

    // Metadata first: the cheap rejections, before fetching any content.
    let meta = repoCache.get(fullName);
    if (!meta) {
      try {
        meta = await api(`/repos/${owner}/${repo}`);
      } catch (err) {
        exclude(fullName, 'metadata-fetch-failed', String(err.message));
        continue;
      }
      repoCache.set(fullName, meta);
    }

    if (meta.fork) {
      exclude(fullName, 'fork');
      continue;
    }

    if (meta.archived) {
      exclude(fullName, 'archived');
      continue;
    }

    const pushedAt = new Date(meta.pushed_at).getTime();
    if (Date.now() - pushedAt > MAX_AGE_MS) {
      exclude(fullName, 'stale', meta.pushed_at.slice(0, 10));
      continue;
    }

    const haystack = `${meta.name} ${meta.description ?? ''} ${(meta.topics ?? []).join(' ')}`;
    const templateHit = haystack.match(TEMPLATE_WORDS);
    if (meta.is_template || templateHit) {
      exclude(fullName, 'template', meta.is_template ? 'is_template' : templateHit[0]);
      continue;
    }

    // Content: fetch the blob at the exact SHA the search returned.
    let schema;
    try {
      const blob = await api(`/repos/${owner}/${repo}/git/blobs/${item.sha}`);
      schema = Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
    } catch (err) {
      exclude(fullName, 'blob-fetch-failed', String(err.message));
      continue;
    }

    const models = countModels(schema);
    if (models < MIN_MODELS) {
      exclude(fullName, 'too-few-models', String(models));
      continue;
    }

    const relations = countRelations(schema);
    if (relations < MIN_RELATIONS) {
      exclude(fullName, 'no-relations');
      continue;
    }

    const file = `${owner}__${repo}.prisma`;
    writeFileSync(join(SCHEMA_DIR, file), schema);

    included.push({
      repo: fullName,
      stars: meta.stargazers_count,
      pushedAt: meta.pushed_at.slice(0, 10),
      path: item.path,
      sha: item.sha,
      partition,
      models,
      relations,
      bytes: schema.length,
      file,
    });
  }

  writeTsv(
    join(STORY, 'data', 'corpus.tsv'),
    ['repo', 'stars', 'pushedAt', 'path', 'sha', 'partition', 'models', 'relations', 'bytes', 'file'],
    included,
  );
  writeTsv(
    join(STORY, 'data', 'excluded.tsv'),
    ['repo', 'reason', 'detail'],
    excluded,
  );

  const byReason = {};
  for (const row of excluded) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;

  console.error('');
  console.error(`included: ${included.length}`);
  console.error(`excluded: ${excluded.length}`);
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${reason.padEnd(22)} ${count}`);
  }
  console.error('');
  console.error(`schemas in ${SCHEMA_DIR}`);
  console.error('Next: node scripts/analyse-schemas.mjs');
}

function writeTsv(path, columns, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [columns.join('\t')];
  for (const row of rows) lines.push(columns.map(c => String(row[c] ?? '')).join('\t'));
  writeFileSync(path, lines.join('\n') + '\n');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
