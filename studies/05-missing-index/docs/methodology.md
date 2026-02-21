# Study 05: Methodology

## Overview

This study uses a five-phase methodology: controlled benchmarking, scaling analysis, real-world corpus profiling, static analysis tool evaluation, and patch contribution. The database benchmark design differs fundamentally from CPU benchmarks (Study 04) because query performance depends on I/O, buffer pool state, and query planner decisions — not just CPU clock speed.

---

## Phase 1: Controlled Benchmarking

### Environment

- **Database:** PostgreSQL ≥ 14, local instance, dedicated benchmark database `empirical_study_05`
- **Runtime:** Node.js ≥ 18, Prisma Client v6
- **OS:** Windows x64 (same as Study 04)
- **Hardware:** Same machine across all runs (no virtualization penalty)

### Protocol

For each benchmark module and each row count n:

1. **Seed:** Truncate tables and insert exactly `n` rows using batched `createMany` (10K rows per batch).
2. **ANALYZE:** Run `VACUUM ANALYZE bench_users, bench_orders` to update PostgreSQL statistics.
3. **Warmup (baseline):** Execute the query 5 times without recording — populates shared buffer pool.
4. **Baseline trials:** Execute the query 30 times; record wall-clock time per trial via `performance.now()`.
5. **Create index:** Run `CREATE INDEX` statement via `$executeRaw`. Record index creation time separately.
6. **ANALYZE (post-index):** Run `ANALYZE` to update planner statistics for the new index.
7. **Warmup (optimized):** Execute the query 5 times without recording.
8. **Optimized trials:** Execute the query 30 times; record wall-clock time per trial.
9. **Drop index:** Run `DROP INDEX` to restore baseline state.
10. **EXPLAIN ANALYZE:** Capture query plan for one trial per configuration to record plan type.

### Timing

- `performance.now()` captures wall-clock milliseconds including network round-trip to local PostgreSQL socket.
- Local socket latency is ~0.1ms; this is a negligible constant absorbed by the comparison.
- We measure wall-clock time (not CPU time) because disk I/O is the dominant cost at large n.

### Query Isolation

Each trial executes as a single `$queryRaw` or Prisma client call. No connection pooling reuse effects are introduced (each trial uses the same persistent connection).

### CV Threshold

Coefficient of variation (σ/μ) must be < 15% across 30 trials for a configuration to be accepted. If exceeded:
1. Check for concurrent disk activity on the test machine.
2. Add 10 additional warmup queries.
3. Re-collect with 50 trials instead of 30.

---

## Phase 2: Statistical Analysis

For each (module, n) pair, the 30-trial baseline and 30-trial optimized sets are compared using:

- **Speedup ratio:** median(baseline) / median(optimized)
- **Paired t-test:** Tests whether the two distributions have different means (p < 0.05 threshold).
- **Cohen's d:** Effect size (|μ₁ - μ₂| / σ_pooled). d > 0.8 = large effect.
- **Summary statistics:** mean, median, stddev, p05, p25, p75, p95, CV per configuration.

### Why median over mean?

Database query times are right-skewed (occasional lock waits, buffer evictions). Median is more robust to these outliers and better represents typical execution time.

---

## Phase 3: Scaling Analysis

Power-law regression on the median query time vs. row count n:

```
t(n) = a × n^b
```

Fit via log-log OLS: `log(t) = log(a) + b × log(n)`, R² reported.

Expected theoretical exponents:
- Sequential scan: b ≈ 1.0 (linear in n)
- B-tree index scan (point lookup): b ≈ 0.0–0.1 (effectively constant in n, dominated by log n)
- Sort-based query (no index): b ≈ 1.0–1.3 (linear + sort overhead)
- Composite index query: b ≈ 0.1–0.3

The key finding the scaling analysis is designed to confirm: **baseline exponents near 1.0 (linear scan) vs. optimized exponents near 0 (effectively O(log n))**. The gap between these exponents quantifies how much worse the no-index case becomes as the database grows.

---

## Phase 4: Real-World Corpus Profiling

### Corpus Construction

40 repositories selected across 5 domains (8 per domain), all using Prisma, Sequelize, or TypeORM as the primary ORM. Selection criteria:
- ≥ 200 GitHub stars
- Prisma schema, Sequelize models, or TypeORM entities present
- Actively maintained (commits in last 12 months)
- Primary language: TypeScript or JavaScript

### Missing Index Detection

The static detector (`prisma-index-detector.ts`) scans:
- **Prisma schemas:** identifies `model` fields used in likely `where`, `orderBy`, `distinct` positions that lack `@@index`.
- **Prisma query patterns:** scans TypeScript source files for `findMany`, `findFirst`, `findUnique` calls and extracts the `where` keys, checking them against the schema's declared indexes.
- **Sequelize/TypeORM:** scans model definitions for `@Column` fields used in `@FindOptions` `where` without `@Index`.

### Detection Categories

| Category | Description |
|---|---|
| `missing-fk-index` | FK column with no `@@index` — the most common Prisma omission |
| `missing-filter-index` | Field used in `where` clause with no index |
| `missing-sort-index` | Field used in `orderBy` with no index |
| `missing-composite` | Multiple fields used together in `where` without composite index |
| `potential-covering` | SELECT of a subset of fields where covering index would eliminate heap fetch |

---

## Phase 5: Static Analysis Tool Evaluation

Ground truth is constructed by:
1. Manually labeling 50 true positives (schemas with confirmed missing indexes) and 50 true negatives (schemas with correct indexing) from the corpus.
2. Running the detector on all 100 labeled cases.
3. Computing precision, recall, F1 per detection category.

---

## Key Methodological Differences from Study 04 (Loop Performance)

| Aspect | Study 04 (Loops) | Study 05 (Indexes) |
|---|---|---|
| Timing unit | Nanoseconds (hrtime) | Milliseconds (performance.now) |
| Warmup purpose | JIT compilation | Buffer pool warmup |
| Baseline state | Code without optimization | Table without index |
| Optimized state | Code with optimization | Table with index |
| CV threshold | 10% | 15% (disk I/O jitter) |
| n values | 10, 100, 1K, 10K, 100K | 1K, 10K, 100K, 1M |
| Primary runtime | Node.js V8 | PostgreSQL query planner |
| Scaling theory | Power-law (O(n), O(n²)) | O(n) seq scan → O(log n) index |
