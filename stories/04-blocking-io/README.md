# Blocking I/O — Detector Study (Reproducible)

This folder is the lab notebook for recalibrating Code Evolution Lab's
Blocking I/O rules against the same 250 repositories Study 02 scanned in
February 2026, following the method of `stories/03-large-payloads/`: reproduce
the published numbers first, label before changing any rule, then fix and
check every fix against the labels.

## Stages

| Stage | Goal | Status |
|---|---|---|
| 1 | Reproduce Study 02 on its own corpus and commits, reconcile its numbers, and calibrate the four `blocking-io/*` rules core-engine already has | In progress. Step 0 started 2026-10-06 |
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

## Step 0 — Recover the commits (in progress)

Study 02 cloned with `--depth 1` into `studies/02-blocking-io/.repos/`, and
that directory is gone, so unlike Study 09 there is no recorded `HEAD`. The
first scan began at 2026-02-13T22:29:31Z (first finding id
`scan-1771021771639-1`), so each repository's candidate is the last commit on
its default branch committed before that time.

- `scripts/build-corpus.js` writes `data/corpus.tsv` from Study 02's scan
  output and `repo-samples.md`: 250 rows, 3 marked `duplicate_of`.
- `scripts/pin-commits.js` writes `data/study02-commits.tsv`: branch, candidate
  commit, commit date and commits since the cutoff, via blobless bare clones.
  Tested on the first 3 repositories; the full 247 has not been run yet.

A candidate becomes a pin only when Step 1 reproduces that repository's Study
02 findings exactly. Where it does not (a later push of an older commit, a
renamed default branch, rewritten history), try the neighbouring commits;
whatever still does not match is reported as not reproducible, with its count.

Spot check, 2026-10-06: expressjs/express at the candidate
`1140301f6a0e` gives 48 files and the same 3 findings on the same lines
(`examples/mvc/lib/boot.js:14`, `:16`, `lib/view.js:201`) as Study 02.

## Step 1 — Reproduce Study 02 exactly, then reconcile its numbers

`scripts/scan-repo.js` (to write): check out the pinned commit, run Study 02's
own `blocking-io-detector.ts` and `parser.ts` compiled to CommonJS unchanged,
with Study 02's own file walker (its `SKIP_DIRS`, extensions and 500 KB limit),
and record every finding with its source line. In the same pass run
core-engine's `blocking-io/*` rules with core-engine's own walker, as
`scan-repo.js` does in the payload story.

Then reconcile the published 10,609 / 191 / 76.4% to the finding: duplicates
out, zero-file rows out, anything not reproducible out.

## Step 2 — How many Study 02 findings are a blocking call that matters

Stratified sample of Study 02's findings, labelled with one question first:
does this call run where it blocks other work (a request, a job, a listener),
or only at startup, in tooling or in a test? Pay particular attention to the
`unknown_path` 60%, since that is where the published 7% estimate came from.

## Step 3 — core-engine, round 0

core-engine 1.4.x's four rules as shipped: `sync-file-operation`,
`sync-crypto-operation`, `sync-child-process`, `sync-database-operation`.
Things to check here, not yet verified:

- All four rule definitions call the same `detectBlockingIoIssues`. Confirm
  the engine does not report each finding once per rule.
- Study 02 has a `sync_zlib_operation` type (59 findings); confirm whether
  core-engine covers zlib.

## Step 4 — Label, before changing any rule

`eval/criteria.md` first, written before reading any finding, then a sample
and labels in `eval/`.

## Step 5 — Fix, and check every fix against the labels

Rounds in `results/rounds/`, scored with an `eval-round.js` like the payload
story's.

## Reproduce

```bash
cd empirical-study/stories/04-blocking-io
node scripts/build-corpus.js                       # data/corpus.tsv
WORK=/tmp/b02-pin node scripts/pin-commits.js --parallel 4   # data/study02-commits.tsv
```
