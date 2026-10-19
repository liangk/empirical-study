#!/usr/bin/env node
/**
 * Rescan the kept source trees with a given core-engine build (Step 5 rounds).
 *
 * Usage:
 *   CORE_ENGINE=<dist/index.js> KEEP=<dir> node scripts/rescan.js <out.json> [--parallel N]
 *
 * KEEP holds one directory per usable repository (owner__name), checked out
 * at the commit in results/raw/_usable.json and pruned to what the walker
 * reads (JS/TS, .cjs, schema.prisma, package.json). Pruning drops no file the
 * walker would read, so a round scanned here is comparable to round 0;
 * `--check` verifies that against round 0's saved findings.
 *
 * ONLY=<regex> limits the scan to matching repositories, for a quick look at
 * a fix; its output is not a round.
 *
 * Run this in a cloud workspace, not on a laptop: it parses about 200,000
 * files. --parallel N forks N children, one repository at a time each.
 */
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const USABLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'results', 'raw', '_usable.json'), 'utf8'));
const slugOf = (repo) => repo.replace('/', '__');
const repos = USABLE.map((r) => r.repo).filter((r) => !process.env.ONLY || new RegExp(process.env.ONLY).test(r));

function scanShard(shard, of) {
  const ce = require(process.env.CORE_ENGINE);
  const registry = new ce.RuleRegistry();
  registry.registerAll(ce.blockingIoRules);
  const out = {};
  repos.forEach((repo, i) => {
    if (i % of !== shard) return;
    const dir = path.join(process.env.KEEP, slugOf(repo));
    if (!fs.existsSync(dir)) { out[repo] = { missing: true, findings: [] }; return; }
    const report = ce.analyzeDirectory({ targetPath: dir }, registry);
    out[repo] = {
      files: report.summary.filesScanned,
      findings: report.issues.map((x) => ({ rule: x.rule, file: x.file.replace(/\\/g, '/'), line: x.line, severity: x.severity, title: x.title })),
    };
  });
  return out;
}

if (process.argv[2] === '--child') {
  const [, , , shard, of] = process.argv;
  process.send(scanShard(Number(shard), Number(of)));
} else {
  const outFile = process.argv[2];
  const pi = process.argv.indexOf('--parallel');
  const n = pi > 0 ? Number(process.argv[pi + 1]) : 1;
  const parts = [];
  let done = 0;
  for (let s = 0; s < n; s++) {
    const child = fork(__filename, ['--child', s, n], { execArgv: ['--max-old-space-size=3072'] });
    child.on('message', (m) => { parts.push(m); });
    child.on('exit', (code) => {
      if (code) console.error(`shard ${s} exited ${code}`);
      if (++done === n) {
        const all = Object.assign({}, ...parts);
        const ordered = Object.fromEntries(repos.filter((r) => all[r]).map((r) => [r, all[r]]));
        fs.writeFileSync(outFile, JSON.stringify({ engine: process.env.CORE_ENGINE, scannedAt: new Date().toISOString(), repos: ordered }));
        const total = Object.values(ordered).reduce((a, r) => a + r.findings.length, 0);
        console.log(`${Object.keys(ordered).length} repositories, ${total} findings -> ${outFile}`);
      }
    });
  }
}
