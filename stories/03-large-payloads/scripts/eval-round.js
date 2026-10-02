#!/usr/bin/env node
/**
 * Score a rescan against the labelled sample.
 *
 * Usage: node scripts/eval-round.js results/rounds/<round>.json [sample.json labels.json]
 *
 * Defaults to Stage 1's eval/sample.json and eval/labels.json. With
 * eval/api-response-labels.json, pass `-` as the sample: that file is keyed
 * by repo|file|line and carries its own ids. Labels outside the rule being
 * scored (`not-builder`) are listed but left out of the precision.
 *
 * RULE=<id> counts only findings of that rule, for a rule that can share a
 * line with another (deep-include sits on the same call as unbounded-query).
 *
 * A labelled finding is "still reported" when the rescan has a finding at the
 * same repository, file and line, under either rule: round 2 stopped reporting
 * `return await x.findMany()` twice, so a finding can move from
 * unbounded-query to large-return without being lost.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
const [, , roundFile, sampleFile = 'eval/sample.json', labelsFile = 'eval/labels.json'] = process.argv;
const L0 = read(labelsFile);
let S, L;
if (sampleFile === '-') {
  S = []; L = {};
  for (const [k, [lab, note, id]] of Object.entries(L0)) {
    const [repo, file, line] = k.split('|');
    S.push({ id, repo, file, line: Number(line) }); L[id] = [lab, note];
  }
} else {
  S = read(sampleFile).sample; L = L0;
}
const R = JSON.parse(fs.readFileSync(roundFile, 'utf8'));

const key = (repo, file, line) => `${repo}\u0000${file}\u0000${line}`;
const live = new Set();
for (const [repo, fs_] of Object.entries(R)) {
  for (const f of fs_) if (!process.env.RULE || f.rule === process.env.RULE) live.add(key(repo, f.file, f.line));
}

const kept = {}, dropped = {}, lost = [];
const seen = new Set();
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
for (const s of S) {
  const loc = key(s.repo, s.file, s.line);
  const [lab, note] = L[s.id];
  if (live.has(loc)) {
    // Two labels on one line (both rules fired) count once once deduplicated.
    if (seen.has(loc)) continue;
    seen.add(loc); bump(kept, lab);
  } else {
    bump(dropped, lab);
    if (lab === 'tp') lost.push([s.id, s.repo, s.file, s.line, note]);
  }
}
const decided = Object.entries(kept).filter(([k]) => k !== 'unsure' && k !== 'not-builder').reduce((a, [, v]) => a + v, 0);
console.log('still reported:', kept);
console.log('no longer reported:', dropped);
if (decided) console.log(`sample precision among decided: ${kept.tp || 0}/${decided} = ${(100 * (kept.tp || 0) / decided).toFixed(1)}%`);
console.log('tp lost:', lost);
