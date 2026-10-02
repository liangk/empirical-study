# Large Payloads — Detector Study (Reproducible)

This folder is the lab notebook for recalibrating Code Evolution Lab's payload
rules (`payload/unbounded-query`, `payload/large-return`) against the same 300
repositories Study 09 scanned, at the same commits.

The headline, in one table:

| | Study 09 detector | core-engine, round 0 | core-engine, final |
|---|---|---|---|
| Findings on the 283 reproducible repositories | 51,756 | 3,584 | 923 |
| Repositories with a finding | 184 | 37 | 25 |
| Database calls at all (estimated) | 12.7% | — | — |
| Precision among decided labels (estimated) | — | 9.2% (round 1) | 52.8% |

Study 09 published 52,010 findings. Fewer than one in seven were database calls.
The calibrated rules report 923, of which an estimated 263 are unbounded
queries in code that serves requests, with 424 that cannot be decided from the
repository alone (see Step 5).

## Stages

| Stage | Goal | Status |
|---|---|---|
| 1 | Reproduce Study 09 on its own corpus and commits, reconcile its numbers, and calibrate the two payload rules core-engine already had | Done (2026-09-24). Steps 0–5 below; results go in the report |
| 2 | Bring core-engine's payload detection to full coverage: every pattern any of the three detectors claims, each calibrated the same way | In progress — item 1 done (2026-09-24) |

# Stage 1 — Reproduce Study 09

## Step 0 — Pin the corpus to Study 09's own commits

Study 09 cloned its corpus with `--depth 1` into `studies/09-large-payloads/.repos/`
in May 2026. That directory still holds 285 checkouts, and their `HEAD` commits
are recorded in `data/study09-commits.tsv`. `data/corpus.tsv` is Study 09's
`corpus.md` as a table, with that commit and a `duplicate_of` column.

- 300 rows in `corpus.md`; 295 distinct repositories (see Step 1).
- 283 have a pinned commit. The other 12 are the 12 that failed to clone in
  May; they have no snapshot, so they are out.

Every scan in this study runs at those 283 commits.

## Step 1 — Reproduce Study 09 exactly, then reconcile its numbers

`scripts/scan-repo.js` checks out one pinned commit, runs Study 09's own
detector (`payload-detector.ts`, compiled to CommonJS unchanged) over Study 09's
own file filter, and records every finding with its source line — the data
behind the published total, which Study 09 never saved per finding.

**All 272 repositories that Study 09 scanned successfully reproduce its
per-repository count exactly; none differ.** The other 11 are repositories
Study 09 dropped whole after one file threw. Here a throwing file is recorded
and the scan carries on: 10 of the 11 then have findings, mochajs/mocha has
none.

The published total reconciles to the finding:

| | Findings |
|---|---|
| Study 09, published | 52,010 |
| Four repositories listed twice in the corpus (cal.com, papercups, mongoose, puppeteer) were scanned and counted twice | −2,988 → 49,022 |
| `mikeal/request` is the same repository as `request/request` | −1 → 49,021 |
| The repositories Study 09 dropped after a file error (10 with findings) | +2,735 → **51,756** |

Three corrections to the published Study 09 figures follow from the scanner source:

- `prevalence-*.json` says 59.7%; the article says 64.6%. The scanner divides
  by `corpus.length` (300) without removing failures — 179/300. The article
  re-divided by 277.
- `reposWithFindings` is 179 but `byRepo` has 175 entries: the duplicated
  repositories overwrote their own entries.
- The article attributes the 23 failures to "eleven deleted, seven Babel, five
  JSX". `scan-errors-*.json` records 12 clone failures, 8 `EISDIR` (a
  directory named like a source file) and 3 Babel duplicate declarations.

## Step 2 — How many Study 09 findings are database calls at all

400 findings sampled, stratified by pattern (seed 20260924,
`eval/study09-sample.json`), labelled in `eval/study09-labels.json`. The only
question asked: is this a database call? Counted generously — any read or
write, including Elasticsearch admin calls.

| Pattern | Findings | Sampled | Database calls | Estimated |
|---|---|---|---|---|
| `unbounded_find_all` | 33,127 | 256 | 10 | 1,294 |
| `deep_nested_include` | 16,428 | 127 | 35 | 4,527 |
| `select_star` | 2,201 | 17 | 6 | 777 |
| **Total** | **51,756** | **400** | **51** | **6,598 (12.7%)** |

With every `unsure` counted as a database call, the ceiling is 14.2%. What the
rest are: `Array.prototype.find`, lodash `_.find`, jQuery and Cypress `.find`,
Kibana's Selenium `testSubjects.find`, `expect(...).to.include(...)`, route
definitions whose options object happens to nest three levels, knex's own unit
tests asserting on SQL strings, and minified bundles.

The cause is visible in the detector: `unbounded_find_all` fires on any method
named `find`, `findFirst`, `findMany` or `findAll` whose first argument is not
an object with a `take`, `limit` or `where` key — so `array.find(cb)` always
matches, and so does `findFirst`, which returns one row — and
`deep_nested_include` fires on any call at all whose first argument is an
object nested three levels deep.

## Step 3 — core-engine, round 0 and round 1

Round 0 is core-engine 1.3.0's payload rules as shipped: **3,584 findings in 37
repositories.** The same scan is in every `results/raw/*.json` under `new`.

Round 1 is a scope decision, made before labelling (2026-09-23): a query with a
row limit but no `select` is not a finding. What makes a response large is the
number of rows. That removes 143 findings: **3,441.**

## Step 4 — Label, before changing any rule

Criteria first: `eval/criteria.md`, written before any finding was read, with
two dated amendments and the reason for each. Six labels: `tp`,
`fp-not-a-query`, `fp-bounded-by-key`, `fp-bounded-elsewhere`, `fp-not-served`,
`unsure`.

Sample: 400 of the 3,441 (seed 20260923, `eval/sample.json`; every round-1
finding with its stratum is in `eval/round1-strata.json`). A path breakdown —
no finding read — put 2,085 of them in four structural classes, so the sample
is stratified: 25 from each class to check the path rule, 300 from the rest by
repository. Labels: `eval/labels.json`.

| Stratum | Findings | Sampled | tp | Notes |
|---|---|---|---|---|
| Test directories the walker does not skip | 1,129 | 25 | 0 | `test/`, `tests/`, fixtures, cypress |
| Minified bundles | 707 | 25 | 0 | hasura ships codegen bundles as frontend assets |
| Migrations and seeds | 172 | 25 | 0 | |
| Samples, examples, benchmarks | 70 | 25 | 0 | |
| Everything else | 1,363 | 300 | 59 | 107 `unsure` |

Round 1, weighted by stratum (`scripts/estimate.js`): an estimated 272 true
positives and 474 `unsure` among 3,441 — **9.2% precision among decided
findings**, 21.7% if every `unsure` were a true positive.

## Step 5 — Fix, and check every fix against the labels

Round 2 and 3 changes are in `packages/core-engine/src/rules/payload-rules.ts`,
not in the shared `db-call-heuristics.ts`, so the N+1 rule's calibration is
untouched. Each change is a regression test in
`__tests__/payload-rules.test.ts` naming the repository it came from.

1. **Code that never serves a request.** Skip test directories, migrations,
   seeds, scripts, samples, vendored files and minified bundles.
2. **Filters bounded by the caller.** A top-level IN list the caller supplied
   (`{ in: ids }`, `{ $in: ids }`, `In(ids)`, an id-keyed array) or an equality
   on `id`, `_id`, `uuid` or `slug`.
3. **Limits outside the first argument.** Any object argument with a limit
   (Mongoose options come third), and a chained `.limit()`, `.countDocuments()`,
   `.cursor()` or `.batchSize()`.
4. **Finders that are not queries.** A string first argument (a selector), a
   function argument (a predicate), a receiver named `*Service`, a React Query
   cache.
5. **One finding per call.** `return await x.findMany()` was reported by both
   rules.

`scripts/eval-round.js` scores a rescan against the labels. The first draft of
round 2 lost seven true positives. Four were real, and each is now a test
that must stay reported:

- `OR: [...]` was read as an IN list (cal.com's booking-reminder cron).
- A constant `$in: [Kind.ECHO, Kind.BRIDGE]` selects a category, not a known
  set (novu).
- In Mongo, `projects: [projectId]` is an exact array match, not IN
  (growthbook).
- Three were not lost at all: they moved from `unbounded-query` to
  `large-return` when the double report was fixed.

Round 3 tried treating a plural id key (`{ spaceUuids }`) as bounded. It
removed six false positives and one true positive —
`savedChartModel.find({ spaceUuids: allowedSpaceUuids })` loads every chart in
every space a user can see — and was reverted: a list of the rows' own ids
bounds the result, a list of parent ids does not, and the key cannot tell
which it is.

**Final: 923 findings in 25 repositories** (`results/rounds/final.json`;
724 `unbounded-query`, 199 `large-return`). No labelled true positive is lost.
Weighted: an estimated 263 true positives and 424 `unsure` — **52.8% precision
among decided findings**, 74.5% if every `unsure` were a true positive.

## Stage 1 — how the rescans work without recloning

After scanning, `scan-repo.js` keeps a pruned copy of each checkout: only the
JS/TS files that mention a collection finder. The payload rules decide
everything inside one file, so a rescan of the pruned tree reports what a
rescan of the full tree would. `scripts/check-prune.js` verifies it: the
round-0 build on the pruned trees reproduces all 3,584 findings, 283 of 283
repositories matching.

It failed the first time. The first pruning pattern required `(` straight after
the method name and silently dropped `repository.find<T>(...)` — 15 findings
across kibana and outline. The trees were rebuilt with a wider pattern before
any round was measured on them.

## Stage 1 — what it does not fix

- **The `unsure` pile.** 424 of 923 findings. Almost all are lists of things a
  user or team configures — credentials, event types, calendars, API keys —
  where nothing in the code caps the count but nothing makes it grow with use.
  Static analysis cannot settle these; the article should say so rather than
  pick a side.
- **Test directories are an engine problem.** The engine skips `__tests__`
  and `*.test.*` but not `test/` or `tests/`. This study skips them inside the
  payload rule. The walker is the right place, but changing it changes every
  detector's counts, including the published N+1 and Missing Index figures, so
  it is left as a separate decision.
- **False negatives from query builders.** Directus and nocodb report zero
  findings under both detectors: they build queries with knex, and neither
  rule looks at `.select()` chains. Lightdash's model methods wrap knex the
  same way; only the call sites are seen.
- **ORM source.** Sequelize's, MikroORM's and Umzug's own implementations
  still report on themselves.
- **Study 09's other two patterns, and the backend's third check.**
  `deep_nested_include`, `select_star` and `large_api_payload` have no
  core-engine equivalent yet. They are Stage 2.

# Stage 2 — Full payload detection

Three detectors claim to find large payloads, and none covers what the others
do:

| Pattern | Study 09 detector | Backend (API) | core-engine |
|---|---|---|---|
| Collection query with no row limit | `unbounded_find_all` (uncorroborated) | `select_all_query` (uncorroborated) | `payload/unbounded-query` — calibrated in Stage 1 |
| Unbounded query returned from a function | — | `large_return_payload` | `payload/large-return` — calibrated in Stage 1 |
| Query result flows into an API response (`res.json`, handler return) with no limit or pagination | — | `large_api_payload` (data-flow tracked) | missing |
| Include/populate nested three or more levels | `deep_nested_include` (fires on any nested object) | — | missing |
| `SELECT *` sent to a database | `select_star` (fires on any string) | — | missing |
| List endpoint with no pagination contract | declared, never implemented | — | missing |
| GraphQL resolver returning an unbounded list | declared, never implemented | — | missing |

Scope, decided 2026-09-24, in the order the work is done:

1. **`payload/api-response`** — the backend's `large_api_payload`, ported.
   Study 09's `missing_pagination` is folded in here: an endpoint without a
   pagination contract is exactly a handler whose response carries an
   unbounded query result.
2. **Query builders** — knex-style chains (`db('t').select(...)`,
   `.where(...)`) with no `.limit()`. Stage 1's biggest false-negative class:
   directus and nocodb report nothing today.
3. **`payload/deep-include`** — `deep_nested_include`, only on a real ORM
   query.
4. **`payload/select-star`** — `select_star`, only when the string reaches a
   database.
5. **`payload/unbounded-graphql`** — a resolver returning a list with no
   pagination arguments. Its own item: it needs the schema and the resolver
   together.
6. **A payload solution generator.**

Stage 2 adds the missing rows to core-engine. The backends stay frozen: when
they switch over to core-engine, `large_api_payload` must already exist there,
or the API loses its most useful payload check.

Every new rule goes through the Stage 1 method, in order:

1. Criteria written before any finding is read (`eval/criteria.md`, a new
   section per rule).
2. Self-scan on `core-engine/src` and the backend.
3. Scan the same 283 pinned repositories. The Stage 1 pruned trees only kept
   files that mention a collection finder, which is not enough for
   `SELECT *` strings, `res.json` handlers or GraphQL resolvers — the trees are
   rebuilt with a wider filter first, and `scripts/check-prune.js` is extended
   to cover the new rules.
4. Label a seeded, stratified sample; fix in rounds; score each round with
   `scripts/eval-round.js`; every fix and every true positive a fix nearly
   lost becomes a regression test.
5. A payload solution generator in `core-engine/src/solutions/`, held to the
   Missing Index standard: the suggestion, applied, removes its own finding.

## Item 1 — `payload/api-response` (done 2026-09-24)

**Not a port.** The backend's `large_api_payload` never fires on the ordinary
handler shapes and throws on the one shape that reaches its data-flow code
(details in `eval/criteria.md`). The rule is written from its intent.

**Single file first.** The response value (`res.json`, `reply.send`,
`c.json`, `ctx.body =`, `NextResponse.json`, Remix `json()`, a Nest route's
return, a tRPC procedure's return) is traced back through awaits, bindings,
object properties, `Promise.all` destructuring and row-keeping chains (`.map`,
`.lean()`, `.toArray()`) to a query call; a bounding chain (`.limit()`) stops
it. A query that reaches a response is reported once, as `api-response`, and
not also as `unbounded-query` or `large-return`. On the 283 repositories this
found 25.

**Then across files.** Most applications query in a repository and send in a
route, in another file — the backend's own `res.json(await
db.getSessionsByUser(id))` included. The engine gained a `finalize()` hook
that runs once every file has been scanned; the payload rules record what
each named function returns and which calls a response depends on, and
`finalize()` links them by name, up to three hops (route → service →
repository). An ambiguous name links only if the receiver names one class
(`this.catsService.findAll()` → `class CatsService`), and otherwise not at all.
The kept source trees were rebuilt with every JS/TS file (`PRUNE_ALL=1`,
472,820 files, 4.1 GB): cross-file linking needs the route files, and every
definition of a name to know whether it is unique. `check-prune.js` on the full
trees reproduces round 0 exactly, 283 of 283.

| Round | api-response findings | tp | fp | unsure | Precision among decided |
|---|---|---|---|---|---|
| 1 (single file + cross-file) | 74 (25 + 49 linked) | 18 | 8 | 48 | 69.2% |
| 2 | 74 | 19 | 6 | 49 | 76.0% |

All 74 were labelled (`eval/api-response-labels.json`); every one of the 49
cross-file links was checked against the endpoint's code, and none was wrong.
Round 2 fixed one class: a call to the application's own method named like an
ORM finder (`oAuthClientRepository.findAll()`, `roleRepository.findAll()`) was
reported as the query and stopped the link. When the scanned code defines that
method and its query is already a finding, the call site is now dropped as a
duplicate and the chain continues to the query. A generic pass-through base
repository whose own query is not a finding (novu's `BaseRepository.find`) is
left alone: the call site is the real query there. The whole corpus goes from
923 to 909 findings; no labelled Stage 1 true positive is lost.

Remaining false positives: filters built in a variable (`where:
envelopeWhereInput` over caller ids), a fixed feature catalogue, a Nest
`integration/` test app, and a service method called `findMany` that paginates
inside with `findPage`.

The backend itself, scanned with these rules: three of its four unbounded
queries now name the endpoint that sends them (`api/database.ts:203` →
`api/routes/session.routes.ts:29`).

## Item 2 — query builders (done 2026-09-25)

**What was missing.** Stage 1's rules only knew ORM finders. Lightdash,
directus and nocodb write their queries with knex and reported nothing. The
builder support recognises knex-style chains (`knex('t')`, `this.database(T)`,
`trx(t)`, `ncMeta.knex(T)`, `knex.select(...).from(...)`), TypeORM's
`createQueryBuilder()` ending in `getMany()`/`getRawMany()`, and Kysely's
`selectFrom()` ending in `execute()`. A chain counts as a query once it is
executed (awaited, returned from an async function, `.then()`-ed, or ended by
a terminal method). It is bounded by a limit, a single-row terminal, an
aggregate, or a where on the table's own key. That limit or where can sit
anywhere on the variable holding a mutable knex builder. Findings are reported
under the existing rules, and under `api-response` when the rows reach a
handler. The title names the builder.

**Round 1** added 589 builder findings to the corpus (909 to 1,501 findings in
all). All 399 sampled findings were labelled (`eval/builders-sample.json`,
`eval/builders-labels.json`, seed 20260925): 35 `tp`, 165 `unsure` and 190
false positives. Nine were Stage 1 findings and are left out. The false
positives came in a few classes, and each class became a fix and a
regression test. A class can overlap another, and `knex.select(knex.raw('1'))`
with no `from()` is now skipped as well:

| Class | Sampled | Example | Fix |
|---|---|---|---|
| Key lookups the rule could not read | 89 (31 of them `const [row] =`) | `const [org] = await this.database(OrganizationTableName).where('organization_uuid', uuid)` | Tables named by constants (`ProjectTableName`, `MetaTable.COMMENTS`) and `${T}.col` template columns are resolved, `<table>_uuid` counts as the table's own key, TypeORM `x.id IN (:...ids)` is read, and `const [row] = await ...` is a one-row read |
| Unexecuted builder factories | 13 | `(knex, filters): Knex.QueryBuilder => knex.from(DashboardsTableName)...` | A non-async function that does not declare a `Promise` returns a builder, not rows. `.toSQL()` does not run a query |
| The same query reported twice | 26 | `const rows = await q;` then `return rows.map(...)` | A variable holding awaited rows is not a builder. `await q.then(...)` is reported once |
| Handle names on other receivers | 12 | MongoDB's `client.db(name)`, metabase's `metadata.database(id)`, Spanner's `instance.database(id)` | Only a bare handle, `this.<handle>` or `<x>.knex` roots a chain |
| Aggregates | 13 | `COUNT(role) ... GROUP BY role`, `ARRAY_AGG(...)`, drizzle's `count()`, Kysely's `eb.fn.countAll()` | An aggregate in a select bounds the rows |
| Migrations the path rule missed | 7 | `db/knex_migrations/`, `migration-scripts/`, `migration-jobs/` | Added to the not-served paths, with knex's `*.test-d.ts` type tests |
| Schema catalogs | 10 | `INFORMATION_SCHEMA.TABLES`, `sqlite_master`, Oracle's `USER_TABLES` | Catalog tables grow with the schema, not the data |

One fix went too far and was pulled back before scoring. Resolving
`${SpaceTableName}.space_uuid` as a key made "every dashboard in one space"
look like a key lookup: the column belongs to the joined table. A qualified
column on another table, or a TypeORM `user.id` on a builder rooted at
`friend`, is now a join's key and does not bound the query.

| Round | Builder findings | Findings in all | tp | fp | unsure | Precision among decided (sample) |
|---|---|---|---|---|---|---|
| 1 | 589 | 1,501 | 35 | 188 | 164 | 15.7% |
| 2 | 323 | 1,227 | 31 | 45 | 130 | 40.8% |
| 3 | 294 | 1,198 | 31 | 29 | 131 | 51.7% |

(The fp and unsure counts are after deduplicating samples that share a line.)

Four sampled `tp` labels are no longer reported at their labelled line.
Three of them are the `return rows.map(...)` half of a duplicate: the query is
still reported, at its own line (SlackChannelCacheModel.ts:358,
ProjectModel.ts:1511 and :1685). Counting those, round 3 is 34 of 63, or
54.0%. The fourth, SchedulerModel.ts:1241, is a real miss. The builder there
only gets a key filter when the caller passes ids, and the rule treats a
conditional bound as a bound, as the criteria decided before any finding was
read. No labelled Stage 1 or `api-response` true positive is lost; both stay
at 54.1% and 76.0%.

**What is left.** Of the 29 remaining false positives:

- 10 are an `IN` over a list the caller passes, on a column that is not the
  key (emails, timestamps, yaml references). The rows are bounded by the list,
  but only a unique column says so.
- 9 are ORM source code (TypeORM, MikroORM, strapi's database package).
- 4 are lookups by a unique column other than the key (a code hash, an email).
- 3 are not served (a CLI command, a startup check, a Nest test app).

The `unsure` count is the real limit on this estimate: 131 of the 191
still-reported sampled findings. Most are a tenant's configured items or rows
under one parent (an agent's tool calls, a prompt's artifacts), whose size
nothing in the code caps.

## Item 3 — `payload/deep-include` (done 2026-09-24)

**What Study 09 measured.** `deep_nested_include` fired on any call whose
first argument nested three objects deep. On the 283 repositories that is
16,428 findings in 123 repositories. Stage 1's check found that about 28% of
them (35 of 127 sampled) are database calls at all. Nesting three objects
deep is not the same as loading three relations: `where: { meta: { path: {
equals } } }` is three objects and no relation.

**The rule.** It counts relations, per ORM:
- Prisma: `include`, or a `select` entry that has its own options.
- Drizzle: `with`.
- Sequelize: `include`.
- TypeORM: `relations`.
- MikroORM: `populate`.
- Mongoose: nested `populate`.
- Objection: relation expressions.

It reports a query whose deepest relation path is three or more. That is a
separate claim from `unbounded-query`: one call can carry both. The criteria
(`eval/criteria.md`) were written before any finding was read. They ask one
more thing of a true positive: at least one relation in the tree is to-many,
with no row limit of its own, and grows with use.

**Round 1** found 84, in 7 repositories: cal.com, trigger.dev, documenso, n8n,
strapi, tooljet and outline. That is fewer than 400, so all 84 were labelled
(`eval/deep-include-sample.json`, `eval/deep-include-labels.json`). For the
Prisma repositories the labels used each relation's cardinality from the
`schema.prisma` at the pinned commit. The result was 43 `tp`, 28 `unsure`,
10 `fp-to-one` and 3 `fp-shallow`, for 76.8% precision among decided findings.

Two fixes, each with regression tests:

- **Strapi's populate object** mixes relations with their options (`where`,
  `fields`, `filters`, a nested `populate`), and all of them were counted as
  relations. Option keys are now skipped. A nested `populate` descends
  without counting a level.
- **All-to-one trees.** A token's team's organisation's owner is four levels
  and one row. The rule now reads the project's `schema.prisma` files (the
  engine already walks them for the index rules) and, in a `finalize()` pass,
  drops a Prisma tree whose relations all resolve to-one. If the schema lacks
  a field, the finding stays. If there is no schema, every finding stays.
  Models from several schema files are merged by name, not overwritten: trigger.dev
  keeps sample apps with their own `User`. The kept source trees held only
  JS/TS files, so the `schema.prisma` files of the three Prisma repositories
  were added to them at the pinned commits.

| Round | Findings | tp | fp | unsure | Precision among decided |
|---|---|---|---|---|---|
| 1 | 84 | 43 | 13 | 28 | 76.8% |
| 2 | 72 | 43 | 1 | 28 | 97.7% |

No true positive is lost, and no other rule's findings change. The one
remaining false positive is outline's Sequelize include. Its three levels are
joins for filtering: `attributes: []` at every level, with every to-many
filtered to the current user.

Study 09's detector reports 60 of the 72 at the same line, among its 16,428.
The other 12 are shapes it never saw: TypeORM `relations` arrays, MikroORM
paths, Mongoose chains and relation expressions.

As in the other items, `unsure` sets the limit: 28 of 72. These trees reach
a to-many that is few by usage but uncapped in code: a user's credentials, a
project's environments, a booking's attendees.

## Item 4 — `payload/select-star` (done 2026-09-25)

**What Study 09 measured.** `select_star` matched `SELECT\s+\*\s+FROM` in
any string or template literal: 2,201 findings in 49 repositories. Stage 1's
sample found 6 of 17 were database calls at all.

**The rule.** A `SELECT *` or `SELECT t.*` string is only reported when it
reaches a database call. The string can be passed directly, or through a
`const` in the same function or at module level. Recognised calls are:

- `query`, `raw`, `execute`, `exec`, `unsafe`, `prepare`;
- Prisma's `$queryRaw` and `$queryRawUnsafe`;
- pg-promise's result methods;
- sqlite's `all`, `get` and `each`, only with the SQL as their first argument;
- a `sql` tagged template.

Two shapes are excluded because no row comes back to the application:
`EXISTS (SELECT * ...)` and `IN (SELECT * ...)`, and `INSERT/CREATE ...
SELECT *`. A knex or ORM query with no column list also sends `SELECT *`, but
it is out of scope, as the Stage 2 plan decided. Whether the caller needed
every column is not judged; the criteria explain why.

**Round 1** found 151, in 20 repositories. All were labelled
(`eval/select-star-sample.json`, `eval/select-star-labels.json`): 32 `tp`,
99 `fp-not-served`, 11 `fp-not-a-query`, 7 `fp-not-returned` and 2
`unsure`. Precision among decided findings was 21.5%. Two fixes followed, each
with regression tests.

**Fix 1: the not-served path rule missed hyphenated test and sample
directories.** Sentry's `dev-packages/e2e-tests/test-applications/` alone
accounted for 30 findings, and logto's `alterations/` (its migrations) for 47.
The rule now skips:

- a directory whose name starts with `e2e-`, `test-`, `testing-`, `sample-`
  or `example-`;
- a directory whose name ends in `-e2e`, `-tests`, `-samples` or `-examples`;
- `*-test-utils/`, `*-testing-shared/` and similar;
- `test-helpers.ts` and `test-utils.ts`;
- `.scripts/`, `alterations/` and `references/`.

The rule applies to directories only, so n8n's served
`evaluation.ee/test-runs.controller.ee.ts` is still read. A name that merely
contains "test" is also still read, such as novu's served
`usecases/build-test-data/`. An earlier, looser version of the rule dropped
both, and the rescan caught them. Both are now regression tests.

**Fix 2: `FROM (subquery)` and `FROM fn(...)`.** In these, the columns belong
to a subquery, `unnest()`, or a function such as graphile-worker's
`add_job()`, not to a table.

| Round | Findings | tp | fp | unsure | Precision among decided |
|---|---|---|---|---|---|
| 1 | 151 | 32 | 117 | 2 | 21.5% |
| 2 | 50 | 32 | 16 | 2 | 66.7% |

No true positive is lost. The path rule is shared by every payload rule, so
every label set was rescored:

- no labelled true positive is lost in any of them;
- their precision is unchanged;
- one unlabelled finding moved from `large-return` to `api-response`: n8n's
  `getProjectRelations`, now linked to its controller, because a now-excluded
  test helper no longer shares its method name.

Of the 32 true positives, 11 read a system catalog (`information_schema`,
`sqlite_master`, `v$version`). Those columns are fixed, so the "grows when a
column is added" half of the claim does not apply to them. The 16 remaining
false positives:

- 10 are database-library source (TypeORM's query runners, the Cosmos SDK,
  Payload's Drizzle adapter);
- 4 are CLI tools and a dev-build smoke query;
- 2 are an outer `SELECT *` over CTEs that already chose their columns.

Study 09's detector reports 44 of the 50 at the same line, including 31 of
the 32 true positives, among its 2,201.

## Item 5 — `payload/unbounded-graphql` (done 2026-10-02, no findings in this corpus)

**What Study 09 had.** `unbounded_graphql` was declared and never
implemented: its detector has no code for it.

**The rule** reports a query whose rows a GraphQL resolver returns with no
row limit. It is `api-response` for GraphQL, and it uses the same tracing,
including the cross-file pass. These count as resolvers:

- Nest `@Query` / `@ResolveField` and type-graphql `@FieldResolver`. Nest's
  two decorators moved here from the `api-response` route list.
- Functions in a resolver map, an object with a `Query` or `Mutation` key.
- `resolve` in a field config that names its `type` (graphql-js, Pothos,
  Nexus).
- The default export of a module under `resolvers/<Type>/`, the
  one-resolver-per-file layout Reaction Commerce uses.

A query reached by both a REST route and a resolver is reported as
`api-response`. Eighteen regression tests cover the shapes above, the bounded
cases (pagination arguments passed as `take`, a single row by id, a DataLoader
batch over its keys) and the cross-file link. A resolver's return value is
also treated as executed for query builders, because the GraphQL executor
awaits it.

**Result: 0 findings on the 283 repositories.** Nothing else changed either:
the round matches item 4's finding for finding (`results/rounds/s2-graphql.json`).
That is the corpus, not a silent rule. Of the files that define GraphQL
resolvers, most are GraphQL libraries' own source (postgraphile, nexus,
graphql-js, typegraphql, nest, apollo-client) and their example directories,
which the not-served rule skips. The applications are few:

- **Reaction Commerce** has dozens of resolvers. They paginate through
  `getPaginatedResponse`, or are bounded by id lists. They also read MongoDB
  through `context.collections.Shops.find(...)`, which the Stage 1 finder rules
  do not recognise as a query. That is a Stage 1 false-negative class: the
  cross-file link has no finding to land on.
- **cypress**'s data context resolves from files and the cloud API, not a
  database.
- **strapi**'s and **directus**'s GraphQL layers are generic services over
  their own item APIs, which carry default limits.

Precision cannot be measured with no findings. Calibrating this rule needs a
corpus with GraphQL applications in it; that is a scoping decision, not part
of this item.

## Item 6 — payload solution generator (done 2026-10-02)

**The standard** is the Missing Index one: paste the suggestion over the
query, scan again, and the finding is gone. The four row-limit rules
(`unbounded-query`, `large-return`, `api-response`, `unbounded-graphql`) now
carry the query exactly as written in `codeBefore`. The suggestion
(`core-engine/src/solutions/payload-generator.ts`) is that query with a row
limit, in the form its library takes:

| Library | Suggestion |
|---|---|
| Prisma | `findMany({ ..., take: 100 })` |
| Drizzle (relational) | `db.query.x.findMany({ ..., limit: 100 })` |
| Sequelize | `findAll({ ..., limit: 100 })` |
| TypeORM repository / EntityManager | `find({ ..., take: 100 })`, `manager.find(E, { ..., take: 100 })` |
| MikroORM | `em.find(E, where, { ..., limit: 100 })` |
| Mongoose, MongoDB driver | `.find(filter).limit(100)` |
| knex | `....limit(100)`, including a chain continued from a variable |
| TypeORM query builder | `.take(100).getMany()`, `.limit(100).getRawMany()` |
| Kysely | `.limit(100).execute()` |

When the library cannot be told from the code, it returns nothing. A
`find()` on an application's own repository (novu's `BaseRepository`,
Kibana's saved objects client) takes whatever option name that wrapper
defines, and a guessed `take` it ignores would look like a fix and change
nothing. Two rules get no suggestion, on purpose:

- **`deep-include`:** a per-relation `take` bounds the rows but not the depth
  the rule counts.
- **`select-star`:** naming the columns needs the schema and every use of the
  result.

**A cap, not pagination.** A fixed limit changes behaviour: rows past the
first 100 stop coming back. The explanation says so and rates the risk
`medium`. It also names the next step for each kind of finding:

- **an endpoint:** a page size and cursor from the request;
- **a GraphQL field:** pagination arguments;
- **a job that needs every row:** looping over pages.

**Checked on the corpus.** `scripts/check-solutions.js` applies the generator
to every row-limit finding of the latest round. For each one it pastes the
suggestion into the real file, checks that the file still parses, and scans
it again.

| Row-limit findings | With a suggestion | Finding gone after applying it | Still reported | New parse errors |
|---|---|---|---|---|
| 1,198 | 1,092 (91.2%) | 1,092 | 0 | 0 |

(`results/rounds/s2-solutions.json`.) The first version covered 1,042. Five
shapes found on the corpus were added, each as a regression test:

- Prisma on a private class field (`this.#prismaClient`);
- `this.knex.select().from()`;
- a knex or TypeORM chain run from a variable, where the rule's title says
  which builder it is;
- a `getCollection()` MongoDB getter;
- TypeORM's transaction manager `trx.find(E, ...)`.

The 106 left without a suggestion:

- 89 are `find` calls on application wrappers and on ORM source;
- 11 end in `execute()` on a builder the generator does not know, mostly strapi's own;
- 6 are other shapes.

On the labelled true positives, 104 of 109 get a suggestion: 54 of 59 in the
Stage 1 sample, 31 of 31 in the builder sample, and 19 of 19 in the
api-response set.

## Reproduce

```bash
# once: build core-engine, and Study 09's detector as CommonJS
cd code-evolution-lab/packages/core-engine && npm install && npx tsc -p .
cd empirical-study/studies/09-large-payloads && npm install && \
  npx tsc src/step3-static-analysis/detector/payload-detector.ts \
    --outDir old-js --module commonjs --target es2020 --esModuleInterop --skipLibCheck

cd empirical-study/stories/03-large-payloads
export CORE_ENGINE=<core-engine>/dist/index.js \
       OLD_DETECTOR=<09-large-payloads>/old-js/payload-detector.js \
       OLD_NODE_MODULES=<09-large-payloads> WORK=/tmp/p09-work KEEP=/tmp/p09-keep

node scripts/scan-all.js --parallel 2       # results/raw/*.json, ~75 min
node scripts/scan-all.js --prune-only        # rebuild the pruned trees only
node scripts/summarize.js <09>/results/prevalence-2026-05-05T01-14-50-634Z.json
node scripts/rescan.js results/rounds/final.json   # any core-engine build
node scripts/eval-round.js results/rounds/final.json
node scripts/eval-round.js results/rounds/s2-builders-r3.json eval/builders-sample.json eval/builders-labels.json
node scripts/eval-round.js results/rounds/s2-builders-r3.json - eval/api-response-labels.json
RULE=payload/deep-include node scripts/eval-round.js results/rounds/s2-deep-include-r2.json \
  eval/deep-include-sample.json eval/deep-include-labels.json
RULE=payload/select-star node scripts/eval-round.js results/rounds/s2-select-star-r2.json \
  eval/select-star-sample.json eval/select-star-labels.json
node scripts/check-solutions.js results/rounds/s2-graphql.json results/rounds/s2-solutions.json
node scripts/estimate.js results/rounds/final.json
```

`results/raw.tar.gz` holds one JSON per repository with both detectors'
findings; extract it first (`tar xzf results/raw.tar.gz -C results`). The
extracted `results/raw/` is gitignored. Source lines in it are truncated to 200
characters. The pruned trees are third-party source and are not committed.
