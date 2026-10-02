#!/usr/bin/env node
/**
 * Apply the payload solution generator to every row-limit finding of a round
 * and check the Missing Index standard on real code: paste the suggestion over
 * the query, scan the file again, and the finding at that line is gone.
 *
 * Usage: CORE_ENGINE=<dist/index.js> KEEP=<dir> node scripts/check-solutions.js <round.json> [out.json]
 *
 * Per file, not per repository: the cross-file pass only renames a finding
 * (large-return -> api-response), and whether the query is bounded is decided
 * in the file that holds it.
 */
const fs = require('fs');
const path = require('path');
const parser = require(path.join(path.dirname(process.env.CORE_ENGINE), '..', 'node_modules', '@babel', 'parser'));
const ce = require(process.env.CORE_ENGINE);

const ROW = new Set(['payload/unbounded-query', 'payload/large-return', 'payload/api-response', 'payload/unbounded-graphql']);
const rule = ce.payloadRules.find(r => r.id === 'payload/unbounded-query');
const round = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const gen = new ce.PayloadSolutionGenerator();

const parse = code => parser.parse(code, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'], errorRecovery: true });
const detect = (file, code) => rule.detect(file, code, parse(code)).filter(i => ROW.has(i.rule));

(async () => {
  const out = { findings: 0, withSolution: 0, removed: 0, notRemoved: [], noSolution: {}, parseErrors: [] };
  for (const [repo, findings] of Object.entries(round)) {
    const byFile = new Map();
    for (const f of findings) if (ROW.has(f.rule)) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
    for (const [file, fs_] of byFile) {
      const abs = path.join(process.env.KEEP, repo.replace('/', '__'), file);
      let code;
      try { code = fs.readFileSync(abs, 'utf8'); } catch { continue; }
      const issues = detect(file, code);
      for (const f of fs_) {
        out.findings++;
        const issue = issues.find(i => i.line === f.line);
        if (!issue) { out.noSolution['not reproduced per file'] = (out.noSolution['not reproduced per file'] ?? 0) + 1; continue; }
        const [solution] = await gen.generateSolutions(issue, {});
        if (!solution) {
          const m = /^(?:Returning unbounded )?([\w$]+\(|knex|createQueryBuilder|selectFrom)/.exec(issue.title)?.[1] ?? 'other';
          const key = (issue.codeBefore ?? '').match(/\.(\w+)\s*(?:<[^>]*>)?\s*\([^()]*\)?\s*$/)?.[1] ?? m;
          out.noSolution[key] = (out.noSolution[key] ?? 0) + 1;
          continue;
        }
        out.withSolution++;
        // Replace the occurrence that starts on the finding's line.
        const lineStart = code.split('\n').slice(0, issue.line - 1).join('\n').length;
        const at = code.indexOf(issue.codeBefore, Math.max(0, lineStart - issue.codeBefore.length));
        if (at < 0) { out.notRemoved.push({ repo, file, line: f.line, why: 'codeBefore not found' }); continue; }
        const fixed = code.slice(0, at) + solution.code + code.slice(at + issue.codeBefore.length);
        try { parser.parse(fixed, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] }); }
        catch (e) {
          // Some files only parse with error recovery to begin with.
          try { parser.parse(code, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] }); out.parseErrors.push({ repo, file, line: f.line }); continue; } catch { /* original did not parse strictly either */ }
        }
        const again = detect(file, fixed).filter(i => i.line === issue.line && i.rule === issue.rule);
        if (again.length === 0) out.removed++;
        else out.notRemoved.push({ repo, file, line: f.line, before: issue.codeBefore.slice(0, 120), after: solution.code.slice(0, 140) });
      }
    }
  }
  const text = JSON.stringify(out, null, 1);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], text);
  console.log(JSON.stringify({ findings: out.findings, withSolution: out.withSolution, removed: out.removed, notRemoved: out.notRemoved.length, parseErrors: out.parseErrors.length, noSolution: out.noSolution }, null, 1));
})();
