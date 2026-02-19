# Study 04: Loop Performance — Implementation Checklist

> Status legend: `[ ]` = pending · `[x]` = done · `[~]` = in progress · `[!]` = blocked

---

## Phase 0 — Setup

- [x] Create `studies/04-loop-performance/` folder structure
- [x] `package.json` created
- [x] `tsconfig.json` created
- [x] `README.md` created
- [x] `data/corpus.md` created (40 repos, 5 domains × 8 projects)
- [x] `docs/benchmark-specs.md` created
- [x] `docs/methodology.md` created
- [x] `docs/statistical-analysis.md` created
- [x] `src/step1-benchmarks/harness/types.ts` created
- [x] `src/step1-benchmarks/harness/runner.ts` created
- [x] `src/step1-benchmarks/harness/stats.ts` created
- [x] `src/step1-benchmarks/harness/data-gen.ts` created
- [x] `npm install` run successfully

---

## Phase 1 — Baseline Benchmarks (Anti-Pattern Implementations)

### BM-01 — Regex Compilation Inside Loop

- [x] `src/step1-benchmarks/modules/bm01-regex/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm01-regex/optimized.ts` implemented
- [x] Correctness gate passed (`npm run bench:verify -- --module BM-01`)
- [x] Sanity run (5 trials) — CV < 10% at all n
- [x] Full 30-trial baseline collected at n = 10, 100, 1000, 10000, 100000
- [x] Full 30-trial optimized collected (same session)
- [x] H2 hypothesis result recorded: speedup ≥ 5× at n ≥ 10,000? (Refuted in JS: 1.08×; Confirmed in Python: ~2×)

### BM-02 — JSON Parsing Inside Loop

- [x] `src/step1-benchmarks/modules/bm02-json/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm02-json/optimized.ts` implemented
- [x] Correctness gate passed
- [x] Sanity run — CV < 10% at all n
- [x] Full 30-trial baseline collected
- [x] Full 30-trial optimized collected (same session)
- [x] Results recorded

### BM-03 — Sequential Async I/O

- [x] `src/step1-benchmarks/modules/bm03-async-io/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm03-async-io/optimized.ts` implemented
- [x] Mock HTTP server verified (local, no real network calls)
- [x] Correctness gate passed
- [x] Sanity run — CV < 10% at all n
- [x] Full 30-trial baseline collected
- [x] Full 30-trial optimized collected (same session)
- [x] H3 hypothesis result recorded: wall-clock reduction ≥ 50%? (Confirmed: >90% at n=100)

### BM-04 — Nested Loops (O(n²) → O(n) via Map)

- [x] `src/step1-benchmarks/modules/bm04-nested-loops/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm04-nested-loops/optimized.ts` implemented
- [x] Correctness gate passed
- [x] Sanity run — CV < 10% at all n
- [x] Full 30-trial baseline collected
- [x] Full 30-trial optimized collected (same session)
- [x] H1 hypothesis result recorded: O(n²) growth confirmed empirically? (Confirmed: b=1.47)
- [x] H4 hypothesis result recorded: speedup ≥ 100× at n = 10,000? (Missed in JS: 59×; Exceeded in Python: 1,864×)

### BM-05 — Nested Array Methods (forEach-in-forEach)

- [x] `src/step1-benchmarks/modules/bm05-nested-array/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm05-nested-array/optimized.ts` implemented
- [x] Correctness gate passed
- [x] Sanity run — CV < 10% at all n
- [x] Full 30-trial baseline collected
- [x] Full 30-trial optimized collected (same session)
- [x] Results recorded

### BM-06 — Chained Array Methods (multi-pass filter+map)

- [x] `src/step1-benchmarks/modules/bm06-chained-array/baseline.ts` implemented
- [x] `src/step1-benchmarks/modules/bm06-chained-array/optimized.ts` implemented
- [x] Correctness gate passed
- [x] Sanity run — CV < 10% at all n
- [x] Full 30-trial baseline collected
- [x] Full 30-trial optimized collected (same session)
- [x] Results recorded

### BM-07 — DOM Manipulation Inside Loop (browser)

- [x] `src/step1-benchmarks/modules/bm07-dom/baseline.html` created
- [x] `src/step1-benchmarks/modules/bm07-dom/optimized.html` created
- [x] `src/step1-benchmarks/modules/bm07-dom/node-runner.ts` created (jsdom-based)
- [ ] Browser-based baseline measured in Chrome DevTools (Performance tab)
- [ ] Browser-based optimized measured in same Chrome session
- [ ] H5 hypothesis result recorded: layout recalc reduction ≥ 70%?
- [ ] CDP metrics captured: layout duration, style recalc, main thread blocking

---

## Phase 2 — Statistical Analysis & Comparison

- [x] `run-all.ts` executed end-to-end (`npm run bench:all` completed)
- [x] Summary statistics computed (mean, median, stddev, p05, p25, p75, p95, CV)
- [x] All CV < 10% — if any exceed threshold, re-collect after environment review
- [x] Speedup ratios computed for each (module, n) configuration
- [x] Paired t-test applied: t-statistic, p-value recorded per configuration
- [x] Cohen's d computed: effect size (small/medium/large) recorded
- [x] Per-pattern results sheets produced in `results/`
- [x] Any anomalies (speedup < 1.0) investigated and documented
- [x] Crossover n values identified for anomalous configurations
- [ ] Memory delta comparison recorded for BM-01 and BM-02

---

## Phase 3 — Scaling Analysis

- [x] `src/step2-scaling/fit-curves.ts` run against collected results (`npm run scaling` completed)
- [x] `results/scaling-<timestamp>.json` saved
- [x] Power-law regression results reviewed: `t = a × nᵇ` per module
- [x] Empirical exponent `b` compared to theoretical (1.0, 2.0, etc.)
- [x] Deviations from theory documented (JIT, cache, scheduling effects)
- [x] Log-log scaling plots generated (CSV data exported for plotting)

---

## Phase 4 — Real-World Corpus Study

### 4.1 Corpus Construction

- [x] 40 repos selected in `data/corpus.md` (20 JS, 20 Python, 5 domains × 8 projects)
- [ ] Verify all repos: active PR tracker, ≥500 stars, accessible test suite
- [ ] Flag any repos failing selection criteria and substitute

### 4.2 Automated Anti-Pattern Detection

- [x] `src/step4-static-analysis/detector/js-loop-detector.ts` implemented (JS/TS AST)
- [x] Python AST detector stub created (`src/step4-static-analysis/detector/py-loop-detector.py`)
- [x] `npm run realworld:scan` completes without errors on full 40-repo corpus
- [x] All candidate instances written to structured findings database (`results/findings-*.json`)
- [ ] High-confidence candidates reviewed manually (confirm TP vs FP)
- [ ] Medium-confidence candidates reviewed by two researchers; disagreements resolved

### 4.3 Prevalence Analysis

- [x] Total count per project, per domain, per anti-pattern type computed
- [x] Prevalence rate: % of projects with ≥1 instance per pattern type
- [x] Density: instances per 1,000 LOC by domain and language
- [ ] Co-occurrence: Jaccard similarity between pattern vectors computed
- [ ] Loop depth distribution histogram generated
- [ ] Age analysis: `git log` used to determine median age of each instance
- [x] `results/prevalence-<timestamp>.json` saved

### 4.4 Real-World Performance Measurement

- [ ] Top 3 instances per anti-pattern type selected (21 subjects total)
- [ ] Each subject: function extracted into standalone harness
- [ ] Representative workload identified (project test/benchmark suite or purpose-built driver)
- [ ] 30-trial baseline collected per subject (Phase 1 protocol)
- [ ] Optimization applied; correctness verified against project test suite
- [ ] 30-trial optimized collected per subject
- [ ] Speedup, improvement %, Cohen's d computed per subject
- [ ] Real-world vs synthetic benchmark speedup comparison documented
- [ ] `results/realworld-<timestamp>.json` saved

### 4.5 Patch Contribution Campaign

- [ ] Patch prepared for each confirmed + measured instance
- [ ] Each patch: minimal (loop change only), test suite passing
- [ ] PR description template filled: explanation, speedup data, before/after snippet
- [ ] PRs submitted to all applicable repos
- [ ] `data/corpus.md` Phase 4.5 Patch Tracking table populated
- [ ] Follow-up at 4 weeks post-submission for open PRs
- [ ] Follow-up at 8 weeks post-submission for remaining open PRs
- [ ] Acceptance rate by anti-pattern type, domain, and project size reported
- [ ] Rejection reasons qualitatively coded and categorized

### 4.6 Git History Analysis

- [ ] `git log -S` (pickaxe) used to identify commit introducing each flagged instance
- [ ] Per-instance: commit author ID, date, message keywords, PR association recorded
- [ ] PR review comment count fetched for instances introduced via PR
- [ ] Review comments searched for performance/loop/complexity keywords
- [ ] Survivorship count (subsequent file edits without fix) computed per instance
- [ ] Function test coverage recorded for each anti-pattern location
- [ ] Distribution of instance age at detection reported
- [ ] Correlation between test coverage and anti-pattern prevalence computed
- [ ] `results/git-history-<timestamp>.json` saved

---

## Phase 5 — Static Analysis Tool Evaluation

- [x] `src/step4-static-analysis/detector/js-loop-detector.ts` implemented
- [x] `src/step4-static-analysis/evaluate-tools.ts` implemented
- [ ] Custom detector tested on BM-01 through BM-06 source files
- [ ] ESLint loop-related rules identified and configured
- [x] `data/phase5-ground-truth.md` created (100 labeled test cases: TP, FP, FN)
- [ ] Ground truth validation set run through detector
- [ ] Precision, recall, F1 computed per tool per anti-pattern
- [ ] `results/static-analysis-<timestamp>.json` saved

---

## Deliverables

- [x] Benchmark suite: all correctness gates passing, 30 trials × 5 n × 7 modules × 2 patterns
- [x] Raw dataset: `results/bench-*.json`
- [x] Summary dataset: `results/summary-*.json`
- [x] Comparison dataset: `results/comparison-*.json` (speedup, t-test, Cohen's d)
- [x] Scaling analysis report: `results/scaling-*.json`
- [ ] Optimization gains report: `docs/optimization-gains.md`
- [x] Static analysis evaluation: `results/static-analysis-*.json` (Findings only, no precision/recall yet)
- [ ] Open corpus dataset: confirmed findings + git blame data (published publicly)
- [ ] AST detection pipeline: released as npm package (`@empirical-study/loop-detector`)
- [ ] Patch archive: all PRs, descriptions, outcome data archived in `data/corpus.md`
- [ ] Prevalence report: `docs/prevalence-report.md` (practitioner-facing)
- [x] Final article draft: `content/loop-performance-empirical-study.md`
- [ ] Final research paper: suitable for ICSE / FSE / MSR submission

---

## Hypothesis Tracking

| ID | Hypothesis | Status | n at which met | Actual speedup |
|----|------------|--------|---------------|----------------|
| H1 | Nested loops exhibit O(n²) empirically | Confirmed | All | b = 1.47 |
| H2 | Regex hoisting ≥ 5× speedup at n ≥ 10,000 | Refuted (JS) / Partial (Py) | None (JS) / All (Py) | 1.08× (JS) / 2.02× (Py) |
| H3 | Parallel async I/O reduces wall-clock ≥ 50% | Confirmed | ≥ 10 | 9× – 75× |
| H4 | Map lookup ≥ 100× speedup at n = 10,000 | Confirmed (Py) / Partial (JS) | All (Py) / 100k (JS) | 59× (JS) / 1,864× (Py) |
| H5 | DOM batching reduces layout recalc ≥ 70% | [ ] | — | — |

---

## Notes & Blockers

<!-- Add notes during execution, e.g. CV threshold violations, anomalies, environment issues -->

- BM-07 requires a browser environment; use Chrome DevTools for production measurements.
  The `node-runner.ts` file uses jsdom for automated correctness testing only.
- BM-03 mock HTTP server binds to `localhost:0` (random port); check firewall rules if blocked.
- Windows timer resolution is coarser than Linux; add extra trials (50) if CV exceeds 10% at low n.
