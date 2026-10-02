#!/usr/bin/env node
/**
 * Rescan the kept source trees with a given core-engine build.
 *
 * Usage: CORE_ENGINE=<dist/index.js> KEEP=<dir> node scripts/rescan.js <out.json> [--parallel N]
 *
 * ONLY=<regex> limits the scan to matching repository slugs, for a quick check
 * of a fix before the full run; its output is not a round.
 *
 * Each round of rule changes is measured this way, against the same 283
 * repositories at the same commits, without cloning them again. See
 * scan-repo.js for why a pruned tree gives the same result as the full one;
 * scripts/check-prune.js verifies it.
 *
 * --parallel N splits the repositories across N child processes. Each
 * repository is still scanned whole by one process, so cross-file rules see
 * the same files either way.
 */
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, '..', 'results', 'raw');
const slugs = fs.readdirSync(RAW).filter(f => f.endsWith('.json')).sort().map(f => f.replace(/\.json$/, ''))
  .filter(s => !process.env.ONLY || new RegExp(process.env.ONLY).test(s));

function scanShard(shard, of) {
  const ce = require(process.env.CORE_ENGINE);
  const registry = new ce.RuleRegistry();
  registry.registerAll(ce.payloadRules);
  const out = {};
  slugs.forEach((slug, i) => {
    if (i % of !== shard) return;
    const raw = JSON.parse(fs.readFileSync(path.join(RAW, `${slug}.json`), 'utf8'));
    const dir = path.join(process.env.KEEP, slug);
    if (!fs.existsSync(dir)) { out[raw.repo] = []; return; }
    const report = ce.analyzeDirectory({ targetPath: dir }, registry);
    out[raw.repo] = report.issues.map(i => ({
      rule: i.rule, file: i.file, line: i.line, title: i.title, snippet: i.snippet,
      // api-response names the endpoint that sends the rows; keep it.
      ...(i.rule === 'payload/api-response' ? { description: i.description } : {}),
    }));
  });
  return out;
}

if (process.env.RESCAN_SHARD) {
  const [shard, of] = process.env.RESCAN_SHARD.split('/').map(Number);
  process.send(scanShard(shard, of));
} else {
  const outFile = process.argv[2];
  const pIdx = process.argv.indexOf('--parallel');
  const parallel = pIdx >= 0 ? Math.max(1, Number(process.argv[pIdx + 1])) : 1;

  Promise.all(Array.from({ length: parallel }, (_, shard) => new Promise((resolve, reject) => {
    const child = fork(__filename, [], { env: { ...process.env, RESCAN_SHARD: `${shard}/${parallel}` } });
    child.on('message', resolve);
    child.on('exit', code => { if (code) reject(new Error(`shard ${shard} exited ${code}`)); });
  }))).then(parts => {
    // Same key order as a single-process run.
    const merged = Object.assign({}, ...parts);
    const out = {};
    for (const key of Object.keys(merged).sort((a, b) => a.localeCompare(b))) out[key] = merged[key];
    fs.writeFileSync(outFile, JSON.stringify(out));
    const total = Object.values(out).reduce((a, x) => a + x.length, 0);
    console.log(`${total} findings in ${Object.values(out).filter(x => x.length).length} repositories`);
  });
}
