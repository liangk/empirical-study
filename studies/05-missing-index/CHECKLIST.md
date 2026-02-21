# Study 05: Missing Index Crisis — Implementation Checklist

> Status legend: `[ ]` = pending · `[x]` = done · `[~]` = in progress · `[!]` = blocked

---

## Phase 0 — Setup

- [x] Create `studies/05-missing-index/` folder structure
- [x] `package.json` created
- [x] `tsconfig.json` created
- [x] `README.md` created
- [x] `.env.example` created
- [x] `prisma/schema.prisma` created (BenchUser + BenchOrder, no @@index)
- [x] `data/corpus.md` created (40 repos using Prisma/Sequelize/TypeORM)
- [x] `docs/benchmark-specs.md` created
- [x] `docs/methodology.md` created
- [x] `docs/statistical-analysis.md` created
- [x] `src/step1-benchmarks/harness/` created (types, runner, stats, data-gen, db)
- [ ] `.env` created with local PostgreSQL connection string
- [ ] `npm install` run successfully
- [ ] `npm run prisma:generate` run successfully
- [ ] `npm run prisma:push` run successfully (tables created)

---

## Phase 1 — Baseline Benchmarks

### BM-01 — Point Lookup on Unindexed Column

- [x] `src/step1-benchmarks/modules/bm01-lookup/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm01-lookup/optimized.ts` implemented
- [ ] Correctness gate passed (`npm run bench:verify -- --module BM-01`)
- [ ] Sanity run (5 trials at n=1K) — CV < 15%
- [ ] Full 30-trial baseline collected at n = 1K, 10K, 100K, 1M
- [ ] Full 30-trial optimized collected (same session)
- [ ] H1 hypothesis result recorded: speedup ≥ 10× at n = 100K?

### BM-02 — Sorted Range Query Without Index

- [x] `src/step1-benchmarks/modules/bm02-sort/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm02-sort/optimized.ts` implemented
- [ ] Correctness gate passed
- [ ] Sanity run — CV < 15%
- [ ] Full 30-trial baseline collected
- [ ] Full 30-trial optimized collected
- [ ] H2 hypothesis result recorded: filesort elimination ≥ 5× at n = 100K?

### BM-03 — Unindexed Foreign Key Scan (Prisma Default)

- [x] `src/step1-benchmarks/modules/bm03-fk-scan/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm03-fk-scan/optimized.ts` implemented
- [ ] Correctness gate passed
- [ ] Sanity run — CV < 15%
- [ ] Full 30-trial baseline collected
- [ ] Full 30-trial optimized collected
- [ ] H3 hypothesis result recorded: FK index speedup ≥ 10× at n = 100K?

### BM-04 — Composite Filter: Single vs. Composite Index

- [x] `src/step1-benchmarks/modules/bm04-composite/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm04-composite/optimized.ts` implemented
- [ ] Correctness gate passed
- [ ] Sanity run — CV < 15%
- [ ] Full 30-trial baseline collected
- [ ] Full 30-trial optimized collected
- [ ] H4 hypothesis result recorded: composite index ≥ 2× over single-column at n = 100K?

### BM-05 — Covering Index: Eliminate Heap Fetch

- [x] `src/step1-benchmarks/modules/bm05-covering/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm05-covering/optimized.ts` implemented
- [ ] Correctness gate passed
- [ ] Sanity run — CV < 15%
- [ ] Full 30-trial baseline collected
- [ ] Full 30-trial optimized collected
- [ ] H5 hypothesis result recorded: covering index measurable vs. heap-fetch at n = 1M?

---

## Phase 2 — Statistical Analysis & Comparison

- [ ] `run-all.ts` executed end-to-end (`npm run bench:all` completed)
- [ ] Summary statistics computed (mean, median, stddev, p05, p95, CV)
- [ ] All CV < 15% — if exceeded, investigate disk I/O variance and add trials
- [ ] Speedup ratios computed for each (module, n) configuration
- [ ] Paired t-test applied: t-statistic, p-value recorded per configuration
- [ ] Cohen's d computed per configuration
- [ ] EXPLAIN ANALYZE plan types recorded (Seq Scan vs Index Scan vs Bitmap Index Scan)
- [ ] Per-module results saved to `results/`

---

## Phase 3 — Scaling Analysis

- [ ] `src/step2-scaling/fit-curves.ts` run against collected results
- [ ] `results/scaling-<timestamp>.json` saved
- [ ] Power-law regression results reviewed: `t = a × nᵇ` per module
- [ ] Empirical exponent `b` compared to theoretical (1.0 seq scan, log n indexed)
- [ ] Log-log scaling plots data exported (CSV for plotting)

---

## Phase 4 — Real-World Corpus Study

### 4.1 Corpus Construction

- [x] 40 repos selected in `data/corpus.md` (Prisma, Sequelize, TypeORM — 5 domains × 8 repos)
- [ ] Verify all repos: accessible, active maintenance, Prisma/ORM schema present
- [ ] Flag any repos failing criteria and substitute

### 4.2 Automated Schema Detection

- [x] `src/step4-static-analysis/detector/prisma-index-detector.ts` implemented
- [ ] Detector run on all 40 repos
- [ ] All candidate missing indexes written to `results/findings-<timestamp>.json`
- [ ] High-confidence candidates reviewed manually (confirm TP vs FP)

### 4.3 Prevalence Analysis

- [ ] Total missing index count per project, per domain, per pattern type
- [ ] Prevalence rate: % of projects with ≥1 missing index per pattern type
- [ ] Density: missing indexes per 1,000 lines of schema
- [ ] `results/prevalence-<timestamp>.json` saved

### 4.4 Real-World Performance Measurement

- [ ] Top 3 missing index instances per pattern type selected
- [ ] Each subject: extracted into standalone harness against real app DB
- [ ] 30-trial baseline collected per subject
- [ ] Index added; correctness verified
- [ ] 30-trial optimized collected per subject
- [ ] Speedup, Cohen's d computed per subject
- [ ] Real-world vs synthetic speedup comparison documented

### 4.5 Patch Contribution Campaign

- [ ] Schema patch prepared for each confirmed instance (`@@index` addition)
- [ ] PRs submitted to applicable repos
- [ ] Acceptance rate recorded

---

## Phase 5 — Static Analysis Tool Evaluation

- [x] `src/step4-static-analysis/detector/prisma-index-detector.ts` implemented
- [ ] Detector tested against labeled ground truth (Prisma schemas with known issues)
- [ ] Precision, recall, F1 computed
- [ ] `results/static-analysis-<timestamp>.json` saved

---

## Deliverables

- [ ] Benchmark suite: all correctness gates passing, 30 trials × 4 n × 5 modules × 2 patterns
- [ ] Raw dataset: `results/bench-*.json`
- [ ] Summary dataset: `results/summary-*.json`
- [ ] Comparison dataset: `results/comparison-*.json`
- [ ] Scaling analysis: `results/scaling-*.json`
- [ ] Final article draft: `content/missing-index-empirical-study.md`

---

## Hypothesis Tracking

| ID | Hypothesis | Status | n at which met | Actual speedup |
|----|------------|--------|---------------|----------------|
| H1 | Unindexed point lookup ≥ 10× slower than indexed at n = 100K | [ ] | — | — |
| H2 | Unindexed ORDER BY ≥ 5× slower than indexed at n = 100K | [ ] | — | — |
| H3 | Unindexed FK scan ≥ 10× slower than indexed at n = 100K | [ ] | — | — |
| H4 | Single-column composite filter ≥ 2× slower than composite index | [ ] | — | — |
| H5 | Covering index measurably faster than heap-fetch at n = 1M | [ ] | — | — |

---

## Notes & Blockers

- PostgreSQL EXPLAIN ANALYZE is captured via `$queryRaw` for plan type recording.
- Covering index uses `CREATE INDEX ... INCLUDE (col)` — requires PostgreSQL ≥ 11.
- Index creation time at n = 1M may be significant (~30–60s); this is recorded but not included in query timing.
- CV threshold is relaxed to 15% (vs 10% in Study 04) due to inherent disk I/O jitter.
- `prisma:push --force-reset` drops all data; never run after seeding at production scale.
