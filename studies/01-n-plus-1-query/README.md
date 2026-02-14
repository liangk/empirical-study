# Study 01: The N+1 Query Problem — Empirical Analysis

## Overview

This study measures the real performance impact of N+1 query patterns in a Prisma + PostgreSQL stack.

Instead of only describing the anti-pattern, the benchmark suite compares **bad implementations** (query in loops / lazy loading style) against **good implementations** (eager loading or batch pre-fetching) and records:

- query count
- execution time
- latency distribution
- improvement factor by test case and dataset size

## Study Goals

1. Quantify how expensive common N+1 patterns are.
2. Validate that the proposed optimizations preserve behavior while reducing database round trips.
3. Compare scaling behavior across progressively larger datasets.
4. Produce reproducible output that can be used directly in articles and reports.

## Test Cases

| # | Pattern | Description | Typical Fix |
|---|---------|-------------|-------------|
| TC1 | Simple one-to-many | Users → Posts | `include` eager loading |
| TC2 | Nested relationships | Users → Posts → Comments (3-level) | Nested eager loading |
| TC3 | Many-to-one (Prisma-specific) | Orders → Users | `include` eager loading |
| TC4 | Conditional loading | Active orders → Users (batch pre-fetch) | `findMany` + `Map` lookup |

## Dataset Sizes

| Size | Users | Posts | Comments | Orders |
|------|-------|-------|----------|--------|
| Small | 100 | 300 | 600 | 200 |
| Medium | 1,000 | 3,000 | 6,000 | 2,000 |
| Large | 10,000 | 30,000 | 60,000 | 20,000 |
| XLarge | 100,000 | 300,000 | 600,000 | 200,000 |

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript 5+
- **ORM:** Prisma 6+
- **Database:** PostgreSQL 15+
- **Benchmarking:** `performance.now()`, Prisma query event logging

## Project Structure

```text
studies/01-n-plus-1-query/
├─ prisma/                  # Prisma schema
├─ src/
│  ├─ seed.ts               # Dataset seeding entry
│  └─ benchmarks/           # bad/good/all benchmark runners
├─ results/                 # Timestamped benchmark JSON outputs
└─ content/                 # Published article drafts/versions
```

## Prerequisites

Before running the study:

1. Install Node.js 18+ and npm.
2. Ensure a PostgreSQL instance is reachable.
3. Create a `.env` file with a valid `DATABASE_URL`.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/empirical_study_01?schema=public"
```

## Setup

```bash
# Install dependencies
npm install

# Prepare database schema/client
npm run prisma:push
npm run prisma:generate
```

## Running the Study

### 1) Seed Data

```bash
npm run seed
```

> Dataset size can be changed in `src/seed.ts` depending on your experiment stage.

### 2) Run Benchmarks

```bash
# Full comparison (recommended)
npm run bench:all

# Only unoptimized code paths
npm run bench:bad

# Only optimized code paths
npm run bench:good
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run seed` | Seed database with test data |
| `npm run bench:all` | Run all test cases (bad + good) |
| `npm run bench:bad` | Run only N+1 (unoptimized) versions |
| `npm run bench:good` | Run only optimized versions |
| `npm run prisma:push` | Push Prisma schema to DB |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:studio` | Open Prisma Studio for data inspection |

## Output and Result Files

Benchmark outputs are written to `results/` as timestamped JSON files.

Typical output includes:

- per-test-case timing metrics
- bad vs good query counts
- speedup factors
- percentile statistics where available

Keep result snapshots if you are comparing hardware, dataset size, or code revisions.

## Interpreting Results

When reading outputs, focus on:

1. **Query count delta** (primary signal for N+1 elimination)
2. **P95/P99 latency** (tail latency for API reliability)
3. **Speedup factor consistency** across all test cases
4. **Scaling trend** from small → medium → large datasets

If execution time improves but query count does not, verify implementation parity and benchmark noise.

## Reproducibility Notes

- Run on a quiet machine (close heavy background apps).
- Keep DB configuration stable between runs.
- Use the same dataset size when comparing revisions.
- Do at least two repeated runs for publication-level claims.

## Articles

Published versions are in `content/`:

- `v1` — Tech tutorial style
- `v2` — Academic tone
- `v3` — Human conversational tone

## Troubleshooting

- **Prisma client errors:** run `npm run prisma:generate`.
- **Schema mismatch:** run `npm run prisma:push`.
- **Connection error:** verify `DATABASE_URL` and Postgres availability.
- **Unexpectedly slow runs:** confirm dataset size and check local machine load.

## Related

- **Publication:** [stackinsight.dev](https://stackinsight.dev)
- **GitHub:** [github.com/liangk/empirical-study](https://github.com/liangk/empirical-study)
