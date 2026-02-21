# Study 05: Benchmark Module Specifications

Each module is an isolated benchmark that seeds the database with `n` rows, measures query execution time WITHOUT the relevant index (baseline), then WITH the index (optimized), then drops the index to restore state. Both variants execute the identical query — the only variable is index presence.

**Common parameters:**
- Row counts: n = 1,000 · 10,000 · 100,000 · 1,000,000
- Trials: 30 per configuration
- Warmup: 5 queries before timing begins (warms PostgreSQL's shared buffer pool)
- CV threshold: 15% (relaxed from Study 04's 10% due to disk I/O jitter)
- Timing: `performance.now()` in ms (DB round-trip latency)
- Plan capture: `EXPLAIN (ANALYZE, FORMAT JSON)` recorded per trial for plan type classification

---

## BM-01 — Point Lookup on Unindexed Column

**Anti-pattern:** `prisma.benchUser.findFirst({ where: { email } })` — `email` has no `@@index`, forcing a sequential scan through all rows to find one match.

**Theoretical complexity:** O(n) baseline (sequential scan) vs. O(log n) optimized (B-tree index scan).

**Optimization strategy:** Add `@@index([email])` to the Prisma schema.

**Programmatic equivalent:**
```sql
-- Baseline (no index)
SELECT * FROM bench_users WHERE email = $1 LIMIT 1;

-- Optimized (with index)
CREATE INDEX idx_bm01_email ON bench_users(email);
SELECT * FROM bench_users WHERE email = $1 LIMIT 1;
```

**Synthetic data schema:**
- `bench_users` table with `n` rows.
- `email` is unique per row: `user{i}@benchmark.test`.
- Query target: a randomly selected email from the middle of the dataset (worst case for seq scan).
- Seeded with `faker` using fixed seed `0xBEEF01`.

**Metric focus:** Query wall-clock time, plan type (Seq Scan → Index Scan).

**Row counts:** n = 1K, 10K, 100K, 1M.

**Hypothesis:** H1 — unindexed point lookup ≥ 10× slower than indexed at n = 100K.

---

## BM-02 — Sorted Range Query Without Index

**Anti-pattern:** `prisma.benchOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })` — without an index on `createdAt`, PostgreSQL must load all rows and sort in memory (filesort).

**Theoretical complexity:** O(n log n) baseline (full scan + sort) vs. O(1) optimized (LIMIT from front of index — no sort needed).

**Optimization strategy:** Add `@@index([createdAt(sort: Desc)])` to the Prisma schema.

**Programmatic equivalent:**
```sql
-- Baseline (no index)
SELECT * FROM bench_orders ORDER BY created_at DESC LIMIT 20;

-- Optimized (with index)
CREATE INDEX idx_bm02_createdat ON bench_orders(created_at DESC);
SELECT * FROM bench_orders ORDER BY created_at DESC LIMIT 20;
```

**Synthetic data schema:**
- `bench_orders` table with `n` rows.
- `createdAt` values are spread over a 2-year window (random DateTime, not clustered).
- Seeded with fixed seed `0xBEEF02`.

**Metric focus:** Query wall-clock time, plan type (Sort → Index Scan), sort memory usage.

**Row counts:** n = 1K, 10K, 100K, 1M.

**Hypothesis:** H2 — filesort ≥ 5× slower than index-ordered scan at n = 100K.

---

## BM-03 — Unindexed Foreign Key Scan (Prisma Default)

**Anti-pattern:** `prisma.benchOrder.findMany({ where: { userId } })` — Prisma does **not** automatically create indexes on foreign key columns (unlike JPA/Hibernate). Every `userId` lookup performs a sequential scan.

**This is the most dangerous default in Prisma** — it looks correct, generates valid SQL, and works fine at small scale. At production scale it silently degrades to O(n).

**Theoretical complexity:** O(n) baseline (full table scan to find userId matches) vs. O(log n + k) optimized (index scan, k = matching rows).

**Optimization strategy:** Add `@@index([userId])` to `BenchOrder`.

**Programmatic equivalent:**
```sql
-- Baseline (no index on user_id)
SELECT * FROM bench_orders WHERE user_id = $1;

-- Optimized (with FK index)
CREATE INDEX idx_bm03_userid ON bench_orders(user_id);
SELECT * FROM bench_orders WHERE user_id = $1;
```

**Synthetic data schema:**
- `bench_orders` table with `n` rows.
- `userId` values drawn uniformly from 1..(n/10) — each user has ~10 orders on average.
- Query target: a randomly selected userId.
- Seeded with fixed seed `0xBEEF03`.

**Metric focus:** Query wall-clock time, plan type (Seq Scan → Index Scan → Bitmap Index Scan).

**Row counts:** n = 1K, 10K, 100K, 1M.

**Hypothesis:** H3 — unindexed FK scan ≥ 10× slower than indexed at n = 100K.

---

## BM-04 — Composite Filter: Single-Column vs. Composite Index

**Anti-pattern:** A `WHERE status = ? AND createdAt > ?` query with only a single-column index on `status`. PostgreSQL uses the status index but must re-check the `createdAt` condition for every matched row (index condition pushdown not sufficient for range on second column).

**Theoretical complexity:** O(k) baseline where k = rows matching status (potentially large). O(log n + m) optimized where m = rows matching both conditions.

**Optimization strategy:** Replace `@@index([status])` with `@@index([status, createdAt])`.

**Programmatic equivalent:**
```sql
-- Baseline (single-column index on status only)
CREATE INDEX idx_bm04_base ON bench_orders(status);
SELECT * FROM bench_orders WHERE status = $1 AND created_at > $2;

-- Optimized (composite index on status + createdAt)
CREATE INDEX idx_bm04_opt ON bench_orders(status, created_at);
SELECT * FROM bench_orders WHERE status = $1 AND created_at > $2;
```

**Synthetic data schema:**
- `bench_orders` table with `n` rows.
- `status` has 4 values distributed ~25% each: 'pending', 'active', 'completed', 'cancelled'.
- `createdAt` spread over 2-year window.
- Query: status = 'active' AND createdAt > (now - 90 days) — targets ~6% of rows.
- Seeded with fixed seed `0xBEEF04`.

**Metric focus:** Query wall-clock time, rows examined vs. rows returned ratio.

**Row counts:** n = 1K, 10K, 100K, 1M.

**Hypothesis:** H4 — composite index ≥ 2× faster than single-column for compound filter at n = 100K.

---

## BM-05 — Covering Index: Eliminate Heap Fetch

**Anti-pattern:** `SELECT id, email FROM bench_users WHERE status = ?` with only `@@index([status])`. PostgreSQL uses the index to find matching row IDs, then fetches the full row from the heap to retrieve `email` — an extra I/O operation per matching row.

**Theoretical complexity:** O(k × heap_fetch_cost) baseline vs. O(k) optimized (all data in the index leaf).

**Optimization strategy:** Use a covering index via `CREATE INDEX ... INCLUDE (email)` (PostgreSQL 11+ syntax) — the index stores `email` alongside `status`, eliminating the heap fetch.

**Programmatic equivalent:**
```sql
-- Baseline (regular index — heap fetch needed for email)
CREATE INDEX idx_bm05_base ON bench_users(status);
SELECT id, email FROM bench_users WHERE status = $1;

-- Optimized (covering index — email stored in index leaf)
CREATE INDEX idx_bm05_opt ON bench_users(status) INCLUDE (email);
SELECT id, email FROM bench_users WHERE status = $1;
```

**Synthetic data schema:**
- `bench_users` table with `n` rows.
- `status` is one of 'active' (60%), 'inactive' (30%), 'suspended' (10%).
- Query target: status = 'active' → returns ~60% of rows (high selectivity makes heap fetch cost visible).
- Seeded with fixed seed `0xBEEF05`.

**Metric focus:** Query wall-clock time, heap fetches (from EXPLAIN ANALYZE `Heap Fetches` counter).

**Row counts:** n = 1K, 10K, 100K, 1M.

**Hypothesis:** H5 — covering index measurably faster than heap-fetch index at n ≥ 100K (expected: 20–50%).

**Note:** The covering index improvement is smaller than BM-01–03 because it's a constant-factor optimization (eliminating I/O per row), not an algorithmic class change (O(n) → O(log n)). The effect grows with the number of matching rows and the row width.
