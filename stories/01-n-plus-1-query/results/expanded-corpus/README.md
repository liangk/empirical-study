# Expanded-corpus validation

The detector fix was developed against three repositories (outline, cal.com,
immich) and first checked against five held-out ones. This folder holds a third,
larger check: the 20 candidate repositories from the original pool that had never
been scanned properly, run through **both** the original detector and the fixed
one, on identical files.

None of these repositories were looked at while writing any of the detector rules,
so this is an out-of-sample measurement.

## Why these 20 repositories were unscanned before

The first pass located a repository's application code by finding `schema.prisma`
and walking up to the nearest `package.json`. That heuristic failed in three ways:
it found nothing in repositories that use a different ORM, it landed on
schema-only or example packages in monorepos, and it gave up on repositories whose
app package was over the 500-file scan ceiling. So a large slice of the candidate
pool was recorded as "no schema.prisma found", "scope resolution failed", "over the
file cap", or scanned at a scope holding no real application code.

32 repositories went through triage in this pass. 20 came out the other side with a
real server-code scope and were scanned; the other 12 were never scanned. The full
exclusion table, with a reason for each, is in `../../README.md` Step 6.

This pass fixed that in two steps, both recorded here:

1. `orm-triage.tsv` — for every candidate, the JS/TS file count and which ORM
   packages appear anywhere in its `package.json` files. This is what separates
   "the detector found nothing" from "this repository has nothing the detector
   supports". Repositories on Drizzle (openstatus, unkey, create-t3-turbo,
   uploadthing), on a non-JS backend (plausible is Elixir, plane is Django, maybe
   is Rails), or with no ORM package at all (lucia, kirimase, AnswerOverflow) were
   excluded here rather than scanned and reported as zero. Two more (lobe-chat,
   gitroom) are recorded as `CLONE_FAILED`, so their ORM was never established
   either way.
2. Directory-level scoping — for each remaining repository, the sub-package
   holding server or business logic, sized under the cap. Those scopes are listed
   in `../../README.md`.

## Results

`scan-counts.tsv` has the raw numbers: repository, files scanned, findings from
the original detector, findings from the fixed one.

| | Original detector | Fixed detector |
|---|---:|---:|
| Findings across 20 repositories | 341 | 148 |
| Confirmed genuine | 39 | 147 |
| False positives | 302 | 1 |
| False-positive rate | 88.6% | 0.7% |

147 of the 148 were confirmed against the source that produced it. The one that
wasn't is documented below. The per-repository JSON files here contain each
finding's location, severity, the source snippet, and the generated fix.

The headline drop is 193, but that is a net figure, and netting hides what actually
happened. 109 of the 148 findings are new, so only 39 of the original 341 survived
into the fixed run: the fixed detector stopped reporting **302** of them and added
109 back. 302 − 109 = 193.

Those 302 removals are made of:

- ~173 `Map.get()` / `Map.set()` calls read as database lookups
- ~70 `Array.prototype.find()` calls read as `Mongoose.find()`
- 14 `Promise.all(...)` calls read as database queries
- ~21 pagination loops (`while (true) { findMany({ skip, take }) }`) — the batching
  we would recommend, reported as the problem it solves
- 7 bounded retry loops (`while (retries <= MAX_RETRIES)`) — attempts at one
  operation, not items in a collection
- several artifacts where the query *producing* the collection was counted as
  running inside the loop that consumes it

The 109 new findings are locations the original detector never reported,
overwhelmingly write-side N+1s (`create`, `update`, `upsert` once per item) that
its read-only method list could not see.

## Two repositories worth looking at

**prisma/prisma-examples: 0 findings before, 29 after.** 28 of the 29 are the same
seed script repeated across example apps: `for (const u of userData) { await
prisma.user.create({ data: u }) }`. Small N and intentional, but it is exactly the
pattern, in the ORM vendor's own examples.

**triggerdotdev/trigger.dev: 91 findings before, 13 after.** The 13 are real —
per-item `upsert`, `findFirst` and `create` calls in worker and environment-variable
code. The 78 that disappeared were `Map.get()` noise and neverthrow's
`fromPromise(...).map(...)`, a monadic `map` that the original detector counted as
a loop.

## The one false positive

`keystonejs/keystone`'s single finding, at
`packages/core/src/testing/postgresql.ts:27`, is wrong. It is kept in
`keystonejs_keystone.json` because that is what the 2026-09-17 scan reported;
it is excluded from the genuine count.

```ts
for (const candidate of candidates) {
  const client = new Client(configForDatabase(config, candidate))
  try {
    await client.connect()
    await client.query(`CREATE DATABASE ${escapeIdentifier(database)}`)
    return                                   // first success wins
  } catch (error) {
    if (errorCode(error) === '42P04') return // already exists, also done
    lastError = error
  } finally {
    await client.end().catch(() => {})
  }
}
```

Three reasons it isn't an N+1. The loop returns on the first success and on
`42P04`, so at most one iteration does any work — it is a fallback chain, not one
query per item. `candidates` is a fixed, short list of connection configurations,
not a data collection, so the detector's "101 queries for 100 items" estimate
describes a situation that cannot arise. And `CREATE DATABASE` is DDL: there is no
batched form to rewrite it into, which is why the generated `solutions` entry for
this finding is empty (`Pattern type: unknown`, `Method calls: none detected`).

It slipped through because round 3's retry-loop veto keys on counters named
`retry` or `attempt`, and this loop is named after what it iterates. The detector
now also skips a loop whose query result is discarded and which returns in the
same block; that rule is in the corpus tests as
`A fallback chain that returns on the first success`. Re-scanning keystone with
the current rule reports 0 findings.

So this pass is 147 genuine out of 148 reported — a 0.7% false-positive rate, not
0%. Across all three passes it is 1 in 213, or 0.5%.

## Reproducing

The scopes and commands are in `../../README.md`. `../../eval/score.js` scores the
three study repositories against verified labels; the 20 repositories here were
verified by reading each finding's source rather than against a stored label file,
so their numbers are reported, not recomputed by script.
