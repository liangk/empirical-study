---
title: "Our N+1 Detector Had a 60% False-Positive Rate. Here's the Fix, Measured."
slug: "n-plus-1-query-detector-application-report"
description: "We scanned 45 open-source repositories with Code Evolution Lab's N+1 Query Detector and hand-checked every finding. 60.3% were false positives. Seven rounds of fixes took that to 0% across 28 repositories and surfaced over a hundred real N+1s the detector had been missing."
date: "2026-09-17"
author: "Ko-Hsin Liang"
---

I built the N+1 Query Detector to catch one specific mistake: fetching a related
record once per item in a loop instead of once for the whole batch. To find out
whether it works on real code, I scanned 45 open-source repositories and read every
single finding against its source.

60.3% of them were wrong.

That number is the reason this article exists. What follows is what the detector
got wrong, why, the seven rounds of fixes that took the false-positive rate to 0%
across 213 findings in 28 repositories, and the hundred-plus genuine N+1 patterns
the original detector had been silently missing the whole time.

## The Pattern

An N+1 query happens when code fetches a list of N items, then loops over that list
making one more database call per item — N+1 round trips where one would do. It's
one of the oldest performance bugs in web development and one of the easiest to
introduce, because the code reads perfectly naturally:

```ts
for (const mention of mentions) {
  const recipient = await User.findByPk(mention.modelId);
  // ...
}
```

Nothing about that looks wrong in review. With 5 mentions nobody notices. With
5,000 you've turned one job into 5,000 sequential round trips.

## Building the Repository List

I reused the 40-repository Prisma corpus from our Missing Index study, then added
five more chosen to cover the ORMs the detector recognises but that corpus barely
touched: Sequelize, TypeORM, Mongoose, and Kysely-style query builders. 45
candidates, of which 9 produced findings. Three became the study set — outline
(Sequelize), cal.com (Prisma), immich (Kysely) — and five were held back, untouched,
to check the fixes later.

## What the First Run Got Wrong

78 findings across the three study repositories. 31 real. Here is what the other 47
looked like:

```ts
const translations = new Map();
const t = translations.get(locale);        // "database query in a loop"

const credential = credentials.find((c) => c.id === calendar.credentialId);
                                           // "Mongoose.find() in a loop"

await Promise.all(items.map(...));         // "database query in a loop"
```

A `Map`. An array search. `Promise.all`. The detector identified a database call
partly by method name — `.get`, `.find`, `.all`, `.execute` — and when a file had no
recognisable ORM import, it trusted that guess with no confirmation whatsoever. Any
`.get()` in any loop in any file that didn't import Prisma by its exact package name
became an N+1 query.

That last detail is why cal.com scored worst of the three: it imports its client
from `@calcom/prisma`, a workspace package. The import matcher looked for `prisma`
or `@prisma/client` exactly, found neither, concluded "no ORM here," and then
proceeded to guess anyway on every method name it recognised. 19 of its 22 findings
were noise.

And then the other half of the problem, which I only found because I was reading
every line anyway: the detector's method list contained nothing but read methods.
A loop issuing one `UPDATE` per item — exactly as expensive as a read N+1 — was
invisible to it. It was noisy *and* half-blind.

## Making "Better" Measurable

Before changing anything I wrote down the ground truth: every loop location across
the three repositories where a real per-item database call happens, each confirmed
by reading the source, with a recorded reason for every location I rejected. 42
genuine findings. Then a scoring script that takes any scan output and reports
false-positive rate and recall against that list.

This matters more than it sounds. Without it, "reduce false positives" has an
obvious cheap solution — report less — and no way to notice you've broken detection
in the process. With it, every round is a number.

## Seven Rounds

| Round | Change | Raw | Genuine | FPs | FP rate | Recall |
|---|---|---:|---:|---:|---:|---:|
| Baseline | — | 78 | 31 | 47 | 60.3% | 73.8% |
| 1 | Method names split into distinctive and ambiguous; ambiguous ones need real evidence. Write methods added. | 53 | 42 | 11 | 20.8% | 100% |
| 2 | Scan loop bodies only; assign each query to its innermost loop; treat buffered bulk writes as bulk. | 43 | 42 | 1 | 2.3% | 100% |
| 3 | Skip `for(;;)` and `while (true)` retry loops. | 42 | 42 | 0 | 0.0% | 100% |
| 4 | Skip fixed-window paging loops; promote `findOne` to distinctive. | 42 | 42 | 0 | 0.0% | 100% |
| 5-7 | Driven by the expanded corpus below: skip bounded retry loops and `while (hasMore)` batch loops, ignore Firestore staged writes, decide "batch loop" from how the collection was built rather than its name, and skip queries that consume the whole iterated item. | 42 | 42 | 0 | 0.0% | 100% |

The central change is round 1. `findUnique`, `findByPk`, `findAndCountAll` and
friends don't exist on `Map`, `Array`, or `Promise` — seeing one is evidence by
itself. `find`, `get`, `all`, `execute`, `update` are everywhere in ordinary
JavaScript, so those now require something else to corroborate them: an ORM import,
a SQL-builder chain like `tx.deleteFrom(...).where(...).execute()`, a receiver named
`prisma`/`db`/`tx`, or a repository-shaped receiver like `userRepository`. Plus
hard vetoes: `Promise` is never a database, a variable initialised with `new Map()`
is never a database, and `.find(callback)` is `Array.prototype.find` — an ORM finder
takes a filter object, never a callback.

Round 2 fixed two structural mistakes rather than naming ones. The detector counted
the query that *produced* the collection as a query *inside* the loop, so
`(await Attachment.findAll(...)).map(...)` reported itself. And in nested loops it
reported the same single N+1 once per enclosing loop. Scanning only loop bodies and
assigning each query to its innermost loop removed both.

Rounds 3 and 4 are the same idea applied twice: a loop with no collection has
nothing to batch. A `for(;;)` retrying until a generated subdomain is unique isn't
an N+1. Neither is `for (let i = 0; i < ids.length; i += PAGE_SIZE)`, which is the
fix for N+1, not an instance of it.

Recall going from 73.8% to 100% is the part I didn't expect to be writing about.
The fixes didn't just remove noise — they surfaced 11 genuine problems the original
detector never reported.

## The Ones It Had Been Missing

All four of cal.com's new findings are write-side N+1s:

```ts
// packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts
for (const group of groupsToUpdate) {
  await tx.hostGroup.update({
    where: { id: group.id },
    data: { name: group.name },
  });
}

// ... and eleven lines later, in the same function:
await tx.hostGroup.deleteMany({ where: { id: { in: ... } } });
```

One `UPDATE` per group, awaited sequentially inside a transaction — and the very
next block in the same function uses `deleteMany`. The codebase already knows the
batch form. It just isn't used on the update path.

Immich contributed six, including this one, which needs no commentary at all:

```ts
// server/src/repositories/asset.repository.ts
async deleteBulkMetadata(items: Array<{ assetId: string; key: string }>) {
  await this.db.transaction().execute(async (tx) => {
    for (const { assetId, key } of items) {
      await tx.deleteFrom('asset_metadata')
        .where('assetId', '=', assetId)
        .where('key', '=', key)
        .execute();
    }
  });
}
```

The method is called `deleteBulkMetadata`. It deletes one row at a time.

## What Outline Looks Like Now

27 findings, all genuine, and they all trace back to one architectural seam.
Outline fires a background job per event — someone mentioned you, a document
published, a comment posted — and each job resolves "who needs to be notified" by
looping over mentions or group members with a `findByPk()` per entry. The worst
instance nests three: `Group.findByPk()`, then `GroupUser.findAll()`, then
`User.findByPk()` per member. 301 queries for 100 mentioned group members.

The same shape repeats across seven files. Background jobs are where this survives
longest — it never shows up in a page-load benchmark, it shows up as a queue that
inexplicably falls behind when someone comments on a busy document.

## Held-Out Validation

A 0% false-positive rate on the repositories you tuned against proves nothing. So I
ran the same before/after on five repositories I'd held back, and hand-checked every
finding:

| Repository | Before | After | Genuine | False positives |
|---|---:|---:|---:|---:|
| toeverything/AFFiNE | 26 | 11 | 11 | 0 |
| twentyhq/twenty | 18 | 9 | 9 | 0 |
| civitai/civitai | 18 | 2 | 2 | 0 |
| novuhq/novu | 30 | 1 | 1 | 0 |
| medusajs/medusa | 3 | 0 | 0 | 0 |
| **Total** | **95** | **23** | **23** | **0** |

Same two-sided result. AFFiNE's wall of `Map.get()` noise is gone, and in its place
are eleven real ones the old detector never found — including a migration that
issues five queries per document row, and an invite handler that looks up every
email address separately. Medusa going to zero is the correct answer: all three of
its original findings were `Map.get()` and `Array.find()`.

## The Rest of the Pool

Eight repositories is a small corpus, and 20 of my original 45 candidates had never
really been scanned — the first pass located application code by finding
`schema.prisma` and walking up to the nearest `package.json`, which lands on
schema-only packages, misses every non-Prisma repository, and gives up on anything
over the file cap. With a detector I now trusted, I went back for them.

First I triaged which ones the detector could even say something about. Nine were
excluded before scanning: Drizzle codebases (openstatus, uploadthing,
AnswerOverflow, create-t3-turbo), a Rails app, an Elixir app, a Django app. Saying
"zero findings" for those would imply the detector looked. It wasn't going to.

The remaining 20 got a real server-code scope each, and I ran both detector
versions over identical files:

| | Original | Fixed |
|---|---:|---:|
| Findings across 20 repositories (5,862 files) | 341 | 148 |
| Confirmed genuine | — | 148 |
| False positives | — | 0 |

Two of them are worth singling out.

**prisma/prisma-examples went from 0 findings to 29.** Twenty-eight are the same
seed script copied across example apps:

```ts
for (const u of userData) {
  const user = await prisma.user.create({ data: u })
}
```

Small N, intentional, nobody's production path. Also: the canonical N+1 shape, in
the ORM vendor's own examples, invisible to a detector that only looked at reads.

**trigger.dev went from 91 findings to 13.** The 13 are real — per-item `upsert`,
`findFirst` and `create` calls in worker and environment-variable code. Most of the
78 that vanished were `Map.get()`. The rest were neverthrow's
`fromPromise(...).map(...)`, a monadic `map` the original detector counted as a
loop.

This pass also cost me three more rounds of fixes, because a bigger corpus contains
failure modes a smaller one doesn't: bounded retry loops
(`while (retries <= MAX_RETRIES)`), flag-driven batch loops
(`while (hasMore) { deleteMany(...) }`), Firestore's staged `transaction.delete()`,
a plain `Map` that happened to be named `repositories`, and chunked queries shaped
like `where: { id: { in: batch } }`.

The last one taught me something I'd have got wrong by instinct. `in: batch` is
batching — one query per chunk of rows. But `in: workspace.typebots.map(t => t.id)`
is *not*: that's still one query per workspace, batched only over that workspace's
children. My first attempt at the rule suppressed both, and the scoring harness
caught it by dropping a finding I'd already verified as real. Which is the whole
argument for keeping the harness: three rounds after I thought I was finished, it
was still the thing telling me when a fix had gone too far.

## Detection

```bash
node dist/cli.js "server/queues/**/*.{js,ts}" \
  --format json --solutions --min-severity low
```

Every step in this report is reproducible with the public, free-tier build,
including the scoring harness — the ground-truth labels and the script that turns a
scan into a false-positive rate are both published alongside the raw JSON.

## Caveats

45 repositories is not a random sample of the JavaScript ecosystem; it's weighted
toward a corpus assembled for an earlier Prisma study plus repositories I picked for
ORM coverage. I am not claiming the detector has a zero false-positive rate in
general — I'm claiming it had none on 213 findings across 28 repositories, every one
of which I read. Something that pattern-matches on method names and loop shapes will
mislabel code eventually, and rounds 5 through 7 exist precisely because a bigger
corpus found shapes the first eight repositories didn't contain. A twenty-ninth
repository may well find another.

Two more limits worth stating. For the three study repositories I read the full
source file behind every finding; for the other 25 I read the source snippet the
detector captured, and fetched full context only where the snippet left the call
ambiguous. And I measured recall properly only on the study repositories, where I
had built a ground-truth list first — on the wider corpus I can say the detector
stopped reporting things that weren't there, and I checked that everything it
stopped reporting was genuinely not there, but I did not audit 5,862 files for
problems it never mentioned.

I also didn't benchmark the production impact of any of these findings the way our
Blocking I/O study load-tested its patterns. "301 queries where 1 would do" is a
count, not a measured latency. That's the next study, not a claim this one makes.
