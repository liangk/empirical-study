#!/usr/bin/env node
/**
 * What would change if core-engine's walker skipped test directories?
 *
 * Usage:
 *   node scripts/walker-impact.js
 *
 * Reads only results already on disk; nothing is cloned or rescanned. A
 * walker that skips a directory drops exactly the findings whose path is
 * under it, so filtering saved findings by path gives the same answer as a
 * rescan.
 *
 *   N+1            stories/01-n-plus-1-query/results/ (published 3 repositories,
 *                  baseline, held-out, expanded corpus)
 *   Missing Index  stories/02-missing-index/data/ (schema paths in corpus.tsv,
 *                  per-schema counts in results.tsv)
 *   Payload        stories/03-large-payloads/results/ (round 0 and final)
 *   Blocking I/O   this story's results/raw/ (core-engine round 0)
 *
 * Writes results/walker-impact.json and prints the tables.
 */
const fs = require('fs');
const path = require('path');

const STORIES = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'results', 'walker-impact.json');

// Candidate skip sets, narrowest first. B and C come from payload-rules.ts'
// NOT_SERVED_PATH, which the payload rules already apply on their own.
const VARIANTS = {
  A: { label: 'test/, tests/', re: /(^|\/)(test|tests)\// },
  B: { label: 'A + fixtures/, __fixtures__/, cypress/, integration-tests/', re: /(^|\/)(test|tests|fixtures|__fixtures__|cypress|integration-tests)\// },
  C: { label: 'B + vendor/, *.min.js', re: /(^|\/)(test|tests|fixtures|__fixtures__|cypress|integration-tests|vendor)\/|\.min\.[cm]?js$/ },
};
const norm = (p) => String(p).replace(/\\/g, '/');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const tsv = (p) => {
  const [h, ...rows] = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const cols = h.split('\t');
  return rows.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
};
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : '—');

/** For a list of { repo, file } findings: how many each variant drops, and from how many repositories. */
function impact(findings) {
  const out = { findings: findings.length, repos: new Set(findings.map((f) => f.repo)).size };
  for (const [k, v] of Object.entries(VARIANTS)) {
    const dropped = findings.filter((f) => v.re.test(norm(f.file)));
    const left = findings.filter((f) => !v.re.test(norm(f.file)));
    out[k] = {
      dropped: dropped.length,
      reposAffected: new Set(dropped.map((f) => f.repo)).size,
      reposLeftWithFindings: new Set(left.map((f) => f.repo)).size,
      examples: [...new Set(dropped.map((f) => `${f.repo}: ${norm(f.file)}`))].slice(0, 5),
    };
  }
  return out;
}

const report = {};

// ------------------------------------------------------------------ N+1 --
{
  const dir = path.join(STORIES, '01-n-plus-1-query', 'results');
  const sets = {
    'published (outline, cal.com, immich, after fixes)': fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)),
    baseline: fs.readdirSync(path.join(dir, 'baseline')).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, 'baseline', f)),
    'held-out': fs.readdirSync(path.join(dir, 'held-out')).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, 'held-out', f)),
    'expanded corpus': fs.readdirSync(path.join(dir, 'expanded-corpus')).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, 'expanded-corpus', f)),
  };
  report.n1 = {};
  for (const [name, files] of Object.entries(sets)) {
    const findings = [];
    for (const f of files) {
      const j = readJson(f);
      const repo = j.repository || path.basename(f, '.json');
      // Some outputs nest findings per file or under a different key.
      const list = j.findings || j.issues || [];
      for (const x of list) findings.push({ repo, file: x.file || x.filePath || '' });
    }
    report.n1[name] = impact(findings);
  }
}

// -------------------------------------------------------- Missing Index --
{
  const dir = path.join(STORIES, '02-missing-index', 'data');
  const corpus = tsv(path.join(dir, 'corpus.tsv'));
  const results = tsv(path.join(dir, 'results.tsv'));
  const pathOf = new Map(corpus.map((r) => [`${r.repo}@${r.sha}`, r.path]));
  const rows = results.map((r) => ({ ...r, file: pathOf.get(`${r.repo}@${r.sha}`) ?? '' }));
  const unmatched = rows.filter((r) => !r.file).length;
  const totals = (list) => {
    const fk = list.reduce((a, r) => a + Number(r.foreignKeys), 0);
    const un = list.reduce((a, r) => a + Number(r.foreignKeysUnindexed), 0);
    const withUn = list.filter((r) => Number(r.foreignKeysUnindexed) > 0).length;
    return { schemas: list.length, foreignKeys: fk, unindexed: un, unindexedPct: pct(un, fk), schemasWithUnindexed: withUn, schemasWithUnindexedPct: pct(withUn, list.length) };
  };
  report.missingIndex = { unmatchedPaths: unmatched, published: totals(rows) };
  for (const [k, v] of Object.entries(VARIANTS)) {
    const dropped = rows.filter((r) => v.re.test(norm(r.file)));
    report.missingIndex[k] = { droppedSchemas: dropped.length, droppedExamples: dropped.slice(0, 5).map((r) => `${r.repo}: ${r.file}`), after: totals(rows.filter((r) => !v.re.test(norm(r.file)))) };
  }
}

// -------------------------------------------------------------- Payload --
{
  const dir = path.join(STORIES, '03-large-payloads', 'results', 'rounds');
  report.payload = {};
  for (const round of ['round0', 'final']) {
    const p = path.join(dir, `${round}.json`);
    if (!fs.existsSync(p)) continue;
    const j = readJson(p);
    const findings = [];
    for (const [repo, list] of Object.entries(j)) for (const x of list) findings.push({ repo, file: x.file });
    report.payload[round] = impact(findings);
  }
}

// --------------------------------------------------------- Blocking I/O --
{
  const dir = path.join(__dirname, '..', 'results', 'raw');
  const findings = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const r = readJson(path.join(dir, f));
    if (r.error || !r.new) continue;
    const usable = r.pinned || (r.attempts || []).some((a) => a.missing === 0 && a.extra === 0);
    if (!usable) continue;
    for (const x of r.new.findings) findings.push({ repo: r.repo, file: x.file });
  }
  report.blockingIo = { 'core-engine round 0, 237 usable repositories': impact(findings) };
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.label])), ...report }, null, 2));

// ----------------------------------------------------------------- print --
console.log('Variants:');
for (const [k, v] of Object.entries(VARIANTS)) console.log(`  ${k}: ${v.label}`);
const table = (title, sets) => {
  console.log(`\n${title}`);
  for (const [name, s] of Object.entries(sets)) {
    console.log(`  ${name}: ${s.findings} findings in ${s.repos} repositories`);
    for (const k of Object.keys(VARIANTS)) {
      const v = s[k];
      console.log(`    ${k}: -${v.dropped} (${pct(v.dropped, s.findings)}), ${v.reposAffected} repositories affected, ${v.reposLeftWithFindings} still with a finding`);
    }
    const ex = s.C.examples;
    if (ex.length) console.log(`    e.g. ${ex.slice(0, 3).join(' | ')}`);
  }
};
table('N+1', report.n1);
console.log('\nMissing Index (published figures recomputed without the skipped schemas)');
const mi = report.missingIndex;
console.log(`  published: ${mi.published.schemas} schemas, ${mi.published.unindexed}/${mi.published.foreignKeys} FKs unindexed (${mi.published.unindexedPct}), ${mi.published.schemasWithUnindexedPct} of schemas have one${mi.unmatchedPaths ? ` [${mi.unmatchedPaths} rows with no path]` : ''}`);
for (const k of Object.keys(VARIANTS)) {
  const a = mi[k].after;
  console.log(`    ${k}: -${mi[k].droppedSchemas} schemas -> ${a.schemas} schemas, ${a.unindexedPct} FKs unindexed, ${a.schemasWithUnindexedPct} of schemas have one`);
}
if (mi.C.droppedExamples.length) console.log(`    e.g. ${mi.C.droppedExamples.slice(0, 3).join(' | ')}`);
table('Payload', report.payload);
table('Blocking I/O', report.blockingIo);
