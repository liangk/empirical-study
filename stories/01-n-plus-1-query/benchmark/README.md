# What an N+1 actually costs: a measured benchmark

Every severity estimate the detector prints is arithmetic — "301 queries for 100
items vs 1 optimal query". True, but it's a count, not a cost. This benchmark turns
the count into milliseconds.

The workload is a faithful reduction of outline's notification pipeline, the source
of 27 of the 213 N+1 patterns in the scan. The real code
(`server/queues/tasks/CommentCreatedNotificationsTask.ts`) resolves notification
recipients like this:

```ts
for (const mention of mentions) {
  const recipient = await User.findByPk(mention.modelId);
  ...
}
```

Same ORM as the original (Sequelize), same shape, against a real PostgreSQL 16.

## What's measured

Three strategies, identical data, identical process:

| Strategy | What it is |
|---|---|
| `n1-sequential` | As found in the wild — one awaited `findByPk` per mention |
| `n1-parallel` | The same N queries fired at once with `Promise.all` — the shape several other findings take, and the usual first instinct when the loop feels slow |
| `batched` | The fix the detector generates — collect ids, one `findAll`, build a `Map`, loop against the `Map` |

Across three recipient counts (10 / 100 / 1,000) and four database distances. The
distances are not simulated numbers: a TCP proxy delays every forwarded chunk, and
the resulting per-query round trip was measured directly
(`results/round-trip-baseline.txt`).

| Condition | Measured round trip per query |
|---|---:|
| Unix socket, same machine | 0.23ms |
| TCP loopback | 0.17ms |
| Proxied | 2.75ms |
| Proxied | 5.04ms |

2–5ms is the normal range for an application talking to a managed database in the
same region. 0.2ms is what you get on a laptop with Postgres running locally, which
is where most people form their intuition about how slow an N+1 is.

## Held constant

- Node v22.22.2, PostgreSQL 16.13, same container, same run
- Sequelize 6.37.8, `pg` 8.23.0
- Connection pool max 10
- 2 warmup runs discarded, then 7 measured runs (5 for the proxied conditions)
- Medians reported; min and max are in the raw JSON
- Identical seeded rows for every strategy; every strategy is asserted to return
  the same recipients

## Queries issued

| Recipients | N+1 sequential | N+1 parallel | Batched |
|---:|---:|---:|---:|
| 10 | 10 | 10 | 1 |
| 100 | 100 | 100 | 1 |
| 1,000 | 1,000 | 1,000 | 1 |

Counted by a Sequelize logging hook, not predicted. The detector's arithmetic is
exactly right: N+1 issues one query per item, the fix issues one.

## 1. On the same machine

| Recipients | N+1 sequential | N+1 parallel | Batched | Sequential vs batched |
|---:|---:|---:|---:|---:|
| 10 | 6.6ms | 2.9ms | 0.8ms | 8.2x |
| 100 | 35.1ms | 18.8ms | 1.1ms | 31.9x |
| 1,000 | 232.5ms | 150.9ms | 6.8ms | 34.2x |

232ms for a background job is survivable, which is exactly the problem: on a
developer laptop with a local database this pattern looks like a minor
inefficiency. Nobody files a ticket over 232ms in a queue worker.

## 2. At database distance

Same code, same data, same queries — only the round trip changes.

At 2.75ms per query:

| Recipients | N+1 sequential | N+1 parallel | Batched | Sequential vs batched |
|---:|---:|---:|---:|---:|
| 10 | 31.0ms | 6.7ms | 3.2ms | 9.7x |
| 100 | 315.8ms | 42.0ms | 4.0ms | 79.0x |
| 1,000 | 2,920.5ms | 409.6ms | 51.6ms | 56.6x |

At 5.04ms per query:

| Recipients | N+1 sequential | N+1 parallel | Batched | Sequential vs batched |
|---:|---:|---:|---:|---:|
| 10 | 54.9ms | 7.8ms | 5.9ms | 9.3x |
| 100 | 537.7ms | 61.6ms | 6.1ms | 88.1x |
| 1,000 | 5,114.7ms | 552.8ms | 52.0ms | 98.4x |

This is the finding that matters. The penalty is not a fixed multiple — it scales
with how far away the database is, because an N+1 is a latency amplifier. Every
millisecond of round trip gets multiplied by N. The same loop that costs 232ms
against a local socket costs 5.1 seconds against a database 5ms away, and the
batched version barely moves: 6.8ms to 52ms.

So the environment where the pattern is cheapest to observe is the development
machine, and the environment where it's most expensive is production. A profiler
run locally will not convince anyone this matters.

## 3. Parallelising doesn't fix it

The instinct when a loop of awaits feels slow is to fire them concurrently. It
helps: at 1,000 recipients and 5ms round trips, `Promise.all` takes 553ms instead
of 5,115ms.

It's still 10x slower than the one-query version, and it still issues 1,000
queries. The work didn't go away — it moved onto the connection pool, where it now
competes with every other request the service is trying to serve. Parallelising an
N+1 converts a latency problem into a capacity problem.

## 4. Concurrent jobs

Outline fires one notification job per comment, so several run at once. 100
recipients each, 2.75ms per query:

| Concurrent jobs | Strategy | Wall time | p95 per job | Queries issued |
|---:|---|---:|---:|---:|
| 1 | N+1, sequential | 316.4ms | 332.9ms | 100 |
| 1 | Batched | 4.0ms | 8.4ms | 1 |
| 5 | N+1, sequential | 360.3ms | 382.1ms | 500 |
| 5 | Batched | 8.3ms | 12.6ms | 5 |
| 10 | N+1, sequential | 331.9ms | 331.8ms | 1,000 |
| 10 | Batched | 8.8ms | 9.0ms | 10 |
| 25 | N+1, sequential | 876.7ms | 888.5ms | 2,500 |
| 25 | Batched | 28.8ms | 27.4ms | 25 |

Latency degrades gently at first — these jobs spend most of their time waiting on
the network, so they interleave on the pool reasonably well until it saturates at
25 jobs against 10 connections.

The number to look at isn't the wall time, it's the last column. Twenty-five
comments posted around the same time means 2,500 queries instead of 25. The
database is doing a hundred times the work to produce the same result, and that
capacity is not available to anything else.

## Reproducing

```bash
cd harness
npm install

# start a local postgres, create the database, then:
LABEL=local-socket PG_HOST=/tmp PG_PORT=5433 node bench.js

# with added distance
node latency-proxy.js 5434 5433 0.5 &
LABEL=proxied PG_HOST=127.0.0.1 PG_PORT=5434 node bench.js

# concurrency
LABEL=concurrent PG_PORT=5434 SIZE=100 JOBS=1,5,10,25 node bench-concurrent.js

# regenerate every table in this file from the raw JSON, with arithmetic checks
node aggregate.js
```

`aggregate.js` recomputes every number above from `results/*.json` and asserts the
query counts, so nothing in this document is hand-typed.

## Caveats

The workload is a reduction, not outline's actual task — it isolates recipient
resolution and leaves out notification creation and email rendering, which are
constant across strategies and would only dilute the comparison.

One process, one machine, one PostgreSQL instance, single table, indexed primary
key lookups. A real production database is under other load, and real tables are
wider.

The latency proxy delays every forwarded chunk rather than modelling bandwidth and
latency separately. That penalises the batched version more than the N+1 version,
because a single query returning 1,000 rows spans more chunks than 1,000 queries
returning one row each. So the measured advantage of batching is, if anything,
understated — the 52ms batched figure at 1,000 recipients would be lower against a
real network.

Medians over 5–7 runs after warmup. Cold starts, connection establishment and
query-plan caching are excluded by the warmup, which flatters both strategies
equally.
