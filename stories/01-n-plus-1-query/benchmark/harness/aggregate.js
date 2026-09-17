#!/usr/bin/env node
/**
 * Turn the raw benchmark JSON into the study's result tables, and verify the
 * arithmetic while doing it. Every ratio printed here is computed from the raw
 * medians rather than typed by hand.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || path.join(__dirname, '..', 'results');
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const CONDITIONS = [
  { file: 'local-socket.json', name: 'Unix socket (same machine)', rtt: 0.23 },
  { file: 'tcp-direct.json', name: 'TCP loopback', rtt: 0.17 },
  { file: 'proxied-2.7ms.json', name: 'Proxied, 2.7ms per query', rtt: 2.75 },
  { file: 'proxied-4.8ms.json', name: 'Proxied, 5.0ms per query', rtt: 5.04 },
];

const problems = [];
const check = (label, condition) => { if (!condition) problems.push(label); };

console.log('## Queries issued\n');
console.log('| Recipients | N+1 (sequential) | N+1 (parallel) | Batched |');
console.log('|---:|---:|---:|---:|');
{
  const d = load('local-socket.json');
  for (const size of [10, 100, 1000]) {
    const get = (s) => d.results.find((r) => r.size === size && r.strategy === s);
    const seq = get('n1-sequential'), par = get('n1-parallel'), bat = get('batched');
    console.log(`| ${size} | ${seq.queries} | ${par.queries} | ${bat.queries} |`);
    check(`sequential query count == N at size ${size}`, seq.queries === size);
    check(`parallel query count == N at size ${size}`, par.queries === size);
    check(`batched query count == 1 at size ${size}`, bat.queries === 1);
    check(`same recipients resolved at size ${size}`,
      seq.recipients === bat.recipients && par.recipients === bat.recipients);
  }
}

for (const cond of CONDITIONS) {
  const d = load(cond.file);
  console.log(`\n## ${cond.name} — median ms over ${d.environment.repeats} runs\n`);
  console.log('| Recipients | N+1 sequential | N+1 parallel | Batched | Sequential vs batched |');
  console.log('|---:|---:|---:|---:|---:|');
  for (const size of [10, 100, 1000]) {
    const get = (s) => d.results.find((r) => r.size === size && r.strategy === s);
    const seq = get('n1-sequential'), par = get('n1-parallel'), bat = get('batched');
    const ratio = (seq.medianMs / bat.medianMs);
    console.log(
      `| ${size} | ${seq.medianMs.toFixed(1)} | ${par.medianMs.toFixed(1)} | ` +
      `${bat.medianMs.toFixed(1)} | ${ratio.toFixed(1)}x |`
    );
    check(`${cond.name} size ${size}: batched no slower than sequential`, bat.medianMs <= seq.medianMs);
  }
}

console.log('\n## Concurrent jobs, 100 recipients each, 2.7ms per query\n');
{
  const d = load('concurrent-2.7ms.json');
  console.log('| Concurrent jobs | Strategy | Wall time (ms) | p95 per job (ms) | Queries issued |');
  console.log('|---:|---|---:|---:|---:|');
  for (const r of d.results) {
    console.log(`| ${r.concurrentJobs} | ${r.strategyLabel} | ${r.medianWallMs.toFixed(1)} | ${r.p95JobMs.toFixed(1)} | ${r.queriesIssued} |`);
    const expected = r.strategy === 'batched' ? r.concurrentJobs : r.concurrentJobs * r.recipients;
    check(`concurrent query count at ${r.concurrentJobs} jobs (${r.strategy})`, r.queriesIssued === expected);
  }
}

console.log('\n## Arithmetic check\n');
if (problems.length === 0) {
  console.log('All checks passed: query counts match N exactly, batched is always 1 per job,');
  console.log('every strategy resolves the same recipients, and no batched run is slower.');
} else {
  console.log('FAILED:');
  problems.forEach((p) => console.log('  - ' + p));
  process.exitCode = 1;
}
