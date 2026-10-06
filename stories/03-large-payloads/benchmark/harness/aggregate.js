/**
 * Every table in ../README.md, recomputed from ../results/*.json, with the
 * arithmetic checked. Nothing in the README is typed by hand.
 *
 *   node aggregate.js
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'results');
const load = l => JSON.parse(fs.readFileSync(path.join(R, `${l}.json`), 'utf8'));
const assert = (c, m) => { if (!c) throw new Error(`check failed: ${m}`); };
const f1 = x => x.toFixed(1);
const kb = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
const n = x => x.toLocaleString('en-US');

const local = load('local-socket');
const pg = load('pg-baseline');
const get = (r, size, s) => r.runs.find(x => x.size === size && x.strategy === s);
const sizes = [...new Set(local.runs.map(r => r.size))];

for (const run of local.runs) {
  assert(run.rows === (run.strategy === 'suggested' ? Math.min(100, run.size) : run.size), `row count ${run.size} ${run.strategy}`);
  for (const s of run.samples) assert(Math.abs(s.serverMs - (s.queryMs + s.serializeMs)) < 0.01, 'server = query + serialize');
}

console.log('## 1. Server and client, same machine\n');
console.log('| Users in the table | Strategy | Rows sent | Response | Gzipped | Query (Prisma) | Serialise (superjson) | Server total | Client parse |');
console.log('|---:|---|---:|---:|---:|---:|---:|---:|---:|');
for (const size of sizes) for (const s of ['as-found', 'suggested']) {
  const r = get(local, size, s);
  console.log(`| ${n(size)} | ${s} | ${n(r.rows)} | ${kb(r.bytes)} | ${kb(r.gzipBytes)} | ${f1(r.queryMs)}ms | ${f1(r.serializeMs)}ms | ${f1(r.serverMs)}ms | ${f1(r.parseMs)}ms |`);
}

console.log('\n## 2. Where the server time goes, as found\n');
console.log('| Users | PostgreSQL + node-pg | Prisma query (incl. row mapping) | superjson serialise | Server total |');
console.log('|---:|---:|---:|---:|---:|');
for (const size of sizes) {
  const r = get(local, size, 'as-found'), p = pg.runs.find(x => x.size === size);
  console.log(`| ${n(size)} | ${f1(p.queryMs)}ms | ${f1(r.queryMs)}ms | ${f1(r.serializeMs)}ms | ${f1(r.serverMs)}ms |`);
}

console.log('\n## 3. Database distance\n');
const labels = ['local-socket', 'proxied-2.8ms', 'proxied-4.9ms'].filter(l => fs.existsSync(path.join(R, `${l}.json`)));
console.log(`| Users | Strategy | ${labels.join(' | ')} |`);
console.log(`|---:|---|${labels.map(() => '---:').join('|')}|`);
for (const size of sizes) for (const s of ['as-found', 'suggested']) {
  console.log(`| ${n(size)} | ${s} | ${labels.map(l => `${f1(get(load(l), size, s).serverMs)}ms`).join(' | ')} |`);
}

console.log('\n## Ratios\n');
for (const size of sizes) {
  const a = get(local, size, 'as-found'), b = get(local, size, 'suggested');
  console.log(`- ${n(size)} users: server ${(a.serverMs / b.serverMs).toFixed(0)}x, bytes ${(a.bytes / b.bytes).toFixed(0)}x, client parse ${(a.parseMs / b.parseMs).toFixed(0)}x, bytes per row ${(a.bytes / a.rows).toFixed(0)}, heap growth ${f1(a.heapDeltaMB)} MB vs ${f1(b.heapDeltaMB)} MB`);
}
