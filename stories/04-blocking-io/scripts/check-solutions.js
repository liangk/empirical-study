#!/usr/bin/env node
/**
 * Check the blocking-io solution generator on the corpus (Stage 2, item 4).
 *
 * Usage: CORE_ENGINE=<dist/index.js> KEEP=<dir> node scripts/check-solutions.js <out.json>
 *
 * For every blocking-io finding in the kept trees, ask the generator for a
 * suggestion. Paste it over the call in a copy of the file, then check:
 *
 *   - the file still parses;
 *   - the finding is gone: the file has one fewer finding with that title.
 *
 * This is the Missing Index standard the payload generator was held to.
 * Refactor notes (`blocking-io-refactor`: make the function async, await it
 * at its callers) are counted but not applied; they are advice, not code.
 * ONLY=<regex> limits it to matching repositories. Run it in a cloud
 * workspace, like rescan.js.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ce = require(process.env.CORE_ENGINE);
const parser = require(require.resolve('@babel/parser', { paths: [path.dirname(process.env.CORE_ENGINE)] }));
const ROOT = path.join(__dirname, '..');
const usable = JSON.parse(fs.readFileSync(path.join(ROOT, 'results', 'raw', '_usable.json'), 'utf8'))
  .filter((r) => !process.env.ONLY || new RegExp(process.env.ONLY).test(r.repo));

const registry = new ce.RuleRegistry();
registry.registerAll(ce.blockingIoRules);

function scanOne(file, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sol-'));
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  const issues = ce.analyzeDirectory({ targetPath: dir }, registry).issues;
  fs.rmSync(dir, { recursive: true, force: true });
  return issues;
}

function offsetOf(content, line, column) {
  let at = 0;
  for (let l = 1; l < line; l++) at = content.indexOf('\n', at) + 1;
  return at + column;
}

(async () => {
  const totals = { findings: 0, withCodeBefore: 0, withSuggestion: 0, gone: 0, still: 0, parseErrors: 0, misplaced: 0 };
  const byRule = {};
  const failures = [];
  for (const r of usable) {
    const dir = path.join(process.env.KEEP, r.repo.replace('/', '__'));
    if (!fs.existsSync(dir)) continue;
    const issues = ce.analyzeDirectory({ targetPath: dir }, registry).issues;
    for (const issue of issues) {
      totals.findings++;
      const b = (byRule[issue.rule] ||= { findings: 0, awaitable: 0, suggested: 0, gone: 0 });
      b.findings++;
      if (!issue.codeBefore) {
        // A refactor note is advice, not a replacement: counted, never applied.
        if (issue.recommendation?.startsWith('Refactor, not a drop-in fix:')) { totals.refactorNotes = (totals.refactorNotes || 0) + 1; b.refactor = (b.refactor || 0) + 1; }
        continue;
      }
      totals.withCodeBefore++; b.awaitable++;
      const [sol] = await ce.generateSolutionsFor(issue);
      if (!sol || sol.type !== 'blocking-io-async') continue;
      totals.withSuggestion++; b.suggested++;
      const content = fs.readFileSync(path.join(dir, issue.file), 'utf8');
      const at = offsetOf(content, issue.line, issue.column ?? 0);
      if (content.slice(at, at + issue.codeBefore.length) !== issue.codeBefore) { totals.misplaced++; failures.push({ repo: r.repo, file: issue.file, line: issue.line, why: 'misplaced' }); continue; }
      const after = content.slice(0, at) + sol.code + content.slice(at + issue.codeBefore.length);
      // A file this parser cannot read as it stands (Flow types, import
      // assertions) says nothing about the suggestion: count it apart.
      try {
        parser.parse(content, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] });
      } catch {
        totals.originalUnparseable = (totals.originalUnparseable || 0) + 1; continue;
      }
      try {
        parser.parse(after, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] });
      } catch (e) {
        totals.parseErrors++; failures.push({ repo: r.repo, file: issue.file, line: issue.line, why: `parse: ${e.message}` }); continue;
      }
      const count = (list) => list.filter((i) => i.title === issue.title).length;
      const before = count(scanOne(issue.file, content));
      const left = count(scanOne(issue.file, after));
      if (left === before - 1) { totals.gone++; b.gone++; } else { totals.still++; failures.push({ repo: r.repo, file: issue.file, line: issue.line, why: `still reported (${before} -> ${left})` }); }
    }
    process.stderr.write(`${r.repo}\n`);
  }
  const out = { engine: process.env.CORE_ENGINE, checkedAt: new Date().toISOString(), totals, byRule, failures };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
  console.log(totals);
  console.log(byRule);
})();
