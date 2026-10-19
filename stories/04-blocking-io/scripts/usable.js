#!/usr/bin/env node
/**
 * Write results/raw/_usable.json: the 237 usable repositories (pinned plus
 * findings-exact, as in summarize.js), the commit each was scanned at, and
 * core-engine round 0's findings (1.4.1 walker; eval-round.js applies the
 * 1.5.0 walker by path). keep-trees.js, rescan.js and eval-round.js read it.
 *
 * Usage: node scripts/usable.js
 */
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, '..', 'results', 'raw');
const same = (a) => a.missing === 0 && a.extra === 0;
const out = [];
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json') && !x.startsWith('_')).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (r.error) continue;
  const commit = r.pinned ? r.commit : r.attempts.find(same)?.commit;
  if (!commit) continue;
  out.push({
    repo: r.repo, commit, pinned: !!r.pinned, newFiles: r.new.files,
    findings: r.new.findings.map((x) => ({ rule: x.rule, file: x.file, line: x.line, severity: x.severity, title: x.title })),
  });
}
fs.writeFileSync(path.join(RAW, '_usable.json'), JSON.stringify(out));
console.log(`${out.length} repositories, ${out.reduce((a, r) => a + r.findings.length, 0)} round-0 findings`);
