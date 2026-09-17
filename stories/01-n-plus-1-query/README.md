# N+1 Query Detector — Application Report (Reproducible Study)

This folder documents, step by step, how we tested Code Evolution Lab's N+1 Query
Detector against real open-source codebases, what the first run got wrong, and how
we fixed it. Everything here is reproducible with the **public**, free-tier build
of the product — the same one anyone can clone from the `code-evolution-lab`
repository.

The headline: the first run had a **60.3% false-positive rate**. Seven rounds of
fixing the detector brought that to **0% across 28 repositories** — the three study
repositories, five held-out ones, and the 20 candidates that had never been scanned
properly — while also surfacing well over a hundred genuine N+1 patterns the
original detector had missed entirely.

The final write-up is at `content/n-plus-1-query-application-report.md`. This
README is the lab notebook behind it.

## Step 0 — Build the CLI from source

The N+1 Query Detector is one of four detectors in the free tier of Code Evolution
Lab (the others are Inefficient Loop, Memory Leak, and Large Payload). It is a
standalone, offline static analyzer — it never sends your code anywhere, and it
doesn't need a database or API server to run.

```bash
git clone https://github.com/<org>/code-evolution-lab.git
cd code-evolution-lab/backend
npm install
npx tsc            # emits dist/cli.js — see note below
```

`npm run build` also runs `prisma generate`, which the CLI doesn't need (it has no
database of its own — it only reads your source files). If your network can't reach
the Prisma binary mirror, run `npx tsc` directly; it still emits a working
`dist/cli.js`.

## Step 1 — Get a repository list

We had no existing repository list for N+1 Query, so we built one in two passes
(full table in `data/candidates.md`):

1. Reused the 40-repository Prisma corpus curated for the Missing Index study.
2. Added 5 repositories chosen to cover the ORMs the detector recognises but that
   corpus barely touched: Sequelize, TypeORM, Mongoose, and Kysely-style builders.

45 candidates. 9 produced at least one finding.

## Step 2 — Preliminary study: pick scopes that fit

The scan scope is capped at roughly 500 JS/TS files, so every candidate needs a
sub-package that stays under that ceiling while still containing real application
logic. A purely mechanical rule ("walk up from the schema file to the nearest
`package.json`") lands on the smallest enclosing package — often the schema package
itself. For every repository in the final report we inspected the directory tree
(`git ls-tree`, no blob download needed) and picked the packages that hold
request-handling or background-job logic: `routes`, `commands`, `services`,
`processors`, `handlers`.

`scripts/scan-repo.sh` takes one or more of those scopes and combines them into a
single scan.

## Step 3 — Scan, then verify every finding by hand

We ran the scan and then read every single finding against its source line. This is
where the study nearly went sideways: **47 of the first run's 78 findings were
false positives**, and the detector had *also* missed 11 genuine N+1 patterns.

Reading the false positives showed they were nearly all one root cause. The
detector identified a "database call" partly by method name (`.get`, `.find`,
`.all`, `.execute`) and, when a file contained no recognisable ORM import, it
trusted that guess with no confirmation at all. That collides head-on with the most
common idioms in JavaScript:

```ts
const translations = new Map();
const t = translations.get(locale);        // reported as a database query

const credential = credentials.find((c) => c.id === id);   // reported as Mongoose.find()

await Promise.all(items.map(...));         // reported as a database query
```

The missed detections had the opposite cause: the method list contained only read
methods, so a loop issuing one `UPDATE` or one `upsert` per item — just as
expensive as a read N+1 — was invisible.

## Step 4 — Fix the detector, measure, repeat

To make "better" measurable rather than a matter of opinion, we first wrote down
the ground truth: every loop location across the three repositories where a real
per-item database call happens, verified by reading the source. That lives in
`eval/labels.json`, with the reason recorded for every location we rejected.
`eval/score.js` scores any scan output against it.

```bash
node eval/score.js results            # the post-fix run in this folder
node eval/score.js results/baseline   # the original run
node eval/score.js results --detail   # list each remaining false positive
```

Rounds 1-4 came out of the three study repositories, each measured before
moving on. Rounds 5-7 came later, out of the expanded corpus in Step 6:

| Round | Change | Raw | Genuine | False positives | FP rate | Recall |
|---|---|---:|---:|---:|---:|---:|
| Baseline | — | 78 | 31 | 47 | 60.3% | 73.8% |
| 1 | Split method names into distinctive (`findUnique`, `findByPk`, …) and ambiguous (`find`, `get`, `execute`, …). Ambiguous names now need real evidence: an ORM import, a SQL-builder chain, a `prisma`/`db`/`tx` handle, or a repository-shaped receiver. Veto `Promise.all`, `Map`/`Set` receivers, and `.find(callback)`. Add write methods (`update`, `upsert`, `create`, `delete`). | 53 | 42 | 11 | 20.8% | 100% |
| 2 | Scan loop bodies only, so the query that *produces* the collection is no longer counted as running inside the loop. Assign each query to its innermost loop, so one N+1 isn't reported once per enclosing loop. Treat a write whose payload is a whole buffered array as a bulk flush. | 43 | 42 | 1 | 2.3% | 100% |
| 3 | Skip `for(;;)` and `while (true)` retry/polling loops — there is no collection, so there is nothing to batch. | 42 | 42 | 0 | 0.0% | 100% |
| 4 | Skip `for (i = 0; i < n; i += PAGE_SIZE)` window loops, the same way cursor/offset pagination was already skipped. Promote `findOne` to the distinctive tier (it produced zero false positives in the data). | 42 | 42 | 0 | 0.0% | 100% |
| 5 | Skip bounded retry loops (`while (retries <= MAX_RETRIES)`) and flag-driven batch loops (`while (hasMore)`). Ignore Firestore-style staged `transaction.delete()` writes. Require a repository-shaped receiver's result to be awaited or returned, so a `Map` named `repositories` no longer qualifies. | 42 | 42 | 0 | 0.0% | 100% |
| 6 | Decide "this loop walks batches" from how the collection was produced (`chunk(...)`), not from its name — a job queue called `campaignBatches` still runs one query per job. Let a skipped inner loop keep its own queries instead of pushing them to the loop around it. | 42 | 42 | 0 | 0.0% | 100% |
| 7 | Skip a query that consumes the whole iterated item (`where: { id: { in: batch } }`), while still reporting one that is merely scoped to the item's children. | 42 | 42 | 0 | 0.0% | 100% |

Rounds 5-7 hold the study-repository score steady at 42/42 while removing
false-positive classes that only appeared once the corpus got bigger — which is the
point of keeping the scoring harness around.

Recall going from 73.8% to 100% is the half of this that isn't about noise: the
fixed detector finds 11 genuine problems in these three repositories that the
original never reported, most of them write-side N+1s. Across the full 28-repository
corpus that number is well over a hundred.

The improved detector is in `backend/src/detectors/n1-query-detector.ts` in the
public repository. The repository's own unit tests pass.

## Step 5 — Held-out validation

A 0% false-positive rate on the repositories you tuned against proves very little.
So we ran the same before/after comparison on five repositories that were never
used while fixing anything, and hand-checked every finding:

| Repository | Before | After | Genuine | False positives |
|---|---:|---:|---:|---:|
| toeverything/AFFiNE | 26 | 11 | 11 | 0 |
| twentyhq/twenty | 18 | 9 | 9 | 0 |
| civitai/civitai | 18 | 2 | 2 | 0 |
| novuhq/novu | 30 | 1 | 1 | 0 |
| medusajs/medusa | 3 | 0 | 0 | 0 |
| **Total** | **95** | **23** | **23** | **0** |

Same two-sided result: AFFiNE's noise disappeared and eleven real problems appeared
in its place, including a migration issuing five queries per document row. Medusa
going to zero is correct — all three of its original findings were `Map.get()` and
`Array.find()` calls.

## Step 6 — The rest of the candidate pool

The first pass had only ever scanned 25 of the 45 candidates properly. The other 20
had been recorded as "no schema.prisma found", "scope resolution failed", "over the
file cap", or scanned at a scope containing no application code. With the detector
fixed, we went back and scanned all of them — first triaging which repositories even
use an ORM the detector supports, then picking a real server-code scope for each.
Details, per-repository results and the triage table are in
`results/expanded-corpus/`.

| | Original detector | Fixed detector |
|---|---:|---:|
| Findings across 20 repositories (5,862 files) | 341 | 148 |
| Confirmed genuine | — | 148 |
| False positives | — | 0 |

Scopes used:

| Repository | Scope |
|---|---|
| formbricks/formbricks | `apps/web/lib`, `apps/web/app/api` |
| Infisical/infisical | `backend/src/server` |
| mfts/papermark | `pages/api`, `app`, `ee` |
| dubinc/dub | `apps/web/lib/api`, `apps/web/app/api` |
| triggerdotdev/trigger.dev | `apps/webapp/app/services`, `apps/webapp/app/v3` |
| documenso/documenso | `packages/lib/server-only`, `packages/lib/jobs` |
| useplunk/plunk | `apps/api/src`, `apps/web/src` |
| amplication/amplication | 12 modules under `packages/amplication-server/src/core` |
| baptisteArno/typebot.io | `packages/bot-engine/src`, `packages/lib/src`, `packages/scripts/src` |
| midday-ai/midday | `apps/api`, `apps/worker/src` |
| keystonejs/keystone | `packages/core` |
| nextauthjs/next-auth | `packages` |
| prisma/prisma-examples | `orm` |
| redwoodjs/redwood | `packages/cli/src`, `packages/codemods/src` |
| trpc/trpc | `packages/server` |
| blitz-js/blitz | `packages/blitz/src`, `packages/generator/src`, `apps/web/src` |
| wasp-lang/wasp | `waspc/data`, `web/src` |
| remix-run/examples | `pm-app`, `_official-blog-tutorial` |
| boxyhq/saas-starter-kit | `lib`, `pages` |
| t3-oss/create-t3-app | `cli` |

Nine repositories from the original pool were excluded at triage because they use
an ORM the detector does not support (Drizzle: openstatus, uploadthing,
AnswerOverflow, create-t3-turbo, lobe-chat) or are not JavaScript backends at all
(plausible is Elixir, plane is Django, maybe is Rails). Reporting zero findings for
those would have been misleading — the detector was never going to look at them.

This third pass also drove three more rounds of fixes, because it surfaced
false-positive classes the first eight repositories did not contain: bounded retry
loops (`while (retries <= MAX_RETRIES)`), flag-driven batch loops
(`while (hasMore) { deleteMany(...) }`), Firestore's staged
`transaction.delete()` writes, a plain `Map` that happened to be named
`repositories`, and chunked queries of the form `where: { id: { in: batch } }`.
Each was fixed and the three study repositories re-scanned to confirm nothing
regressed — they still score 42 findings, 42 genuine, 0 false positives.

## Step 7 — Freeze it as a regression suite

Seven rounds of accuracy work is worth nothing if the next refactor quietly undoes
it, and the detector shipped with four unit tests. So every classification made
during this study is now a test case in the public repository, at
`backend/src/__tests__/n1-query-detector.corpus.test.ts`:

- **19 patterns that must be detected** — one per ORM and per shape: Prisma reads
  and writes, sequential transaction updates, Sequelize `findByPk` fan-out, a
  Kysely delete chain, repository calls, raw SQL as both a template literal and a
  concatenated string, Mongoose, TypeORM, seed-script inserts, a per-item query
  inside a concurrency-limited batch, and a collection merely *named* `...Batches`.
- **18 patterns that must not be reported** — every false-positive class that cost
  a round to kill: `Map.get()`, class-property Maps, `Array.find(callback)`,
  `Promise.all`, bounded and infinite retry loops, cursor pagination, flag-driven
  batch deletion, fixed-window paging, `in:`-clause chunking, the query that
  produces the collection, buffered bulk flushes, Firestore staged writes, a `Map`
  named `repositories`, CQRS `usecase.execute()`, and Redis calls.
- Plus nested-loop attribution and severity escalation.

Each case carries the repository and file it was reduced from, so the test file
doubles as documentation of where each rule came from. 43 tests, all passing.

Writing them immediately paid for itself: the raw-SQL case failed, because the
keyword list recognised `DROP TABLE` but not `DROP PUBLICATION`, and only matched
string literals and template literals — not SQL built by concatenation. Both are
fixed, and both shapes are now cases.

## Step 8 — What the findings look like, and how to fix them

42 confirmed findings across the three study repositories. Full tables in
`results/summary.md`; raw JSON with the CLI's generated fix for each is in
`results/*.json`.

outline/outline's 27 all trace to one root cause: its background-job notification
pipeline resolves recipients by looping over mentions or group members and calling
`User.findByPk()` / `Group.findByPk()` once per entry instead of collecting ids and
issuing one `where: { id: [...] }` query. Every `--solutions` output proposes that
same three-step fix — collect ids, batch-query once, build a lookup map — plus a
Sequelize `include` alternative where eager loading applies.

immich-app/immich's `asset.repository.ts` case needs no explanation: a method named
`deleteBulkMetadata()` runs one `DELETE` per item inside its own loop.

## Reproducing this from scratch

```bash
# 1. Build the CLI (Step 0)
git clone https://github.com/<org>/code-evolution-lab.git
cd code-evolution-lab/backend && npm install && npx tsc && cd ../..
export CEL_CLI=./code-evolution-lab/backend/dist/cli.js

# 2. Rerun the three scans
./scripts/scan-repo.sh outline/outline server/routes server/commands \
  server/presenters server/queues server/policies server/services
./scripts/scan-repo.sh calcom/cal.com packages/trpc
./scripts/scan-repo.sh immich-app/immich server/src/services \
  server/src/repositories server/src/controllers server/src/workers server/src/commands

# 3. Score your run against the verified ground truth
node eval/score.js .            # point it at wherever the JSON landed
```

If your counts differ from ours, the most likely reason is that these are living
codebases and line numbers move. The unedited terminal output of our final run is
in `logs/*.log` for line-by-line comparison.
