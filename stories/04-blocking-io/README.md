# Blocking I/O — Detector Study (Reproducible)

This folder is the lab notebook for recalibrating Code Evolution Lab's
Blocking I/O rules against the same 250 repositories Study 02 scanned in
February 2026, following the method of `stories/03-large-payloads/`: reproduce
the published numbers first, label before changing any rule, then fix and
check every fix against the labels.

## Stages

| Stage | Goal | Status |
|---|---|---|
| 1 | Reproduce Study 02 on its own corpus and commits, reconcile its numbers, and calibrate the four `blocking-io/*` rules core-engine already has | In progress. Steps 0–1 done 2026-10-08; Step 2 next |
| 2 | Bring core-engine's blocking I/O detection to full coverage (every pattern Study 02's scanner or the backend detector claims) and add a Blocking I/O solution generator | Not started |
| 3 | Publish the research report on stackinsight.dev | Not started |

## What is known going in

From `studies/02-blocking-io/results/` and the published article
(`astro-blog/src/content/blog/blocking-io-empirical-study.md`, 2026-02-14):

| | Value |
|---|---|
| Repositories in the scan output | 250 rows, 247 distinct |
| Listed twice (scanned and counted twice) | directus/directus, nock/nock, gethomepage/homepage |
| Rows with zero files scanned, still in the denominator | 5 (volta-cli/volta, nvm-sh/nvm, lucia-auth/lucia, socketio/engine.io, FiloSottile/mkcert) |
| Files scanned | 187,251 |
| Findings | 10,609 (three scans on 2026-02-13, identical totals) |
| Repositories with a finding | 191 (published as 76.4% = 191/250) |
| `unknown_path` context | 6,399 of 10,609 (60.3%) |
| `request_path` context | 716 (6.7%) |
| By type | file 9,608, child process 902, zlib 59, crypto 40 |
| By severity | critical 99, high 1,697, medium 5,468, low 3,345 |

Already visible before any rescan: the duplicate rows and the zero-file rows
both inflate the denominator, and the published "7% in request paths" rests on
a classifier that left 60% of findings unclassified.

# Stage 1 — Reproduce Study 02

## Step 0 — Recover the commits (done 2026-10-08)

Study 02 cloned with `--depth 1` into `studies/02-blocking-io/.repos/`, and
that directory is gone, so unlike Study 09 there is no recorded `HEAD`. The
first scan began at 2026-02-13T22:29:31Z (first finding id
`scan-1771021771639-1`), so each repository's candidate is the last commit on
its default branch's first-parent line committed before that time.

- `scripts/build-corpus.js` writes `data/corpus.tsv` from Study 02's scan
  output and `repo-samples.md`: 250 rows, 3 marked `duplicate_of`.
- `scripts/pin-commits.js` writes `data/study02-commits.tsv`: branch, candidate
  commit, commit date and commits since the cutoff, via blobless bare clones.
  First run 2026-10-06: 247 of 247 candidates. That run did not follow
  `--first-parent` and has to be redone (see below); the bare clones are
  cached, so the rerun is only `rev-list`.

A candidate becomes a pin only in Step 1, when Study 02's detector reproduces
that repository's findings exactly.

What the first trial showed (4 repositories, 2026-10-06):

- express, fastify and koa reproduce exactly at the candidate.
- nestjs/nest did not: 1,336 files against Study 02's 1,346, 2 findings off.
  The candidate was a side-branch commit dated 2026-02-13 that `rev-list
  --before` picked by date across all ancestors. The commit that reproduces
  1,346 files and all 9 findings is the mainline merge `a35a5ce7680b` of
  2026-02-08, five days before the scan. So Study 02's clones were reused
  across runs for days, and the cutoff is only an upper bound.

Hence `--first-parent` in `pin-commits.js`, and a neighbour search in
`scan-repo.js` (up to 10 distinct scan-relevant states either side of the
candidate, by default).

## Step 1 — Reproduce Study 02 exactly, then reconcile its numbers

`scripts/scan-repo.js` checks out the candidate and runs Study 02's own
`blocking-io-detector.ts` and `parser.ts`, compiled to CommonJS unchanged,
with Study 02's own file walker (`SKIP_DIRS`, extensions, 500 KB limit). The
repository is pinned when the file count and the multiset of file + line +
method match Study 02 exactly. Otherwise it tries neighbouring commits on the
first-parent line, nearest first, skipping any commit whose diff touches no
file the walker would scan. Every attempt is recorded. At the chosen commit it
also runs core-engine's four `blocking-io/*` rules with core-engine's walker
(round 0).

`scripts/scan-all.js` runs it over the 247 distinct repositories, resumable.
`scripts/summarize.js` writes `results/summary-step1.json`: how many pinned
and how, the ones that did not reproduce with their closest attempt, the
reconciliation of the published 10,609 (the duplicate rows alone account for
50: directus 18, homepage 19, nock 13), prevalence on pinned repositories with
and without the zero-file rows, and core-engine round 0 by rule, including how
often the same file and line is reported more than once.

Run Step 1 on the same Windows machine Study 02 ran on: symlinks and path
handling in a Windows checkout affect what the walker sees.

### Step 1 results (2026-10-08)

| | Repositories | Study 02 findings |
|---|---|---|
| Distinct repositories scanned | 247 | 10,559 |
| Pinned: file count and every finding match | 232 | 9,476 |
| Findings exact, file count off by 1–6 (500 KB limit, symlinks) | 5 | 582 |
| **Usable for everything below** | **237** | **10,058** |
| Superset: every Study 02 finding present, Study 02 saw far fewer files (ever-gauzy 783 vs 7,881; medusa 6,999 vs 8,967) | 2 | 204 |
| Not reproduced at any tried commit | 8 | 297 |

223 of the 232 pinned at the candidate itself; 9 at a neighbouring commit,
from the run before neighbour search was switched off (below). The 8 not
reproduced are adonisjs/core, lovell/sharp, NodeBB, prisma, requarks/wiki,
tj/commander.js, ToolJet and twenty.

The published total reconciles to the finding:

| | Findings |
|---|---|
| Study 02, published | 10,609 |
| Three repositories listed twice and counted twice (directus 18, homepage 19, nock 13) | −50 → 10,559 |
| Superset repositories | −204 → 10,355 |
| Not reproduced | −297 → **10,058** = the usable set |

Prevalence barely moves: 178 of 237 usable repositories have a finding
(75.1%), 76.7% of the 232 with any file, against the published 76.4% (191 of
250, with 5 zero-file rows and 3 duplicates in the denominator). Study 02's
detector also could not parse 951 of 159,635 files and skipped them silently.

**core-engine round 0 on the same 237 repositories and commits: 16,103
findings in 193 repositories**, 60% more than Study 02's 10,058:

| | Findings |
|---|---|
| Same file and line as a Study 02 finding | 9,440 |
| core-engine only | 6,663 |
| — under `test/` or `tests/`, which Study 02 skips and core-engine's walker does not | 5,178 |
| — under `vendor/`, `public/`, `static/`, `fixtures/` | 171 |
| — `randomBytes` and sync database methods, not in Study 02 | 361 |
| — same directories, other cause (not yet examined; Study 02's 951 unparsed files are one candidate) | 953 |
| Study 02 only (zlib, `randomFillSync`, `.cjs` among the causes) | 611 |

By rule: file 14,696, child process 905, crypto 456, database 46. 1,130
findings share a file and line with another finding: separate calls on one
line, almost all in minified files (babel's `Makefile.js` line 4 has 33
`existsSync` calls). Not double counting.

So the first thing core-engine's numbers say is the walker question the
payload story left open: 5,178 of its findings, a third, are in test
directories.

### What went wrong running it, and what changed

- **Neighbour search took the machine down (2026-10-08).** Each neighbour is
  a full depth-1 fetch and checkout; on the largest monorepos that was 10–22
  fetches each (ToolJet, twenty, webiny, n8n), two repositories at a time, and
  git's index-pack runs a thread per core with its own memory. The machine
  ran out of memory. Neighbour search is now off by default (`NEIGHBOURS=0`),
  git fetch is bounded (`pack.threads=1`, 256 MB windows), `scan-all.js` runs
  one repository at a time with a 4 GB heap cap per child and survives a
  crashed child, and `--retry-errors` reruns only failures.
- **Superset repositories do not search.** If every Study 02 finding is
  present at the candidate, another commit cannot fix it.
- **medusa** was investigated and not explained: not Windows path length
  (18 eligible files over 260 characters), not a stalled checkout (that would
  leave 962 files), and the 2025-01 commit whose file count matches is wrong
  (54 findings missing).

## Step 2 — How many Study 02 findings are a blocking call that matters

Stratified sample of Study 02's findings, labelled with one question first:
does this call run where it blocks other work (a request, a job, a listener),
or only at startup, in tooling or in a test? Pay particular attention to the
`unknown_path` 60%, since that is where the published 7% estimate came from.

## Step 3 — core-engine, round 0

core-engine 1.4.x's four rules as shipped: `sync-file-operation`,
`sync-crypto-operation`, `sync-child-process`, `sync-database-operation`.

The two open questions from 2026-10-06, answered from the source (2026-10-08):

- **No double counting.** All four rules share one `detect()`, but
  `engine.ts` deduplicates rule families by function identity and filters each
  family's output to the enabled rule ids, so each call is reported once.
- **No zlib.** core-engine has no zlib methods. Study 02 reported 59
  `sync_zlib_operation` findings; those are a Stage 2 item.

Where the three detectors differ, for Stage 2:

| | Study 02 | backend | core-engine |
|---|---|---|---|
| fs `*Sync` (28 methods) | yes | yes | yes |
| `pbkdf2Sync`, `scryptSync`, `generateKey(Pair)Sync` | yes | yes | yes |
| `randomFillSync` | yes | no | no |
| `randomBytes` without a callback | no | yes | yes, low severity |
| `createHash` / `createHmac` | no | yes | no (removed: no work at construction) |
| `execSync`, `execFileSync`, `spawnSync` | yes | yes | yes |
| zlib `*Sync` (9 methods) | yes | no | **no** |
| sync database methods (`querySync`, `runSync`, ...) | no | yes | yes |
| Context | 5 contexts by AST ancestry and path hints | in loop / in handler | in handler / server file / in loop |
| `.cjs` files | yes | — | **no** (`JS_PATTERNS` lacks it) |
| `test/`, `tests/`, `fixtures/` skipped | yes | — | no (only `__tests__`, `__mocks__`, `e2e`) |

The last row is the same engine-walker issue the payload story left as a
separate decision: changing the walker changes every detector's counts.

### The walker question, measured (2026-10-11)

core-engine's walker skips `__tests__/`, `e2e/` and `*.test.*`, but not
`test/`, `tests/` or fixtures. `scripts/walker-impact.js` measures what a
walker that skipped them would change, from saved findings only (a skipped
directory drops exactly the findings under it, so no rescan is needed).
Output: `results/walker-impact.json`.

| Variant | Skips |
|---|---|
| A | `test/`, `tests/` |
| B | A + `fixtures/`, `__fixtures__/`, `cypress/`, `integration-tests/` |
| C | B + `vendor/`, `*.min.js` |

| | Findings | A | B | C |
|---|---|---|---|---|
| N+1, published (outline, cal.com, immich) | 42 | 0 | 0 | 0 |
| N+1, baseline / held-out / expanded corpus | 78 / 23 / 148 | 0 | 0 | 0 |
| Missing Index, published (2,890 schemas, 38.4% of FKs unindexed) | — | 0 schemas | 0 | 0 |
| Payload, round 0 | 3,584 | −1,128 | −1,136 | −1,140 |
| Payload, final (published) | 923 | 0 | 0 | 0 |
| **Blocking I/O, round 0** | **16,103** | **−5,178** | **−5,242** | **−5,360** |

No published figure changes under any variant. The reasons differ, and they
matter for what the change does to users:

- **N+1**: every published scan was scoped to server-code directories, so test
  directories were never in it. A user running the CLI on a whole repository
  would see different counts; that is not measured here.
- **Missing Index**: the corpus is `schema.prisma` files from code search, and
  none sits under these directories.
- **Payload**: the payload rules already skip these paths themselves
  (`NOT_SERVED_PATH`), so the final rules are unaffected; round 0, before that
  skip existed, loses a third.
- **Blocking I/O** has no such rule-level skip, and loses a third.

`vendor/` is not safe at walker level: it is a domain word in marketplace
applications (a `vendor/` module of routes), not only third-party code. B is
the variant that skips only directories that are unambiguously tests.

**Decided 2026-10-12: variant B goes into core-engine's walker** (1.5.0,
`packages/core-engine/src/engine.ts`, with tests and a changelog entry). From
here on, round 0 means core-engine with the 1.5.0 walker. `summarize.js`
applies it by path to the 1.4.1 scans (`WALKER=1.4.1` for the old numbers):

| | 1.4.1 walker | 1.5.0 walker |
|---|---|---|
| core-engine findings | 16,103 in 193 repositories | **10,861 in 184** |
| Same file and line as a Study 02 finding | 9,440 | 9,390 |
| core-engine only | 6,663 | 1,471 (953 not yet explained, 361 `randomBytes` and database, 157 in `vendor/`, `public/`, `static/`) |
| Study 02 only | 611 | 661 (+50 under `__fixtures__/`, `cypress/`, `integration-tests/`, which Study 02 scanned) |

## Step 4 — Label, before changing any rule

`eval/criteria.md` written 2026-10-08, while the Step 1 scan was running and
before any of its findings were read. Samples and labels go in `eval/`.

## Step 5 — Fix, and check every fix against the labels

Rounds in `results/rounds/`, scored with an `eval-round.js` like the payload
story's.

## Reproduce

PowerShell, from `empirical-study/`:

```powershell
# once: Study 02's detector as CommonJS, and a built core-engine
cd studies\02-blocking-io; npm install
npx tsc src/step1-repo-scan/detector/parser.ts src/step1-repo-scan/detector/blocking-io-detector.ts src/step1-repo-scan/detector/types.ts --outDir node_modules/.old-js --module commonjs --target es2020 --esModuleInterop --skipLibCheck
cd ..\..\stories\04-blocking-io

$env:OLD_JS = (Resolve-Path ..\..\studies\02-blocking-io\node_modules\.old-js).Path
$env:CORE_ENGINE = "C:\Users\liang\Projects\github\code-evolution-lab\packages\core-engine\dist\index.js"
$env:WORK = "$env:TEMP\b02-work"
$env:PIN_WORK = "$env:TEMP\b02-pin"

node scripts\build-corpus.js                  # data/corpus.tsv
node scripts\pin-commits.js --parallel 4      # data/study02-commits.tsv
node scripts\scan-all.js --parallel 4         # results/raw/*.json
node scripts\summarize.js                     # results/summary-step1.json
```
