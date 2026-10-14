#!/usr/bin/env node
/**
 * Step 2 / Step 4: fetch the source around every location in
 * eval/to-label.json, so labelling reads the code at the scanned commit and
 * can be redone later from the same text.
 *
 * Usage:
 *   node scripts/fetch-context.js [--only S|C] [--limit N]
 *
 * For each item, writes eval/context/<id>.txt: a header (repository, commit,
 * file, line, method, Study 02's context), the nearest enclosing-scope lines
 * above the window (function, handler, class, export), and 15 lines either
 * side with the reported line marked ">>". Files are fetched from
 * raw.githubusercontent.com at the pinned commit and cached in
 * eval/context/.cache/ (both gitignored: third-party source).
 *
 * Resumable: an item whose context file exists is skipped.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const EVAL = path.join(ROOT, 'eval');
const OUT = path.join(EVAL, 'context');
const CACHE = path.join(OUT, '.cache');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only');
const limit = Number(opt('--limit') || Infinity);
const WINDOW = 15;

const SCOPE = /\bfunction\b|=>\s*\{?\s*$|\b(app|router|server|fastify|route)\.(get|post|put|patch|delete|use|all|route|register|on)\s*\(|^\s*(export\s+)?(default\s+)?(async\s+)?class\b|\bconstructor\s*\(|module\.exports|^\s*export\b|^\s*(async\s+)?[\w$]+\s*\([^)]*\)\s*\{\s*$|\.on\(|setInterval|setTimeout|addEventListener/;

const studyCtx = new Map(JSON.parse(fs.readFileSync(path.join(EVAL, 'study02-sample.json'), 'utf8')).findings.map((f) => [f.id, f]));
const items = JSON.parse(fs.readFileSync(path.join(EVAL, 'to-label.json'), 'utf8')).items
  .filter((x) => !only || x.samples.some((s) => s[0] === only))
  .slice(0, limit);

// curl, not https.get: curl honours HTTPS_PROXY, which some environments need.
const { execFile } = require('child_process');
function get(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sS', '-f', '-L', '--max-time', '60', url], { maxBuffer: 1 << 28 }, (err, stdout) => {
      if (err) reject(new Error(String(err.message).split('\n')[0])); else resolve(stdout);
    });
  });
}

async function source(item) {
  const key = `${item.repo}@${item.commit}/${item.file}`.replace(/[\\/:]/g, '__');
  const p = path.join(CACHE, key);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  const url = `https://raw.githubusercontent.com/${item.repo}/${item.commit}/${item.file.split('/').map(encodeURIComponent).join('/')}`;
  const text = await get(url);
  fs.writeFileSync(p, text);
  return text;
}

function render(item, text) {
  const lines = text.split(/\r?\n/);
  const at = item.line - 1;
  const from = Math.max(0, at - WINDOW);
  const to = Math.min(lines.length, at + WINDOW + 1);
  const scope = [];
  for (let i = from - 1; i >= 0 && scope.length < 6; i--) if (SCOPE.test(lines[i]) && lines[i].length < 300) scope.unshift(i);
  const fmt = (i, mark) => `${mark} ${String(i + 1).padStart(5)} | ${lines[i].length > 240 ? lines[i].slice(0, 240) + ' …[truncated]' : lines[i]}`;
  const s02 = item.samples.map((s) => studyCtx.get(s)).find(Boolean);
  const head = [
    `id:       ${item.id}  (samples: ${item.samples.join(', ')})`,
    `repo:     ${item.repo} @ ${item.commit.slice(0, 12)}`,
    `file:     ${item.file}:${item.line}`,
    `method:   ${item.method}`,
    s02 ? `study02:  ${s02.stratum} / ${s02.contextDetail}` : 'study02:  (not a Study 02 finding)',
    `url:      ${item.url}`,
    `lines in file: ${lines.length}`,
    '',
  ];
  const body = [];
  if (scope.length) { body.push('-- enclosing scope (nearest above the window) --'); scope.forEach((i) => body.push(fmt(i, ' '))); body.push('-- window --'); }
  for (let i = from; i < to; i++) body.push(fmt(i, i === at ? '>>' : '  '));
  return head.concat(body).join('\n') + '\n';
}

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  let done = 0, skipped = 0, failed = 0;
  const have = (x) => {
  const p = path.join(OUT, `${x.id}.txt`);
  // An earlier version wrote a placeholder on failure; treat it as missing.
  return fs.existsSync(p) && !fs.readFileSync(p, 'utf8').includes('FETCH FAILED');
};
const queue = items.filter((x) => !have(x));
  skipped = items.length - queue.length;
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const item = queue[next++];
      try {
        const text = await source(item);
        fs.writeFileSync(path.join(OUT, `${item.id}.txt`), render(item, text));
        done++;
      } catch (e) {
        failed++;
        console.log(`${item.id}\tFAILED ${e.message}\t${item.url}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`fetched ${done}, already present ${skipped}, failed ${failed}`);
})();
