# Study 01: The N+1 Query Problem — Empirical Analysis

## Overview

Empirical validation of N+1 query detection and optimization in Prisma/Node.js/PostgreSQL.
Measures query count reduction and execution time improvement across four test cases at multiple dataset scales.

## Test Cases

| # | Pattern | Description |
|---|---------|-------------|
| TC1 | Simple one-to-many | Users → Posts |
| TC2 | Nested relationships | Users → Posts → Comments (3-level) |
| TC3 | Many-to-one (Prisma-specific) | Orders → Users |
| TC4 | Conditional loading | Active orders → Users (batch pre-fetch) |

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

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env   # Edit DATABASE_URL if needed
npm run prisma:push
npm run prisma:generate

# Seed data (edit src/seed.ts for dataset size)
npm run seed

# Run benchmarks
npm run bench:all
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run seed` | Seed database with test data |
| `npm run bench:all` | Run all test cases (bad + good) |
| `npm run bench:bad` | Run only N+1 (unoptimized) versions |
| `npm run bench:good` | Run only optimized versions |

## Results

Benchmark results are saved to `results/` as timestamped JSON files.

## Articles

Published versions are in `content/`:
- `v1` — Tech tutorial style
- `v2` — Academic tone
- `v3` — Human conversational tone

## Related

- **Publication:** [stackinsight.dev](https://stackinsight.dev)
- **GitHub:** [github.com/liangk/empirical-study](https://github.com/liangk/empirical-study)
