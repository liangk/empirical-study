# Study 06: Resource Leak Patterns — Implementation Checklist

> Status legend: `[ ]` = pending · `[x]` = done · `[~]` = in progress · `[!]` = blocked

---

## Phase 0 — Setup

- [x] Create `studies/06-resource-leaks/` folder structure
- [x] `package.json` created
- [x] `tsconfig.json` created
- [x] `.gitignore` created
- [x] `data/corpus.md` created (400 repos, 8 domains × 50)
- [x] `docs/methodology.md` created
- [x] `docs/benchmark-specs.md` created
- [x] `docs/statistical-analysis.md` created
- [x] `src/step1-benchmarks/harness/` created (types, runner, stats)
- [ ] `npm install` run successfully
- [ ] Verify all modules compile with `tsc --noEmit`

---

## Phase 1 — Controlled Failure Simulation

### BM-01 — Database Connection Pool Exhaustion

- [x] `src/step1-benchmarks/modules/bm01-db-connection/index.ts` implemented
- [ ] Correctness gate: leaky variant accumulates connections, proper variant stays at 0
- [ ] Sanity run (5 trials at n=10) — leak rate > 0 for leaky, ~0 for proper
- [ ] Full 30-trial run at n = 10, 50, 100, 500, 1000
- [ ] H1 result: pool exhaustion within 10 iterations (pool size = 10)?

### BM-02 — File Descriptor Exhaustion (EMFILE)

- [x] `src/step1-benchmarks/modules/bm02-file-descriptor/index.ts` implemented
- [ ] Correctness gate: FD count grows for leaky, stays at 0 for proper
- [ ] Full 30-trial run
- [ ] H2 result: EMFILE within ~1000 iterations?

### BM-03 — Stream Leak on Error Path

- [x] `src/step1-benchmarks/modules/bm03-stream-leak/index.ts` implemented
- [ ] Correctness gate: handle count grows for leaky
- [ ] Full 30-trial run
- [ ] H3 result: memory growth ≥1KB/iteration?

### BM-04 — HTTP Socket Leak

- [x] `src/step1-benchmarks/modules/bm04-http-socket/index.ts` implemented
- [ ] Correctness gate: socket count accumulates for leaky
- [ ] Full 30-trial run
- [ ] H4 result: socket accumulation measurable within 500 iterations?

### BM-05 — Timer/Interval Leak

- [x] `src/step1-benchmarks/modules/bm05-timer-leak/index.ts` implemented
- [ ] Correctness gate: timer count grows for leaky, 0 for proper
- [ ] Full 30-trial run
- [ ] H5 result: 1000 leaked intervals consume ≥5MB?

### BM-06 — Event Listener Accumulation

- [x] `src/step1-benchmarks/modules/bm06-event-listener/index.ts` implemented
- [ ] Correctness gate: listener count grows for leaky
- [ ] Full 30-trial run
- [ ] H6 result: 1000 leaked listeners consume ≥4MB?

### Orchestration

- [x] `src/step1-benchmarks/run-all.ts` implemented
- [ ] `npm run bench:all` completes without errors
- [ ] Results written to `results/bench-*.json`, `summary-*.json`, `comparison-*.json`

---

## Phase 2 — Scaling / Exhaustion Analysis

- [x] `src/step2-scaling/fit-curves.ts` implemented
- [ ] `npm run scaling` produces `results/scaling-*.json`
- [ ] Leak rate vs. n is linear for leaky patterns
- [ ] Leak rate ≈ 0 for proper patterns
- [ ] Production TTF projections computed for all modules

---

## Phase 3 — Real-World Corpus Profiling

- [x] `src/step3-realworld/corpus.ts` implemented (corpus parser)
- [x] `src/step3-realworld/scanner.ts` implemented (clone + scan)
- [ ] `npm run realworld:scan` completes for all 400 repos
- [ ] `results/findings-*.json` generated
- [ ] `results/prevalence-*.json` generated
- [ ] Prevalence rate computed (% repos with ≥1 finding)
- [ ] Pattern distribution analyzed

---

## Phase 4 — Static Analysis Detector

- [x] `src/step4-static-analysis/detector/resource-leak-detector.ts` implemented
- [ ] `npm run detect -- --path <target>` works on test projects
- [ ] Precision/recall evaluation on labeled ground truth (50 TP + 50 TN)
- [ ] F1 per detection category computed

---

## Phase 5 — Report / Article

- [ ] Blog article written in astro-blog format
- [ ] Frontmatter, SEO, AIEO metadata
- [ ] Benchmark results tables
- [ ] Corpus scan findings
- [ ] Production TTF projections
- [ ] Practical fixes and Code Evolution Lab integration
