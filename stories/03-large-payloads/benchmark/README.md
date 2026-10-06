# What an unbounded list endpoint costs: a measured benchmark

The detector says a query has no row limit and its rows reach a response. That
is a shape, not a cost. This benchmark puts a number on one true positive from
the scan.

The workload is cal.com's admin user list
(`packages/trpc/server/routers/viewer/users/_router.ts`, labelled `tp` in
`eval/api-response-labels.json`):

```ts
list: authedAdminProcedure.query(async ({ ctx }) => {
  const { prisma } = ctx;
  // TODO: Add search, pagination, etc.
  const users = await prisma.user.findMany();
  return users;
}),
```

Same stack as cal.com at the pinned commit (`46eb533`):

- Prisma 6.16.1, generated from cal.com's own `schema.prisma`, with
  `engineType = "client"` and `@prisma/adapter-pg`, as cal.com runs it
- PostgreSQL 16.13
- superjson 1.9.1, the transformer cal.com's tRPC uses to put a result on the
  wire

## What's measured

| Strategy | What it is |
|---|---|
| `as-found` | `prisma.user.findMany()`: every row, every column |
| `suggested` | `prisma.user.findMany({ take: 100 })`: what core-engine's payload solution generator writes for this finding |

For each run, separately: the query (Prisma, including turning rows into
objects), serialising the result with superjson, the bytes of the response
(and gzipped), and the client parsing it back with superjson. Heap growth
across the request is read with the GC forced before it; it is what the
request allocated, retained or not.

Three table sizes (1,000 / 10,000 / 50,000 users) and three database
distances. The distances are measured, not assumed
(`results/round-trip-baseline.txt`):

| Condition | Measured round trip per query |
|---|---:|
| Unix socket, same machine | 0.12ms |
| Proxied | 2.80ms |
| Proxied | 4.86ms |

## Held constant

- Node v22.22.2, PostgreSQL 16.13, one machine, one run
- 2 warmup runs discarded, then 7 measured runs (5 for the proxied
  conditions); medians reported, every sample in the raw JSON
- Identical rows for both strategies; each run asserts the client got back
  as many rows as the server sent

## The table

`users` is created from cal.com's `model User` by `harness/ddl.js`: all 45
scalar and enum columns, same names, same types, same nullability. Prisma's
schema engine could not be downloaded in this environment, so the one table the
query reads is built from the model definition rather than by `prisma db
push`. Relations and secondary indexes are left out; the query reads the whole
table and uses neither.

Rows (`harness/prisma/seed.sql`) look like ordinary accounts: a username, a
name, an email, an avatar URL, a time zone, a short bio on 40% of them, a
small `metadata` object (default conferencing app, Stripe customer id), a 2FA
secret on 30%. Nothing is padded. One row comes to about 1.4 KB of response.

## 1. Server and client, same machine

| Users in the table | Strategy | Rows sent | Response | Gzipped | Query (Prisma) | Serialise (superjson) | Server total | Client parse |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | as-found | 1,000 | 1.4 MB | 127 KB | 50.5ms | 75.5ms | 126.3ms | 27.9ms |
| 1,000 | suggested | 100 | 139 KB | 14 KB | 7.4ms | 6.8ms | 15.1ms | 2.5ms |
| 10,000 | as-found | 10,000 | 13.7 MB | 1.2 MB | 437.1ms | 743.9ms | 1155.1ms | 284.2ms |
| 10,000 | suggested | 100 | 139 KB | 14 KB | 8.6ms | 7.1ms | 15.7ms | 2.4ms |
| 50,000 | as-found | 50,000 | 68.8 MB | 6.1 MB | 2544.0ms | 4217.1ms | 6724.5ms | 1654.7ms |
| 50,000 | suggested | 100 | 139 KB | 14 KB | 9.1ms | 6.8ms | 15.8ms | 2.6ms |

## 2. Where the server time goes, as found

| Users | PostgreSQL + node-pg | Prisma query (incl. row mapping) | superjson serialise | Server total |
|---:|---:|---:|---:|---:|
| 1,000 | 16.5ms | 50.5ms | 75.5ms | 126.3ms |
| 10,000 | 134.9ms | 437.1ms | 743.9ms | 1155.1ms |
| 50,000 | 675.3ms | 2544.0ms | 4217.1ms | 6724.5ms |

## 3. Database distance

| Users | Strategy | local-socket | proxied-2.8ms | proxied-4.9ms |
|---:|---|---:|---:|---:|
| 1,000 | as-found | 126.3ms | 135.0ms | 118.7ms |
| 1,000 | suggested | 15.1ms | 21.5ms | 19.7ms |
| 10,000 | as-found | 1155.1ms | 1103.4ms | 1169.9ms |
| 10,000 | suggested | 15.7ms | 20.1ms | 21.3ms |
| 50,000 | as-found | 6724.5ms | 6748.2ms | 6698.0ms |
| 50,000 | suggested | 15.8ms | 16.0ms | 21.8ms |

## Ratios

- 1,000 users: server 8x, bytes 10x, client parse 11x, bytes per row 1427, heap growth 22.7 MB vs 11.6 MB
- 10,000 users: server 74x, bytes 101x, client parse 116x, bytes per row 1436, heap growth 159.7 MB vs 11.6 MB
- 50,000 users: server 424x, bytes 508x, client parse 638x, bytes per row 1443, heap growth 789.5 MB vs 11.6 MB


## Reading it

At 1,000 users the endpoint takes 126ms on the server and sends 1.4 MB. At
10,000 it takes 1.2 seconds and sends 13.7 MB. At 50,000 it takes 6.7 seconds,
sends 68.8 MB, and the server's heap grows by close to 800 MB to answer one
request. The suggested fix takes 15–16ms and sends 139 KB at every size.

Most of the time is not the database. At 50,000 users PostgreSQL and the
driver return every row in 675ms; Prisma turning them into objects brings the
query to 2.5 seconds, and superjson serialising them takes another 4.2. The
client then spends 1.7 seconds parsing.

Database distance does not matter here, unlike the N+1 benchmark. One query
is one round trip whatever it returns; the cost is CPU and memory on both ends,
and it grows with the table.

## Reproducing

```bash
cd harness
npm install
node fetch-schema.js   # cal.com's schema at the pinned commit, minus its zod/kysely/enum generators
PRISMA_QUERY_ENGINE_LIBRARY=<any file> PRISMA_SCHEMA_ENGINE_BINARY=/bin/true \
  npx prisma generate --schema prisma/schema.prisma

# a local postgres on port 5433 with its socket in /tmp, then:
createdb -h /tmp -p 5433 -U postgres calbench
node ddl.js > prisma/users.sql
psql -h /tmp -p 5433 -U postgres -d calbench -f prisma/users.sql

LABEL=local-socket node --expose-gc --max-old-space-size=4096 --import tsx bench.ts
node pg-baseline.js

node latency-proxy.js 5434 5433 0.5 &
node latency-proxy.js 5435 5433 2.5 &
node rtt-check.js
LABEL=proxied-2.8ms PG_HOST=127.0.0.1 PG_PORT=5434 REPEATS=5 node --expose-gc --max-old-space-size=4096 --import tsx bench.ts
LABEL=proxied-4.9ms PG_HOST=127.0.0.1 PG_PORT=5435 REPEATS=5 node --expose-gc --max-old-space-size=4096 --import tsx bench.ts

node aggregate.js   # every table above, from results/*.json, with checks
```

The engine-path variables only stop the Prisma CLI downloading binaries it does
not use: with `engineType = "client"` the query runs through Prisma's query
compiler and the pg adapter, with no Rust engine.

## Caveats

- One process, one machine. A production server is serving other requests
  while it spends 6.7 seconds and 800 MB on this one.
- The rows are synthetic. Real accounts have longer bios and bigger metadata
  for some users, shorter for most; 1.4 KB per row is ordinary, not a worst
  case. Synthetic rows repeat, so the gzipped sizes are a lower bound: real
  data compresses less.
- Network transfer to the browser is not measured. The response sizes are,
  and anyone can divide them by their own bandwidth.
- It is an admin page. It runs rarely, and only an instance's administrators
  can open it. The point is not that this endpoint is slow today; it is what
  the same line costs as a table grows, measured on a real application's own
  stack.
- The latency proxy is the N+1 benchmark's, with Nagle's algorithm turned off:
  without that, a small result waited for a 40ms delayed ACK and the proxy, not
  the query, was measured.
