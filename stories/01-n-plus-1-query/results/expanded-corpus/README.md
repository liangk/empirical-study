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
app package was over the 500-file scan ceiling. So 20 of the 45 candidates were
recorded as "no schema.prisma found", "scope resolution failed", "over the file
cap", or scanned at a scope holding no real application code.

This pass fixed that in two steps, both recorded here:

1. `orm-triage.tsv` — for every candidate, the JS/TS file count and which ORM
   packages appear anywhere in its `package.json` files. This is what separates
   "the detector found nothing" from "this repository has nothing the detector
   supports". Repositories on Drizzle (openstatus, uploadthing, AnswerOverflow,
   create-t3-turbo), on a non-JS backend (plausible is Elixir, plane is Django),
   or with no ORM at all were excluded here rather than scanned and reported as
   zero.
2. Directory-level scoping — for each remaining repository, the sub-package
   holding server or business logic, sized under the cap. Those scopes are listed
   in `../../README.md`.

## Results

`scan-counts.tsv` has the raw numbers: repository, files scanned, findings from
the original detector, findings from the fixed one.

| | Original detector | Fixed detector |
|---|---:|---:|
| Findings across 20 repositories | 341 | 148 |
| Confirmed genuine | — | 148 |
| False positives | — | 0 |

Every one of the 148 was checked by hand against the source that produced it. The
per-repository JSON files here contain each finding's location, severity, the
source snippet, and the generated fix.

The 193-finding drop is not the detector going quiet. It is made of:

- ~173 `Map.get()` / `Map.set()` calls read as database lookups
- ~70 `Array.prototype.find()` calls read as `Mongoose.find()`
- 14 `Promise.all(...)` calls read as database queries
- ~21 pagination loops (`while (true) { findMany({ skip, take }) }`) — the batching
  we would recommend, reported as the problem it solves
- 7 bounded retry loops (`while (retries <= MAX_RETRIES)`) — attempts at one
  operation, not items in a collection
- several artifacts where the query *producing* the collection was counted as
  running inside the loop that consumes it

Meanwhile 109 findings are new — locations the original detector never reported,
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

## Reproducing

The scopes and commands are in `../../README.md`. `../../eval/score.js` scores the
three study repositories against verified labels; the 20 repositories here were
verified by reading each finding's source rather than against a stored label file,
so their numbers are reported, not recomputed by script.
