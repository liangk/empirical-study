# Scaffold: the "does this detector actually help?" report

## Read this first: this is a different article from the one already drafted

`n-plus-1-query-application-report.md` currently opens with *"Our N+1 Detector Had a
60% False-Positive Rate."* That article answers **"can I trust this tool?"** It's a
good article and the honesty is an asset. But it is not the article that shows the
detector helps, because the reader's first impression is that the tool was broken,
and the strongest evidence in it is evidence about our own bug-fixing.

The report below answers a different question: **"what does this thing find in real
code, and what is that worth?"** The accuracy work doesn't disappear — it moves to a
trust section two-thirds in, where it does its real job of making the findings
credible rather than being the headline.

Recommendation: **ship both, as a pair.** This one first (it's the one people search
for), the methodology one second, cross-linked. If you only want one article, fold
the trust section down to ~300 words and link the raw data instead.

---

## Target shape

- 2,200–2,800 words
- 5 case sections, each anchored on one repository
- Every claim traceable to `results/` or `results/expanded-corpus/`
- Voice per `stackinsight-study`: "I" throughout, declarative, no bullet-list
  "what this tells you" sections — prose after every table

---

## Section-by-section

### Opening (3–4 sentences, before the first `---`)

Lead with the scale and the verification, because the verification is what makes
the scale mean anything. Draft numbers:

> I pointed our N+1 Query Detector at 28 open-source repositories — around 7,000
> files of real application code across Prisma, Sequelize, TypeORM, Mongoose and
> Kysely. It reported 213 N+1 patterns. I read the source behind every single one:
> all 213 were real.

No blockquote in the actual article. No mention of the false-positive history here.

**Have it:** yes. 213 findings, 28 repos, all verified.

---

### The Pattern

What an N+1 is and why it survives code review. Keep it to ~150 words — reuse the
existing draft's version, it's already right. The `for (const mention of mentions)`
example with "with 5 mentions nobody notices, with 5,000 you've turned one job into
5,000 round trips" is the whole argument in two sentences.

**Have it:** yes, reusable as-is.

---

### What I Found

The aggregate table. This is the section that establishes "this is not a toy."

| | |
|---|---|
| Repositories scanned | 28 |
| Repositories with at least one finding | 19 |
| Confirmed N+1 patterns | 213 |
| Critical severity | 15 |
| Worst single finding | 5 queries per row (AFFiNE migration) |

Then 3–4 sentences of prose: the spread across ORMs, the fact that findings cluster
(one root cause producing 27 findings in outline), and the 43% sitting in jobs,
scripts and migrations — code that rarely gets profiled.

**Have it:** yes. Full breakdowns are computed at the end of this scaffold, ready
to paste.

---

### 1. outline: one mistake, twenty-seven times

The systemic case, and the strongest argument for automation over code review. All
27 findings trace to one habit in the notification pipeline: resolve recipients by
looping and calling `findByPk` per entry. It repeats across seven files written at
different times by different people.

The argument to make explicitly: a reviewer sees one diff and one file. This is only
visible when something reads all seven at once. That's the whole value proposition
and this case makes it without having to assert it.

Include the 3-query nested loop (301 queries per 100 group members) as the worst
instance.

**Have it:** yes, `results/outline-outline.json`.

---

### 2. immich: a function named `deleteBulkMetadata` that isn't bulk

The self-evident case. Show the code, say nothing clever. Its job in the article is
to make the reader trust their own eyes before you ask them to trust the tool — no
ORM knowledge needed to see it.

Forward hook into case 3: this one a human would have caught eventually. The next
one, most tools structurally cannot.

**Have it:** yes.

---

### 3. cal.com: the half of N+1 that read-focused tools miss

The write-side case. One `UPDATE` per group inside a transaction — and eleven lines
later, the same function uses `deleteMany`. The team knows the batch form; the
update path just never got it.

Point worth making: most N+1 discussion and most tooling is about reads (`findMany`
in a loop). A write N+1 costs the same round trips and gets discussed far less.
Four of cal.com's seven findings are writes.

**Have it:** yes.

---

### 4. AFFiNE: five queries per row, in a migration

The severity case. Shows the ranking doing work — this is where "critical" is
earned. A migration that runs `findFirst`, `findFirst`, `deleteMany`, `update`,
`update` per document row. Migrations get written once, run on production data, and
reviewed less carefully than request handlers.

**Have it:** yes — `results/held-out/toeverything_AFFiNE.json`, finding at
`data/migrations/1698398506533-guid.ts:25`, critical, five queries per row. The
held-out results are now published alongside the rest.

---

### 5. prisma-examples: the pattern in the vendor's own examples

The rhetorical closer. 28 of 29 findings are the same seed script copied across
example apps: `for (const u of userData) { await prisma.user.create({ data: u }) }`.

Be fair here — small N, intentional, nobody's production path. The point isn't that
Prisma did something wrong. It's that this shape is so normal it reproduces itself
into the canonical examples people learn from. That's *why* it's everywhere in the
other 27 repos.

**Have it:** yes.

---

### The Cost

**Done — measured, not estimated.** Full methodology, raw data and harness in
`benchmark/`. The workload is a faithful reduction of outline's notification
pipeline in Sequelize against real PostgreSQL 16.

Query counts confirmed by a logging hook: N+1 issues exactly N queries, the fix
issues 1. The detector's arithmetic was right.

Headline table for the article — same code, same data, only the database distance
changes:

| Recipients | Local socket (0.23ms/query) | Managed DB (2.75ms/query) | Managed DB (5.04ms/query) |
|---:|---|---|---|
| 100 | 35ms → 1.1ms (32x) | 316ms → 4ms (79x) | 538ms → 6ms (88x) |
| 1,000 | 233ms → 6.8ms (34x) | 2,921ms → 52ms (57x) | 5,115ms → 52ms (98x) |

The argument to build the section on: **an N+1 is a latency amplifier, so its cost
scales with how far away the database is.** The same loop costs 233ms on a laptop
and 5.1 seconds in production. That's why this never gets caught locally — the
environment where it's cheapest to observe is the one developers work in.

Two supporting findings worth their own paragraphs:

- **Parallelising doesn't fix it.** `Promise.all` takes 5,115ms down to 553ms, but
  it still issues 1,000 queries and it's still 10x slower than batching. It
  converts a latency problem into a capacity problem.
- **Concurrency is where it bites.** 25 notification jobs at once: 2,500 queries
  versus 25. The database does a hundred times the work for the same result.

Use the 100-recipient row as the lead number, not the 1,000 one. A document with
100 mentions is ordinary; 1,000 invites "that would never happen to us".

### The Fix

The generated solution output. Pull a real one from the JSON rather than describing
it: collect ids, one batched query, build a lookup map, loop against the map. Show
the actual generated code for the outline case, plus the Sequelize `include`
alternative it ranks second.

Keep it short. The fix is not the interesting part — finding all 213 places that
need it is.

**Have it:** yes, every finding in the JSON carries its solutions.

---

### Can You Trust These Numbers

Compressed trust section, ~300 words. Three claims, each one checkable:

1. Every finding was verified by reading the source. 213 of 213 genuine.
2. The scoring harness and the labels ship with the study — rerun
   `node eval/score.js results` and get the same numbers.
3. The detector carries a 43-case regression suite built from this corpus, so the
   accuracy is pinned, not a snapshot.

Then one honest paragraph: we measured precision hard, recall lightly. We know what
it reports is real; we have not established what it misses. Link the methodology
article for the full seven-round story.

Do not bury the 60% history — reference it in one sentence and link. Hiding it
would be worse than leading with it.

**Have it:** yes.

---

### Detection

The command, the scopes, the ~130 files/second throughput (412 files in 3.2s
measured). Worth stating plainly: scanning all 28 repositories takes under a minute,
which is the economic argument in one line — this is not a thing you budget time
for, it's a thing you run.

**Have it:** yes, measured.

---

### Caveats

- 28 repositories, not a random sample — weighted toward a Prisma corpus from an
  earlier study.
- Precision measured hard; recall not established.
- Counts are static analysis, not measured latency (delete this bullet once The
  Cost section exists).
- Nine repositories were excluded because they use an ORM the detector doesn't
  support — say which, and say that "0 findings" would have been misleading.

**Have it:** yes.

---

## Numbers already computed, ready to drop in

Recomputed from the published JSON across all three passes (`results/*.json`,
`results/held-out/`, `results/expanded-corpus/`):

**Scale**

| | |
|---|---|
| Repositories scanned | 28 |
| Repositories with at least one finding | 19 |
| Confirmed N+1 patterns | 213 |
| All verified by hand | yes |

**Severity**

| Severity | Findings |
|---|---:|
| Critical (3+ queries per iteration) | 15 |
| High (2 queries) | 32 |
| Medium (1 query) | 166 |

**By ORM or driver** (a finding with two ORMs in one loop counts under both)

| Layer | Findings |
|---|---:|
| Prisma | 114 |
| Generic database handle (`db.*`, `tx.*`) | 52 |
| Sequelize | 25 |
| Repository layer | 17 |
| Raw SQL | 5 |
| SQL builder (Kysely) | 3 |

**Where they live** — this is the number that supports the "nobody profiles these
paths" argument, so use it rather than asserting it:

| Location | Findings | Share |
|---|---:|---:|
| Request handlers, routes, services | 79 | 37% |
| Background jobs, queues, workers, cron | 45 | 21% |
| Scripts, seeds, CLI commands | 43 | 20% |
| Other application code | 42 | 20% |
| Migrations | 4 | 2% |

Careful with the framing here. 37% being in request paths is the headline — those
are the ones that hit users directly. But 43% sitting in jobs, scripts and
migrations is the more interesting claim: that's code that rarely gets profiled and
never shows up in an APM trace tied to a slow endpoint.

The five held-out repositories' results are now published at `results/held-out/`,
so case 4 can cite AFFiNE directly: `results/held-out/toeverything_AFFiNE.json`,
11 findings, the migration one is `1698398506533-guid.ts:25` at critical severity
with five queries per document row.

## What to build before writing

The benchmark in The Cost. Everything else is assembly.
