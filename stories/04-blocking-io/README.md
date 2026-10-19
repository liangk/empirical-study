# Blocking I/O — Detector Study (Reproducible)

This folder is the lab notebook for recalibrating Code Evolution Lab's
Blocking I/O rules against the same 250 repositories Study 02 scanned in
February 2026, following the method of `stories/03-large-payloads/`: reproduce
the published numbers first, label before changing any rule, then fix and
check every fix against the labels.

## Stages

| Stage | Goal | Status |
|---|---|---|
| 1 | Reproduce Study 02 on its own corpus and commits, reconcile its numbers, and calibrate the four `blocking-io/*` rules core-engine already has | Done 2026-10-19 (Steps 0–5; rounds 1–2) |
| 2 | Bring core-engine's blocking I/O detection to full coverage (every pattern Study 02's scanner or the backend detector claims) and add a Blocking I/O solution generator | Done 2026-10-19 (items 1–4) |
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

Samples drawn 2026-10-12 by `scripts/sample.js` (seed 20261012), from the 237
usable repositories, under `eval/criteria.md`. Allocation is not
proportional: each stratum gets a floor so small strata can be estimated, and
estimates are weighted back by stratum size.

| Study 02 `context` | Population | Sampled | Weight |
|---|---|---|---|
| `unknown_path` | 6,033 | 160 | 37.7 |
| `tooling_path` | 1,972 | 70 | 28.2 |
| `startup_path` | 1,281 | 70 | 18.3 |
| `request_path` | 633 | 70 | 9.0 |
| `background_path` | 139 | 30 | 4.6 |
| **Total** | **10,058** | **400** | |

| core-engine severity (1.5.0 walker) | Population | Sampled | Weight |
|---|---|---|---|
| critical | 39 | 39 | 1.0 |
| high | 167 | 80 | 2.1 |
| medium | 3,008 | 140 | 21.5 |
| low | 7,647 | 141 | 54.2 |
| **Total** | **10,861** | **400** | |

A location both detectors report is labelled once: `eval/to-label.json` holds
772 distinct locations (22 drawn into both samples), each with a permalink to
the line at its commit. 374 of the 400 Study 02 items are also core-engine
findings, and 311 of the 400 core-engine items are also Study 02 findings.

### Step 2 results: first labelling pass (2026-10-12)

All 400 Study 02 sample items (398 distinct locations) labelled by Claude
from the source at the scanned commit, under `eval/criteria.md`, one line of
reason per label in `eval/labels.tsv`. Source excerpts come from
`scripts/fetch-context.js` (`eval/context/`, gitignored). Estimates from
`scripts/estimate.js` (`results/estimate-study02.json`). **Not yet reviewed
by a second reader**: the 31 `tp` and 18 `unsure` labels in particular need
a check before any number is published.

| Study 02 `context` | N | n | tp | fp-startup | fp-once | fp-tooling | fp-not-blocking | unsure | tp rate | est. tp | context agrees |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `unknown_path` | 6,033 | 160 | 8 | 6 | 1 | 133 | 2 | 10 | 5.0% | 302 | — |
| `tooling_path` | 1,972 | 70 | 0 | 0 | 0 | 70 | 0 | 0 | 0.0% | 0 | 70/70 |
| `startup_path` | 1,281 | 70 | 2 | 5 | 2 | 58 | 1 | 2 | 2.9% | 37 | 7/70 |
| `request_path` | 633 | 70 | 19 | 10 | 1 | 33 | 1 | 6 | 27.1% | 172 | 19/70 |
| `background_path` | 139 | 30 | 2 | 1 | 0 | 27 | 0 | 0 | 6.7% | 9 | 2/30 |

**Estimated Study 02 findings that block concurrent work: about 519 of
10,058 (5.2%), 95% CI 303–736; 987 if every `unsure` is `tp`.**

What this says about the published "about 7% in request paths":

- The share is close (5.2% against 6.8%), but it is not the same findings.
  Of the 633 `request_path` findings, an estimated 27% block anything; the
  rest are CLIs, tests and startup code whose file paths look like routes or
  controllers. More of the real ones, an estimated 302, sit in
  `unknown_path`, which the article could not count.
- `tooling_path` is the classifier's one reliable bucket (70 of 70).
  `startup_path` is mostly tooling as well (58 of 70), not startup.
- About four in five findings in every stratum except `request_path` are
  tooling: CLIs, build and release scripts, codemods, generators, tests.
  Study 02 skips test directories but not `*.test.*` and `*.spec.*` files,
  nor `e2e-tests/` or `__fixtures__/`.
- The real ones cluster: Countly's data-migration plugin and dashboard
  routes, pdfkit's synchronous deflate and image reads, Electron apps'
  filesystem helpers, Next.js's PBKDF2 in `decryptWithSecret`, Redwood's job
  loader.

### Step 2 results: second pass, entry point rule (2026-10-13)

`eval/criteria.md` gained the entry point rule (amendment 2026-10-13) before
any label was revisited: every label names an entry point, callers are traced
with `git grep` up to two levels at the scanned commit, and library code its
own repository never calls from an entry point is `unsure`. 186 labels whose
file path is its own entry point (`scripts/`, `bin/`, `*.test.*`, codemods,
CLI command modules) were kept and marked "entry: path". The other 212 were
traced in depth-1 checkouts of the 69 repositories involved (in the cloud
workspace, not on the local machine). Every chain is in `eval/labels.tsv`;
the before/after for each is in `eval/relabel-2026-10-13.tsv`.

16 of the 212 changed:

| Change | Count | Examples |
|---|---|---|
| tp -> unsure | 4 | typeorm FileLogger, pdfkit deflate and image reads (x3): library APIs whose own repos reach them only from tests and examples |
| tp -> fp-startup | 1 | Reaction's sample-data image loader runs from the plugin's `startup` hook, not a mutation as first assumed |
| unsure -> tp | 1 | Directus `requireText`: called inside the AI system-prompt tool handler on every call |
| unsure -> fp-startup | 2 | n8n event-bus recovery check (in `initialize()` at start), Habitica `buildManifest` (module top level) |
| unsure -> fp-tooling | 2 | Next.js debug logger (defined only with `NEXT_DEBUG_IMMEDIATES=1`), encryption key cache (dev server and build) |
| fp-tooling -> unsure | 3 | shelljs `touch`, shelljs `grep`, nock recorder: libraries, by the same rule |
| fp-startup -> fp-tooling | 2 | Fastify `examples/https.js`; Blitz `readBlitzConfig`, called only by the CLI |
| fp-startup -> unsure | 1 | VS Code git extension `dispose()`, too generic to trace |

| Study 02 `context` | N | n | tp | fp-startup | fp-once | fp-tooling | fp-not-blocking | unsure | tp rate | est. tp |
|---|---|---|---|---|---|---|---|---|---|---|
| `unknown_path` | 6,033 | 160 | 3 | 6 | 1 | 132 | 2 | 16 | 1.9% | 113 |
| `tooling_path` | 1,972 | 70 | 0 | 0 | 0 | 70 | 0 | 0 | 0.0% | 0 |
| `startup_path` | 1,281 | 70 | 2 | 4 | 2 | 59 | 1 | 2 | 2.9% | 37 |
| `request_path` | 633 | 70 | 20 | 11 | 1 | 35 | 1 | 2 | 28.6% | 181 |
| `background_path` | 139 | 30 | 2 | 1 | 0 | 26 | 0 | 1 | 6.7% | 9 |

| | First pass | Entry point rule |
|---|---|---|
| tp labels | 31 | 27 |
| unsure labels | 18 | 21 |
| Estimated findings that block concurrent work | 519 (5.2%), 95% CI 303–736 | **340 (3.4%), 95% CI 191–489** |
| Upper bound, every unsure as tp | 987 | 1,002 |

The estimate falls by a third, almost all of it in `unknown_path`, where each
labelled item weighs 37.7: five of its eight first-pass `tp` were inferences
about libraries or a misread startup hook. The upper bound barely moves,
because those items became `unsure` rather than disappearing; what the rule
changes is how much of the estimate rests on evidence. The `request_path`
figure is the steadiest (19 to 20 tp).

`results/estimate-study02-pass1.json` keeps the first-pass estimate;
`results/estimate-study02.json` is the current one.

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

### core-engine sample, labelled (2026-10-14)

Figures in this section are as labelled on 2026-10-14. The current figures,
after the blind second labeller and the 2026-10-19 rule decisions, are in the
next section.

The 400 core-engine items (396 locations; 22 shared with the Study 02 sample
keep that label) labelled under the entry point rule from the start, from
depth-1 checkouts at the pinned commits, with callers traced by grep.
`node scripts/estimate.js --core` writes `results/estimate-core-engine.json`.
The `tp` and `unsure` labels are in `eval/review-core-tp-unsure.md`.

| Severity | N | n | tp | fp-startup | fp-once | fp-tooling | fp-not-blocking | unsure | tp rate | Est. tp |
|---|---|---|---|---|---|---|---|---|---|---|
| critical | 39 | 39 | 9 | 1 | 3 | 6 | 19 | 1 | 23.1% | 9 |
| high | 167 | 80 | 6 | 14 | 0 | 60 | 0 | 0 | 7.5% | 13 |
| medium | 3,008 | 140 | 6 | 9 | 1 | 117 | 2 | 5 | 4.3% | 129 |
| low | 7,647 | 141 | 8 | 5 | 1 | 121 | 2 | 4 | 5.7% | 434 |

**Estimated core-engine round-0 findings that block concurrent work: 584 of
10,861 (5.4%), 95% CI 279–890; 910 if every unsure is tp.** Study 02's figure
under the same rule is 340 of 10,058 (3.4%). The intervals overlap; the two
detectors find about the same number of real problems inside about the same
amount of noise.

By rule (sample counts, unweighted):

| Rule | n | tp | fp-tooling | fp-startup / once | fp-not-blocking | unsure |
|---|---|---|---|---|---|---|
| `sync-file-operation` | 303 | 17 | 247 | 26 | 4 | 9 |
| `sync-child-process` | 54 | 0 | 51 | 3 | 0 | 0 |
| `sync-database-operation` | 36 | 6 | 6 | 4 | 19 | 1 |
| `sync-crypto-operation` | 7 | 6 | 0 | 1 | 0 | 0 |

What this says for Step 5, before any rule is touched:

- **Severity does not rank anything.** high, medium and low have tp rates of
  7.5%, 4.3% and 5.7%. critical is higher only because of isolated-vm (below).
  The severity tiers are not a usable signal as shipped.
- **Tooling is the noise.** 285 of 400 are `fp-tooling`: vendored yarn
  bundles (29 items in `vendor/` and `.yarn/releases/`), `scripts/`, `bin/`,
  CLI packages, compiled build tools, dev servers. Path-level exclusion would
  remove most of it without touching a single `tp`.
- **`sync-database-operation` matches names, not calls.** 19 of its 36 are
  user-defined methods that happen to be called `runSync` or `getSync`
  (sequelize hooks, directus's in-memory store, liquidjs scope lookup, async
  HTTP calls in bitwarden, an async LDAP sync in n8n). Its 6 `tp` are
  isolated-vm `runSync` in Budibase, which does block, but runs a script, not
  a database query.
- **`sync-child-process` found nothing that matters.** 0 of 54; every one is
  a CLI, a script or a startup check.
- **`sync-crypto-operation` is the best rule.** 6 of 7 `tp`: `scryptSync` and
  `randomBytes` in auth handlers (Redwood dbAuth, hackathon-starter, Outline
  passkeys, webiny), `generateKeyPairSync` behind an n8n REST route.
- **Criteria gaps found:** a sync write in a dedicated `worker_threads`
  log writer (n8n, L750) and a serverless handler (webiny, L769). L750 is
  `unsure`; L769 is `tp` as a request handler. Neither moves the estimate
  much, but the criteria should say which way they go.

### Blind second labeller and the 2026-10-19 revision

To check the labels without grading my own work, a second labeller relabelled
144 locations blind. The set was every `tp` and `unsure` location (84) plus
60 drawn at random from the rest. The labeller saw the code and the criteria
only: no labels, notes, Study 02 context or severity. Details and all 26
disagreements are in `eval/blind-relabel-2026-10-19.md`; its labels are in
`eval/second-labeller-2026-10-19.tsv`.

| Level | Agreement | Cohen's kappa |
|---|---|---|
| Six labels | 81.3% | 0.73 |
| tp / unsure / fp | 81.9% | 0.71 |
| tp vs not tp | 93.8% | 0.86 |

None of the 60 random fp locations came back `tp`. The set over-represents
`tp` by design, so these figures describe the hard cases, not the population.

What changed (decided 2026-10-19, written into `eval/criteria.md`):

- **7 labels adopted from the second labeller**, where it traced further. One
  was a first-pass `tp` error: the documenso signer is memoised (L603, now
  `fp-once`).
- **The two-level rule is counted strictly.** The entry point must be the
  containing function, its caller, or its caller's caller. 13 `tp` labels
  needed three or more levels and are now `unsure`. These are six Countly
  data-migration chains, six Budibase isolated-vm calls, n8n source control
  (L634) and webiny mailer settings (L769).
- **Sync I/O in a dedicated `worker_threads` thread is `fp-not-blocking`**
  (L750).
- **An Electron reload after startup stays `tp`** (L037).

| | Study 02 | core-engine |
|---|---|---|
| 2026-10-13 / 10-14 | 340 (3.4%), CI 191–489, upper 1,002 | 584 (5.4%), CI 279–890, upper 910 |
| **2026-10-19** | **313 (3.1%), CI 165–460, upper 877** | **405 (3.7%), CI 143–668, upper 834** |

Study 02 by context, current:

| `context` | N | n | tp | fp-startup | fp-once | fp-tooling | fp-not-blocking | unsure | tp rate | Est. tp |
|---|---|---|---|---|---|---|---|---|---|---|
| `unknown_path` | 6,033 | 160 | 3 | 6 | 2 | 133 | 2 | 14 | 1.9% | 113 |
| `tooling_path` | 1,972 | 70 | 0 | 0 | 0 | 70 | 0 | 0 | 0.0% | 0 |
| `startup_path` | 1,281 | 70 | 2 | 4 | 2 | 60 | 2 | 0 | 2.9% | 37 |
| `request_path` | 633 | 70 | 17 | 11 | 1 | 35 | 2 | 4 | 24.3% | 154 |
| `background_path` | 139 | 30 | 2 | 1 | 0 | 27 | 0 | 0 | 6.7% | 9 |

core-engine by severity, current:

| Severity | N | n | tp | fp-startup | fp-once | fp-tooling | fp-not-blocking | unsure | tp rate | Est. tp |
|---|---|---|---|---|---|---|---|---|---|---|
| critical | 39 | 39 | 3 | 1 | 3 | 6 | 19 | 7 | 7.7% | 3 |
| high | 167 | 80 | 6 | 14 | 0 | 60 | 0 | 0 | 7.5% | 13 |
| medium | 3,008 | 140 | 3 | 9 | 2 | 117 | 2 | 7 | 2.1% | 64 |
| low | 7,647 | 141 | 6 | 5 | 1 | 121 | 3 | 5 | 4.3% | 325 |

core-engine by rule, current (sample counts, unweighted):

| Rule | n | tp | fp-tooling | fp-startup / once | fp-not-blocking | unsure |
|---|---|---|---|---|---|---|
| `sync-file-operation` | 303 | 13 | 247 | 27 | 5 | 11 |
| `sync-child-process` | 54 | 0 | 51 | 3 | 0 | 0 |
| `sync-database-operation` | 36 | 0 | 6 | 4 | 19 | 7 |
| `sync-crypto-operation` | 7 | 5 | 0 | 1 | 0 | 1 |

The findings in "What this says for Step 5" hold, and two of them get
sharper:

- critical's higher `tp` rate came from isolated-vm alone. Under the strict
  rule it is 7.7%, the same as high. No severity tier ranks anything.
- `sync-database-operation` now has no `tp` at all.

`request_path` agreement with the labels falls from 28.6% to 24.3%.

## Step 5 — Fix, and check every fix against the labels

Each round is a rescan of all 237 repositories at their commits, scored
against the labels. A fix may drop no `tp` location.

How a round is run (Node only; run in a cloud workspace, not on a laptop):

```bash
node scripts/usable.js                                   # results/raw/_usable.json
KEEP=<dir> node scripts/keep-trees.js --parallel 2       # 237 checkouts, pruned to 2.7 GB
CORE_ENGINE=<core-engine>/dist/index.js KEEP=<dir> \
  node scripts/rescan.js results/rounds/round-N.json --parallel 2
node scripts/eval-round.js results/rounds/round-N.json --list
```

The pruned trees keep only what the walker reads. A rescan of round 0 from
them reproduced all 10,861 findings, with identical file, line, rule and
severity in every repository (`results/rounds/round-0.json`, 2026-10-19).

`eval-round.js` scores a round from the core-engine sample:

- A sampled finding counts as kept if the round still reports its file and
  line.
- Strata are weighted as in Step 2, which gives the round-0 findings kept, the
  `tp` among them, and precision as their ratio.
- It lists every labelled location the round dropped. The hard check is that
  all 40 `tp` locations from either sample are still reported.

### The 953 unexplained core-engine-only findings, explained (2026-10-19)

Step 3 left 953 round-0 findings that only core-engine reported, with no
directory or rule reason. All 953 are in 13 files larger than 500 KB:

| Files | Findings |
|---|---|
| berry's bundled yarn CLIs (`packages/*/bin/*.js`) | 758 |
| `compiled/` and `.yarn/` bundles (Next.js, yarn releases) | 118 |
| other minified bundles | 77 |

Study 02's walker skips any file over 500,000 bytes (`MAX_FILE_SIZE` in
`scan-repo.js`). core-engine has no size limit. None of these files is code
anyone wrote, and round 1 removes all 953 (path exclusion and
`looksMinified`).

After round 2, 292 findings are still core-engine only, each for a known
reason:

- 268 `randomBytes` without a callback, which Study 02 did not look for.
- 23 under `public/` or `static/`, which Study 02 skips.
- 1 driver `querySync`, from the database rule Study 02 did not have.

### Round 1 (2026-10-19)

Three changes, each decided from the Step 4 labels:

- **Path exclusion.** The rule skips:
  - scripts and `bin/`
  - examples, demos and playgrounds
  - benchmarks, codemods, migrations and seeds
  - build configuration
  - `compiled/` and `.yarn/`, plus yarn release bundles by file name
  - test-helper directories the walker misses
  - minified files
  
  `tools/`, `tasks/` and `docs/` count only at a repository or package root,
  because `ai/tools/` is server code in directus. `vendor/` is left out
  because it is a domain word.
- **`sync-database-operation` keeps only driver names.** That is `querySync`,
  `executeSync` and `prepareSync`. `runSync`, `getSync` and `allSync` are
  gone.
- **Severity from request-handler context only.** A call in a handler is high
  (critical in a loop). Anywhere else it is low: a server import in the file
  no longer raises it, because medium findings were 2.2% tp against 4.2% for
  low. `randomBytes` in a handler is medium.

| | Round 0 | Round 1 |
|---|---|---|
| Findings | 10,861 | **5,924** |
| Labelled `tp` locations still reported | 40 of 40 | **40 of 40** |
| Estimated `tp` among them | 405 | 405 |
| Precision (estimated `tp` / findings) | 3.7% | **about 7%** |
| Upper bound, unsure as tp | 834 | 828 |

Where the 4,937 findings went:

| Cause | Findings |
|---|---|
| Path exclusion | 4,762 |
| Minified bundles outside those paths | 140 |
| Database rule narrowed (35 of 36) | 35 |

The labelled locations dropped were 303 `fp-tooling`, 21 `fp-not-blocking`,
4 `fp-once`, 2 `fp-startup` and 8 `unsure`: the generated PnP loader and six
isolated-vm calls through the database rule.

### Round 2 (2026-10-19)

- **Handlers written as arrow functions or methods.** The request-handler
  check only recognised `function` declarations and expressions taking
  `(req, res)`. `exports.postSignup = async (req, res) => {}` and class or
  object methods were missed. This is a bug fix: the findings are the same
  5,924, and only their severity changes.

### Severity after round 2

Severity now ranks. Counts are the round's actual findings; tp is from the
labelled sample:

| Round 2 severity | Findings | Sampled | tp in sample |
|---|---|---|---|
| critical | 3 | 3 | 3 |
| high | 35 | 8 | 4 |
| medium | 30 | 6 | 4 |
| low | 5,856 | 175 | 7 |

Before round 1, high, medium and low had tp rates of 7.5%, 2.1% and 4.3%. Now
11 of the 17 sampled findings above low are tp. The cost is that low still
holds 7 of the 18 sampled `tp`, and with them most of the estimated real
problems:

- `randomBytes` in a model method called from auth routes
- Electron main-process writes
- the pm2 daemon
- a Countly data-migration cleanup
- Koa-style controllers that take `ctx`

None of these sits in a function that takes `(req, res)`. This is the
reachability problem from Step 4: a handler two calls up is invisible to a
per-function check.

**Tried and not kept: `ctx` as a handler parameter.** Treating a function
whose first parameter is `ctx` as a handler promoted 40 findings. The two
sampled ones were `tp` (Budibase and Strapi controllers). Reading the other
38, about half are Koa, Strapi, Budibase and Outline handlers. The other half
are CLI task contexts: Redwood's Listr tasks, pnpm, hexo, create-astro and
nuxt modules. That is no better than the current high tier, so it is left
for Stage 2, where reachability can separate them.

`sync-child-process` keeps 313 findings, all low; none of the 54 sampled was
`tp`. It stays as a low-severity rule rather than being removed, since a
child process in a handler would still be high.

Not changed, for Stage 2:

- An `isolated-vm` rule. Its `runSync` does block, but it is not a database
  call.
- Koa- and Strapi-style handlers that take `ctx` (see the trial above).
- Next.js `pages/api` route files as handlers.
- zlib, `randomFillSync` and `.cjs` files.

# Stage 2 — Full blocking I/O detection

Stage 1 left core-engine with two kinds of gap. **Coverage**: patterns Study
02 or the backend detector find that core-engine does not. **Ranking**: 7 of
the 18 sampled `tp` sit at low severity, because the handler that makes them
matter is one or two calls away.

Scope, decided 2026-10-19 before the work. Items are done in this order, and
core-engine 1.5.0 is released after all of them:

1. **Reachability.** A call raises to high when its enclosing function is
   called from a request handler within two levels: in the same file, or
   through an imported binding in another file. This is the labelling's entry
   point rule, run by the engine. It is a `finalize()` step over a per-file
   call index.

   "Handler" grows from `(req, res)` functions to:
   - callbacks registered with `app`/`router` methods;
   - Next.js `pages/api` default exports and App Router `route` handlers;
   - Koa and Strapi controller methods taking `ctx`, but only under
     `controllers/`, after the round-2 trial;
   - Electron `ipcMain` handlers.

   It is scored on the existing labels, so no new labelling is needed.
2. **Coverage.** These patterns are added:
   - zlib `*Sync` (9 methods; Study 02 reported 59);
   - `randomFillSync`;
   - `.cjs` files.

   `.cjs` is a walker change, so it is measured against every published study
   first, as the 1.5.0 walker change was. New findings are sampled and
   labelled under `eval/criteria.md`.
3. **isolated-vm.** A rule of its own for synchronous isolate execution
   (`runSync`, `evalSync`, `applySync` and the like on isolated-vm objects).
   It blocks, but it was miscounted as a database call.
4. **A blocking I/O solution generator**, held to the Missing Index standard:
   the suggestion, applied, removes its own finding and the file still parses.
   The async replacement (`fs.promises`, `util.promisify`) is offered only
   where it can be awaited.

Out of scope, recorded as limitations:

- **Recall.** It is not measured: no sample of files without findings was
  searched for missed blocking calls.
- **`createHash` / `createHmac`** stay out; they do no work at construction.

Every change goes through the Stage 1 method:

1. Criteria are written first.
2. Each change is a rescan of the 237 pruned trees (`keep-trees.js`,
   `rescan.js`).
3. Each rescan is scored with `eval-round.js`. No labelled `tp` may be lost.
4. Every `tp` a change nearly lost becomes a regression test.

## Item 1 — reachability (done 2026-10-19)

core-engine now runs the labelling's entry point rule itself
(`core-engine/src/rules/blocking-io-reach.ts`). While each file is scanned,
it indexes:

- the file's functions, and which of them are handlers;
- the calls each function makes;
- the file's imports.

After the scan, `finalize()` takes each finding outside a handler and walks
the callers of its function, up to two levels. Callers are looked for in the
same file, and in other files through an imported binding, including
`x = new Imported()` instances. Functions are never linked across files by
name alone. If a handler is reached, the finding gets the severity it would
have inside one, and the description names the handler and how far up it is.

What counts as a handler:

- a function taking `(req, res)`, `(request, reply)` or `(request, response)`;
- a callback registered with `app`/`router` methods, with `createServer`, with
  `ipcMain`, or under a URL path (`plugins.register('/o/export', fn)`),
  whether inline or by name;
- a Next.js `pages/api` default export, or an App Router `route` handler;
- a method under `controllers/` taking `ctx`. The round-2 trial showed that
  `ctx` alone also matches CLI task contexts, so the directory is required.

Measured in four steps, each a rescan of the 237 trees
(`results/rounds/s2-reach-{1,2,3}.json`). Each step kept the same 5,924
findings and all 40 `tp`:

| | Findings above low | Labelled `tp` above low (of 40) |
|---|---|---|
| Round 0 (as shipped) | 3,214 | 19 |
| Round 2 (handler context only) | 68 | 14 |
| Reach 1: same-file and imported callers | 171 | 18 |
| Reach 2: `createServer`, URL-path callbacks, `(request, reply)` | 216 | 23 |
| **Reach 3: instances of imported constructors** | **258** | **30** |

In the core-engine sample, above low is now 16 `tp` out of 24, against 11
out of 17 after round 2. Low holds 2 sampled `tp`, down from 7.

Reach also promoted 5 labelled locations that are not `tp`:

- a memoised call (`fp-once`);
- two startup paths that a handler also reaches (`fp-startup`);
- the drawio CLI export branch, behind an `ipcMain.once` (`fp-tooling`);
- one `unsure`.

The 10 `tp` still at low, and why reach cannot see them:

| Locations | Entry point | Why not reached |
|---|---|---|
| L037, L281, L285, L726 | Electron renderer and menu actions | Menu clicks and Vue component methods are not handlers here |
| L752 | pm2 daemon RPC | The daemon's RPC table is built dynamically |
| L028 | apostrophe `apiRoutes` object | Routes are object keys (`post: { generate }`), not registrations |
| L351 | directus `defineTool({ handler })` | Framework-specific registration |
| L137, L378 | Budibase, apostrophe | The caller imports the module by package name, not by relative path |
| L392 | Redwood jobs worker | A job handler, not a request handler |

Package-name imports inside a monorepo are the one gap that is general rather
than framework-specific. Resolving them needs each package's `package.json`,
which the per-file rule does not see. That is left for a later version.

## Item 2 — coverage: zlib, `randomFillSync`, `.cjs` (done 2026-10-19)

- **New rule `blocking-io/sync-zlib-operation`.** It covers the nine zlib
  `*Sync` methods.
- **`randomFillSync`** joins `sync-crypto-operation`.
- **`.cjs` files** are read by the blocking-io rules. The walker collects
  them, but a `.cjs` file that no active rule reads is dropped before
  counting. A scan for N+1, Missing Index or Payload therefore sees exactly
  the files it saw before, and no published figure can change (tested in
  `engine.test.ts`).

The rescan (`results/rounds/s2-coverage.json`) added 45 findings and lost
none:

| Source | Findings |
|---|---|
| zlib `*Sync` | 32 |
| `.cjs` files | 11 |
| `randomFillSync` | 2 |

Study 02 reported 59 zlib calls. The difference is the 1.5.0 walker and the
round-1 path exclusions: most of Study 02's were in tests and scripts.

All 45 are labelled under the criteria amendment
(`eval/s2-coverage-labels.tsv`, N01–N45):

| Label | Count |
|---|---|
| `fp-tooling` | 27 |
| `unsure` | 11 |
| `fp-startup` | 3 |
| `fp-not-blocking` | 2 |
| `fp-once` | 1 |
| `tp` | 1 |

The one `tp` is drawio's PNG export: `deflateRawSync` in `exportDiagram`,
registered with `ipcMain.on('export')`, in the Electron main process. Reach
raises it to high. The `unsure` are pdfkit and ws library internals, and two
Next.js resume-data-cache calls whose request entry is beyond two levels. The
zlib names also match fflate. Two of those calls are in browser code
(`fp-not-blocking`).

## Item 3 — isolated-vm (done 2026-10-19)

New rule `blocking-io/sync-isolate-execution` covers `runSync`, `applySync`,
`evalSync`, `getSync`, `createContextSync` and their kin. It applies only in
files that import isolated-vm, because `runSync` and `getSync` are common
method names.

It reports 32 findings (`results/rounds/s2-isolate.json`):

- in Budibase's JS runner, Rocket.Chat's integration sandbox, directus'
  exec operation and extension sandbox, and hoppscotch's script sandbox;
- 7 of them are round-0 locations already labelled; the 25 new ones are
  labelled I01–I25.

| Label | Count |
|---|---|
| `unsure` | 24 |
| `fp-once` | 7 |
| `fp-startup` | 1 |
| `tp` | 0 |

The calls do block, but every request entry is three or more levels away:
Budibase's runner is called through the string-template engine, and
Rocket.Chat's through a table of script functions. Under the strict rule they
stay `unsure`, and reach leaves them at low.

In a file that does import isolated-vm, an unrelated method that happens to be
named `runSync` is still matched. A regression test records this.

## Item 4 — blocking I/O solution generator (done 2026-10-19)

`core-engine/src/solutions/blocking-io-generator.ts` follows the Missing Index
standard: paste the suggestion over the call, and the finding is gone and the
file still parses. The rules put the call in `codeBefore` only when its
function is already async, so the `await` in every suggestion is legal where
it goes.

| Call | Suggestion |
|---|---|
| fs (20 methods) | `(await fs.promises.readFile(p, 'utf8'))`: same arguments, same value |
| `existsSync` | `(await fs.promises.access(p).then(() => true, () => false))` |
| crypto, zlib | `(await new Promise((resolve, reject) => crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key)))))` |
| isolated-vm | `(await script.run(ctx, opts))`: the async twin takes the same arguments |

The suggestions use a promise wrapper rather than `util.promisify`, so they
need no import and are complete as pasted. A parenthesised receiver keeps its
parentheses (`(require('crypto') as ...).randomBytes`), a bug found on the
corpus that now has a test.

There is no suggestion, on purpose, for:

- **fd-based fs calls** (`openSync`, `closeSync`): the async API returns a
  FileHandle, so every later use of the descriptor changes.
- **Child processes:** `execSync` returns stdout and throws on a non-zero
  exit, and `stdio: 'inherit'` behaves differently once async. None of the 54
  sampled was a real problem.
- **Database `querySync`:** drivers differ in their async form.
- **A bare `pbkdf2Sync(...)` or `gzipSync(...)` imported by name:** the async
  name is not in scope.
- **A call in a sync function:** making the function async changes every
  caller, which is a refactor, not a replacement.

**Checked on the corpus** with `scripts/check-solutions.js`, which applies
every suggestion to the real file, parses it and scans it again
(`results/rounds/s2-solutions.json`):

| blocking-io findings | In an async function | With a suggestion | Finding gone after applying it | Still reported | New parse errors |
|---|---|---|---|---|---|
| 6,001 | 1,544 | 1,165 | 1,162 | 0 | 0 |

The other three are in files this parser cannot read as they stand (Flow
types, import assertions), so they are counted apart.

**On the labelled true positives, 12 of 40 get a drop-in suggestion.** Payload
reached 104 of 109, because a row limit fits anywhere. Most real blocking
calls here sit in synchronous code: callback-style handlers (Countly,
Electron main) and `(req, res)` callbacks that were never made async. There,
the fix is to change the function, which a drop-in suggestion cannot do.

**Refactor notes for the rest (decided 2026-10-19: labelled as refactors, not
forced into drop-ins).** Where the call cannot be awaited, the recommendation
starts with `Refactor, not a drop-in fix:` and says what to change. The
generator returns that note as a `blocking-io-refactor` solution with risk
high and no code. `check-solutions.js` counts these notes but never applies
them.

| Where the call is | The note says |
|---|---|
| A sync handler (`app.get('/r', (req, res) => ...)`) | Make the handler async; the framework awaits it, so nothing else changes |
| A named sync function | Make `'loadConfig'` async, await `fs.promises.readFile`, then await `'loadConfig'` where it is called (`src/routes.js:2`, up to three callers named), up to a caller that is already async |
| A sync callback (`forEach`, `map`, a callback API) | Turn it into a `for...of` loop (or an async callback whose promise the caller awaits) inside an async function, and await there |
| Module level | Usually startup and harmless; if loaded lazily while serving, move the work into an async initialiser |

On the corpus, 4,087 findings get a refactor note. Child-process,
database and fd-based calls get neither a drop-in nor a note.

| Labelled `tp` (40) | Count |
|---|---|
| Drop-in suggestion | 12 |
| Refactor note: sync handler | 2 |
| Refactor note: named sync function | 12 |
| Refactor note: inside a sync callback | 12 |
| Neither: L637 `generateKeyPairSync` imported by name in an async function; L307 `openSync` (fd-based) | 2 |

## Stage 2 result

| | Stage 1 start (round 0) | Stage 1 end (round 2) | Stage 2 end |
|---|---|---|---|
| Findings | 10,861 | 5,924 | 6,001 |
| Rules | 4 | 4 | 6 |
| Estimated `tp` (core-engine sample) | 405 (3.7%) | 405 (about 7%) | 405 + 1 new (about 7%) |
| Labelled `tp` still reported | 40 of 40 | 40 of 40 | 40 of 40 |
| Findings above low | 3,214 | 68 | 261 |
| Labelled `tp` above low | 19 of 40 | 14 of 40 | 30 of 40 |
| `tp` with a drop-in fix | — | — | 12 of 40 |
| `tp` with a refactor note | — | — | 26 of 40 |

Precision over everything stays near 7%: most findings are synchronous calls
in code that serves nothing. What Stage 2 changes is the top of the list.
Above low, there are 261 findings and they hold three quarters of the
labelled real problems. In the sample, two thirds of the findings above low
are `tp`.

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
