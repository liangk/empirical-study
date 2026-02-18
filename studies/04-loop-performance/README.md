# Study 04: Loop Performance — Empirical Analysis of Loop Inefficiencies

## Overview

This study quantifies the measurable impact of common loop inefficiencies on application performance, scalability, and resource consumption across JavaScript (Node.js) and Python runtimes. It pairs **controlled benchmarks** (baseline vs. optimized, 30 trials × 5 input sizes) with **static analysis tool evaluation** and **real-world corpus profiling**.

### Research Questions

1. **RQ1 — Magnitude:** How significantly do loop anti-patterns degrade performance vs. their optimized counterparts?
2. **RQ2 — Scaling:** How does degradation scale with input size `n` across O(n), O(n²), and async patterns?
3. **RQ3 — Context Sensitivity:** Do inefficiencies have different profiles in server-side vs. browser contexts?
4. **RQ4 — Optimization Gain:** What is the measurable gain (time, CPU, memory) from hoisting, batching, parallelization, Map/Set substitution?
5. **RQ5 — Detection Coverage:** How accurately do static analysis tools detect loop inefficiencies in real code?

---

## Anti-Pattern Modules

| Module | Anti-Pattern | Language | Optimization |
|--------|-------------|----------|--------------|
| BM-01 | Regex compilation inside loop | JS, Python | Hoist regex outside loop |
| BM-02 | JSON parsing inside loop | JS, Python | Parse once before loop |
| BM-03 | Sequential async I/O | JS (Node.js) | Replace with `Promise.all` |
| BM-04 | Nested loops (O(n²) inner scan) | JS, Python | Map-based O(1) lookup |
| BM-05 | Nested array methods (forEach-in-forEach) | JS | Flatten to single-pass loop |
| BM-06 | Chained array methods (multi-pass) | JS, Python | Single-pass `reduce` / loop |
| BM-07 | DOM manipulation inside loop | JS (browser) | Batch via `DocumentFragment` |

---

## Project Structure

```
studies/04-loop-performance/
├── CHECKLIST.md                     # Phase-by-phase implementation checklist
├── README.md
├── package.json
├── tsconfig.json
├── data/
│   └── corpus.md                    # 20 real-world repos for Phase 4 validation
├── docs/
│   ├── benchmark-specs.md           # Per-module specifications (data schema, complexity, metrics)
│   ├── methodology.md               # Full methodology (phases, protocols, environment)
│   └── statistical-analysis.md     # Statistical methods (t-test, Cohen's d, power-law regression)
├── results/                         # Output JSON (gitignored)
├── content/                         # Article drafts
└── src/
    ├── step1-benchmarks/
    │   ├── harness/
    │   │   ├── types.ts             # TrialRecord, BenchmarkSummary, ComparisonResult
    │   │   ├── runner.ts            # Trial runner: warmup, GC, timing, memory snapshots
    │   │   ├── stats.ts             # mean, median, stddev, t-test, Cohen's d, CV
    │   │   └── data-gen.ts          # Seeded deterministic input generators per module
    │   ├── modules/
    │   │   ├── bm01-regex/          # baseline.ts, optimized.ts
    │   │   ├── bm02-json/           # baseline.ts, optimized.ts
    │   │   ├── bm03-async-io/       # baseline.ts, optimized.ts
    │   │   ├── bm04-nested-loops/   # baseline.ts, optimized.ts
    │   │   ├── bm05-nested-array/   # baseline.ts, optimized.ts
    │   │   ├── bm06-chained-array/  # baseline.ts, optimized.ts
    │   │   └── bm07-dom/            # baseline.html, optimized.html, node-runner.ts
    │   ├── correctness/
    │   │   └── verify-all.ts        # Correctness gate: outputs must match for all modules
    │   └── run-all.ts               # Main entry: orchestrates all modules, saves results
    ├── step2-scaling/
    │   └── fit-curves.ts            # Power-law regression, empirical complexity estimation
    ├── step3-realworld/
    │   ├── corpus.ts                # Load and parse data/corpus.md
    │   └── profiler.ts              # Clone repos, detect hot loops, profile with optimization
    └── step4-static-analysis/
        ├── detector/
        │   └── js-loop-detector.ts  # Custom AST-based loop anti-pattern detector
        └── evaluate-tools.ts        # Run detectors, label TP/FP/FN, compute precision/recall/F1
```

---

## Prerequisites

- **Node.js** ≥ 18 (required for `performance` global and modern APIs)
- **Git** (for cloning corpus repos in Phase 4)
- **npm** (for dependency installation)

## Setup

```bash
cd studies/04-loop-performance
npm install
```

## Execution

### Phase 1 & 2 — Benchmarks (baseline + optimized)

```bash
# Verify correctness first (required before benchmarking)
npm run bench:verify

# Run all 7 modules (baseline + optimized, all n values)
npm run bench:all

# Run individual modules
npm run bench:bm01   # Regex hoisting
npm run bench:bm02   # JSON parse caching
npm run bench:bm03   # Sequential vs parallel async I/O
npm run bench:bm04   # Nested loops vs Map lookup
npm run bench:bm05   # Nested array methods vs single-pass
npm run bench:bm06   # Chained array methods vs reduce
```

> **BM-07 (DOM manipulation)** runs in-browser. Open `src/step1-benchmarks/modules/bm07-dom/baseline.html`
> and `optimized.html` in Chrome DevTools with Performance tab recording active.

### Phase 3 — Scaling Analysis

```bash
# Fit empirical complexity curves from collected results
npm run scaling -- --input results/bench-latest.json
```

### Phase 4 — Real-World Corpus Profiling

```bash
npm run realworld:scan
```

### Phase 5 — Static Analysis Tool Evaluation

```bash
npm run detect -- --path <target-directory>
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run bench:all` | Run all 7 benchmark modules (baseline + optimized) |
| `npm run bench:bm<N>` | Run a single module (01–06); pass `--n <value>` to test one size |
| `npm run bench:verify` | Correctness gate — must pass before any benchmarking |
| `npm run scaling` | Fit power-law curves to results JSON |
| `npm run realworld:scan` | Clone corpus repos, profile hot loops |
| `npm run detect` | Run static analysis detectors on a target directory |

## CLI Flags (run-all.ts)

| Flag | Default | Description |
|------|---------|-------------|
| `--module <id>` | all | Run only the specified module (e.g. `BM-04`) |
| `--n <value>` | all | Run only at a specific input size |
| `--trials <count>` | 30 | Number of independent trials per configuration |
| `--warmup <count>` | 50 | Warm-up iterations before measurement |
| `--output <path>` | `results/bench-<timestamp>.json` | Override output path |

## Output Files

| File | Contents |
|------|----------|
| `results/bench-<timestamp>.json` | Raw trial records per module, pattern, n |
| `results/summary-<timestamp>.json` | Summary statistics per configuration |
| `results/comparison-<timestamp>.json` | Speedup ratios, t-test, Cohen's d per configuration |
| `results/scaling-<timestamp>.json` | Empirical complexity exponents per module |
| `results/realworld-<timestamp>.json` | Real-world corpus profiling results |
| `results/static-analysis-<timestamp>.json` | Precision/recall/F1 per tool |

## Articles

Published versions in `content/`.
