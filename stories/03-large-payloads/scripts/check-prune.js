#!/usr/bin/env node
/**
 * Check that a rescan of the pruned trees equals the full-checkout scan.
 *
 * Usage: node scripts/check-prune.js <rescan with the round-0 build>.json
 *
 * Compares against results/raw/*.json (core-engine findings from the full
 * checkout, same build). Any mismatch means the pruning dropped a file a rule
 * needed, and no later round measured on the pruned trees can be trusted.
 */
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, '..', 'results', 'raw');
const R = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sig = xs => xs.map(x => [x.rule, x.file, x.line, x.title].join('\u0000')).sort().join('\n');

const files = fs.readdirSync(RAW).filter(f => f.endsWith('.json'));
let bad = 0;
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  const a = r.new.findings;
  const b = R[r.repo] || [];
  if (sig(a) !== sig(b)) { bad++; console.log('MISMATCH', r.repo, a.length, b.length); }
}
console.log('repositories checked:', files.length, 'mismatched:', bad);
process.exit(bad ? 1 : 0);
