# Study 05: Missing Index Crisis — Empirical Analysis

## Overview

This study quantifies the performance impact of missing database indexes in Node.js applications using Prisma and PostgreSQL. It pairs **controlled benchmarks** (no-index baseline vs. indexed optimized, 30 trials × 4 row counts) with **static analysis** (scanning real-world Prisma schemas for missing indexes) and **real-world corpus profiling**.

The key finding that motivates this study: **Prisma does not automatically create indexes on foreign keys**. This is a silent landmine — a `userId` foreign key with no `@@index` declaration performs a full sequential scan on every `findMany` call, invisible to developers until production scale.

### Research Questions

1. **RQ1 — Magnitude:** How much does a missing index degrade query performance vs. the same query with a proper index?
2. **RQ2 — Scaling:** How does query time scale with table cardinality (n) for sequential scan vs. index scan patterns?
3. **RQ3 — Pattern Specificity:** Do different index types (single-column, composite, covering) produce measurably different speedups?
4. **RQ4 — Prevalence:** How common are missing index patterns in real-world Prisma schemas?
5. **RQ5 — Detection:** Can static analysis of Prisma schema files reliably detect missing index candidates?

---

## Benchmark Modules

| Module | Anti-Pattern | Index Type | Optimization |
|--------|-------------|-----------|--------------|
| BM-01 | Point lookup on unindexed column (`WHERE email = ?`) | Single-column | `@@index([email])` |
| BM-02 | Sorted range query without index (`ORDER BY createdAt DESC LIMIT 20`) | Single-column | `@@index([createdAt(sort: Desc)])` |
| BM-03 | Unindexed FK scan (`WHERE userId = ?`) — Prisma default | Single-column | `@@index([userId])` |
| BM-04 | Compound filter with single-column index (`WHERE status = ? AND createdAt > ?`) | Composite | `@@index([status, createdAt])` |
| BM-05 | Heap fetch on status filter (`SELECT id, email WHERE status = ?`) | Covering | `@@index([status], INCLUDE [email])` |

---

## Project Structure

```
studies/05-missing-index/
├── CHECKLIST.md                     # Phase-by-phase implementation checklist
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   └── schema.prisma                # BenchUser + BenchOrder models (no @@index)
├── data/
│   └── corpus.md                    # 40 real-world repos using Prisma/Sequelize/TypeORM
├── docs/
│   ├── benchmark-specs.md           # Per-module specifications
│   ├── methodology.md               # Full methodology (phases, protocols)
│   └── statistical-analysis.md     # Statistical methods
├── results/                         # Output JSON (gitignored)
├── content/                         # Article drafts
└── src/
    ├── seed.ts                      # Populate bench_users + bench_orders to target n
    ├── step1-benchmarks/
    │   ├── harness/
    │   │   ├── types.ts             # DbTrialRecord, BenchmarkSummary, ComparisonResult
    │   │   ├── runner.ts            # Trial runner: seed, warmup, index management, timing
    │   │   ├── stats.ts             # mean, median, stddev, t-test, Cohen's d, CV
    │   │   └── data-gen.ts          # Faker-based deterministic row generators
    │   ├── modules/
    │   │   ├── bm01-lookup/         # baseline.ts, optimized.ts
    │   │   ├── bm02-sort/           # baseline.ts, optimized.ts
    │   │   ├── bm03-fk-scan/        # baseline.ts, optimized.ts
    │   │   ├── bm04-composite/      # baseline.ts, optimized.ts
    │   │   └── bm05-covering/       # baseline.ts, optimized.ts
    │   ├── correctness/
    │   │   └── verify-all.ts        # Assert baseline and optimized return identical rows
    │   └── run-all.ts               # Orchestrator: seed → baseline → add index → optimized → drop index
    ├── step2-scaling/
    │   └── fit-curves.ts            # Power-law regression on query time vs n
    ├── step3-realworld/
    │   ├── corpus.ts                # Load and parse data/corpus.md
    │   └── scanner.ts               # Clone repos, scan Prisma schemas for missing indexes
    └── step4-static-analysis/
        └── detector/
            └── prisma-index-detector.ts  # AST/regex detector for missing @@index patterns
```

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (local instance — covering index `INCLUDE` requires PG 11+)
- **npm**

## Setup

```bash
cd studies/05-missing-index
cp .env.example .env
# Edit .env: set DATABASE_URL to your local PostgreSQL instance

npm install
npm run prisma:generate
npm run prisma:push     # Creates bench_users + bench_orders tables (no indexes)
```

## Execution

### Seed the database

```bash
# Seed with default maximum (1,000,000 rows — takes ~2-3 min)
npm run seed

# Seed with specific row count (for quick testing)
npm run seed:n 10000
```

### Phase 1 & 2 — Benchmarks

```bash
# Correctness gate first (verifies baseline and optimized return same rows)
npm run bench:verify

# Run all 5 modules across all n values
npm run bench:all

# Run individual modules
npm run bench:bm01   # Point lookup
npm run bench:bm02   # Sorted range query
npm run bench:bm03   # FK scan
npm run bench:bm04   # Composite filter
npm run bench:bm05   # Covering index
```

### Phase 3 — Scaling Analysis

```bash
npm run scaling -- --input results/bench-latest.json
```

### Phase 4 — Real-World Corpus Scan

```bash
npm run realworld:scan
```

### Phase 5 — Static Analysis

```bash
npm run detect -- --path <path-to-prisma-schema-or-repo>
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run seed` | Seed bench_users + bench_orders with 1M rows |
| `npm run seed:n <n>` | Seed with specific row count |
| `npm run bench:all` | Run all 5 modules (baseline + optimized, all n values) |
| `npm run bench:bm<N>` | Run single module (01–05) |
| `npm run bench:verify` | Correctness gate |
| `npm run scaling` | Fit power-law curves to results JSON |
| `npm run realworld:scan` | Clone corpus repos, scan for missing indexes |
| `npm run detect` | Run Prisma schema detector on target path |
| `npm run prisma:push` | Push schema to DB (force-reset — drops all data) |

## Output Files

| File | Contents |
|------|----------|
| `results/bench-<timestamp>.json` | Raw trial records per module, pattern, n |
| `results/summary-<timestamp>.json` | Summary statistics per configuration |
| `results/comparison-<timestamp>.json` | Speedup ratios, t-test, Cohen's d |
| `results/scaling-<timestamp>.json` | Empirical complexity exponents per module |
| `results/findings-<timestamp>.json` | Real-world missing index findings per repo |
| `results/prevalence-<timestamp>.json` | Aggregated missing index counts and density |

## Articles

- **Published:** [stackinsight.dev/blog/missing-index-empirical-study](https://stackinsight.dev/blog/missing-index-empirical-study)

Draft versions in `content/`.
