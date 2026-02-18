# Study 04: Loop Performance — Methodology

## Research Design

This study employs a **controlled experimental design** with repeated measures. Each anti-pattern/optimization pair is tested across all input sizes (`n`), with a minimum of **30 independent trials** per configuration to achieve statistical significance. Results are analyzed using paired t-tests and effect size measures (Cohen's d).

---

## Phases

### Phase 1 — Baseline Profiling

**Goal:** Establish a rigorous, noise-free performance baseline for the unoptimized anti-patterns. This serves as the control group ($C$) against which the experimental treatment ($E$, optimization) is measured.

**Fundamental Theory:**
Performance inefficiencies in loops stem from three primary sources:
1.  **Algorithmic Complexity ($O(f(n))$):** The growth rate of operations relative to input size (e.g., $O(n^2)$ for nested loops).
2.  **Runtime Overhead:** Dynamic dispatch, type checking, and garbage collection in managed languages (JS/Python).
3.  **Hardware Inefficiency:** Poor cache locality, branch misprediction, or pipeline stalls.

The baseline profile captures the *aggregate cost* of these factors. We hypothesize that for anti-patterns like "Nested Loops," algorithmic complexity dominates ($O(n^2)$), whereas for "Regex in Loop," runtime overhead (compilation) dominates ($O(n \times C_{compile})$).

**Procedure:**
1.  **Warm-up:** Execute the function repeatedly (50 iterations) to trigger JIT compilation (V8 Turbofan) and stabilize Inline Caches (ICs). Discard these measurements to avoid "cold start" bias.
2.  **Isolation:** Ensure the benchmark process has exclusive core affinity (where possible) and minimize background OS noise.
3.  **Measurement:** For each input size $n \in \{10, \dots, 10^5\}$:
    *   Force Garbage Collection (GC) to clear heap.
    *   Record `process.hrtime.bigint()` (start).
    *   Execute the function under test.
    *   Record `process.hrtime.bigint()` (end).
    *   Capture memory deltas ($\Delta Heap$).
4.  **Sampling:** Collect $N=30$ independent samples to satisfy the requirements of the Central Limit Theorem, ensuring the sample mean approximates the population mean normally.

**Quality Gate:**
*   **Stability:** Coefficient of Variation ($CV = \sigma / \mu$) must be $\le 10\%$. High variance indicates external interference or non-deterministic GC pauses.

### Phase 2 — Optimization Application

**Goal:** Quantify the performance impact of specific code refactoring strategies (Treatments) under identical experimental conditions.

**Fundamental Theory:**
Optimizations operate on specific levers of the performance equation:
1.  **Algorithmic Reduction:** Transforming $O(n^2) \to O(n)$ (e.g., replacing inner array scan with Hash Map lookup). This yields exponential speedups at large $n$.
2.  **Work Reduction:** Hoisting invariant computations (e.g., Regex compilation) out of the loop. This reduces the constant factor $C$ in $O(n \times C)$.
3.  **Runtime Assistance:** Writing "monomorphic" code that allows the JIT compiler to generate efficient machine code (e.g., using typed arrays or avoiding hidden class changes).

**Procedure:**
1.  **Verification:** Validates that $Output_{opt}(x) \equiv Output_{base}(x)$ for all inputs $x$. Optimization must preserve semantics.
2.  **Paired Execution:** Run the optimized module using the *exact same* PRNG seeds and input sizes as Phase 1.
3.  **Statistical Inference:**
    *   Calculate **Speedup Ratio**: $S = \mu_{base} / \mu_{opt}$.
    *   **Hypothesis Testing:** Perform a paired t-test with $\alpha = 0.05$.
        *   $H_0$: $\mu_{base} = \mu_{opt}$ (No difference).
        *   $H_1$: $\mu_{base} > \mu_{opt}$ (Optimization is faster).
    *   **Effect Size:** Compute Cohen's $d$ to determine the *magnitude* of difference, independent of sample size.

**Quality Gate:**
*   **Regressions:** If $S < 1.0$ (slowdown), the optimization is rejected or marked as a "negative result" for specific $n$ (e.g., overhead of Map creation > $O(n^2)$ scan for very small $n$).

### Phase 3 — Scaling Analysis

**Goal:** Empirically derive the algorithmic complexity class ($O(f(n))$) of both baseline and optimized implementations to confirm theoretical expectations.

**Fundamental Theory:**
Runtime performance $T(n)$ can be modeled as a power law: $T(n) \approx c \cdot n^b$.
*   Taking the logarithm of both sides: $\ln(T(n)) \approx \ln(c) + b \cdot \ln(n)$.
*   This transforms the non-linear relationship into a linear equation $y = \alpha + \beta x$.
*   The slope $\beta$ (empirical exponent) corresponds to the complexity class:
    *   $\beta \approx 1.0 \implies O(n)$ (Linear)
    *   $\beta \approx 2.0 \implies O(n^2)$ (Quadratic)
    *   $\beta \approx 0.0 \implies O(1)$ (Constant)

**Procedure:**
1.  **Data Aggregation:** Compute the trimmed mean wall-time for each $n$ (excluding outliers > $3\sigma$).
2.  **Regression:** Perform Ordinary Least Squares (OLS) regression on the $(\ln n, \ln T)$ dataset.
3.  **Classification:** Map the resulting slope $b$ to the nearest standard complexity class.
    *   $0.9 \le b \le 1.1 \to O(n)$
    *   $1.8 \le b \le 2.2 \to O(n^2)$
4.  **Fit Quality:** Calculate the Coefficient of Determination ($R^2$) to assess how well the power law models the observed behavior.

**Quality Gate:**
*   **Goodness of Fit:** $R^2 \ge 0.95$. Lower values imply the performance is dominated by non-algorithmic factors (e.g., constant system noise, GC spikes) rather than input size.

### Phase 4 — Real-World Corpus Study and Community Contribution

**Goal:** Move beyond synthetic benchmarks to study loop inefficiencies as they exist in real, actively maintained open-source software. Phase 4 produces four contributions: (1) a prevalence study, (2) real-world performance measurement, (3) a patch contribution campaign, and (4) a git history analysis.

**Fundamental Theory:**
Synthetic benchmarks ("Clean Room") isolate variables but lack real software confounders:
*   **Cache Pollution:** Real applications process diverse data, evicting loop data from L1/L2 caches.
*   **Memory Pressure:** Higher heap usage increases GC frequency and cost.
*   **Polymorphism:** Real inputs are rarely monomorphic, potentially deoptimizing JIT code paths.

These factors can reduce speedup (optimization overhead outweighs gain at realistic data sizes) or amplify it (cache-friendly restructuring adds benefit beyond algorithmic improvement). Comparing real-world to synthetic speedups answers which direction dominates per pattern.

#### §4.1 Corpus Construction

40 repositories (20 JS/TS, 20 Python) systematically selected across 5 application domains (8 projects each):

| Domain | Representative Project Types |
|--------|------------------------------|
| Data Transformation | ETL libraries, CSV/JSON processors, schema validators |
| Web Serving | HTTP frameworks, middleware stacks, routing libraries |
| Build Tooling | Bundlers, linters, transpilers, task runners |
| UI / Rendering | Component libraries, template engines, charting libraries |
| Developer Utilities | CLI tools, test runners, code formatters |

Selection gates: ≥500 stars, active PR tracker, CI test suite >60% coverage, loop-intensive domain, no major-corporation primary authorship. Full corpus in `data/corpus.md`.

#### §4.2 Automated Anti-Pattern Detection

Each project is scanned with the AST-based static analysis pipeline:
*   **JS/TS:** Babel parser + custom visitor rules (`js-loop-detector.ts`) detect all 7 patterns.
*   **Python:** `ast` module visitor detects `json.loads` in loops, nested list comprehensions, sequential `await` in loops, and nested `for` statements.

All candidates are written to a structured findings database with: project, file, line, pattern type, loop depth, and confidence score (high/medium/low).

**Manual review:** High-confidence findings reviewed by one researcher; medium-confidence by two (disagreements resolved by discussion); low-confidence excluded.

#### §4.3 Prevalence Analysis

From the confirmed findings database:
*   **Prevalence rate:** % of projects with ≥1 instance per pattern type.
*   **Density:** instances per 1,000 LOC by domain and language.
*   **Co-occurrence:** Jaccard similarity between pattern occurrence vectors.
*   **Loop depth distribution:** histogram of nesting depth at which patterns are found.
*   **Age analysis:** `git log` used to determine median age of each instance (months since introduction).

#### §4.4 Real-World Performance Measurement

For up to 21 subjects (top 3 per pattern type by estimated collection size):
1.  Clone at latest stable release tag.
2.  Construct representative workload (project test suite or realistic driver dataset).
3.  Instrument the flagged loop with `performance.now()` / `perf_counter_ns()` wrappers.
4.  Record 30 trials baseline (Phase 1 protocol).
5.  Apply optimization; verify correctness against project test suite.
6.  Record 30 trials optimized.
7.  Compute speedup, improvement %, Cohen's $d$.
8.  Compare to corresponding synthetic BM-XX benchmark speedup.

#### §4.5 Patch Contribution Campaign

A patch is prepared and submitted as a PR for each confirmed + measured instance:
*   Minimal change (loop only), test suite passing.
*   PR description: plain-language explanation, measured speedup, before/after snippet.
*   Tracking: submission date, PR URL, outcome (merged/rejected/modified/pending).
*   Follow-up at 4 and 8 weeks for open PRs.
*   Outcome: acceptance rates by pattern type, domain, project size; rejection reasons qualitatively coded.

#### §4.6 Git History Analysis

For each confirmed instance, `git log -S` (pickaxe) identifies the introducing commit:
*   Author ID (anonymized), date, message keywords, PR association, PR review comment count.
*   **Survivorship count:** number of subsequent edits to the same file without fixing the loop.
*   **Coverage correlation:** statement coverage of the function containing the loop.

Aggregated findings: age distribution, % introduced via unreviewed commits, % where reviewers mentioned performance, mean survival count per pattern type.

**Quality Gate:**
*   **Reproducibility:** Extracted harnesses must run without crashing.
*   **Relevance:** Only loops on documented critical paths or measured to dominate execution time are selected for §4.4.

### Phase 5 — Static Analysis Tool Evaluation

**Goal:** Evaluate the effectiveness of automated tooling in detecting the 7 loop anti-patterns, quantifying the trade-off between Soundness (finding all bugs) and Completeness (avoiding false alarms).

**Fundamental Theory:**
Static analysis operates on the Abstract Syntax Tree (AST) or Control Flow Graph (CFG).
*   **Precision ($P$):** $\frac{TP}{TP + FP}$ — "When the tool complains, is it right?" (Crucial for developer trust).
*   **Recall ($R$):** $\frac{TP}{TP + FN}$ — "Did the tool find all valid instances?" (Crucial for safety/performance assurance).
*   **F1 Score:** $2 \cdot \frac{P \cdot R}{P + R}$ — Harmonic mean balancing both metrics.

**Procedure:**
1.  **Scanning:** Run the detector (AST-based for JS, AST-walker for Python) across the entire Corpus (Phase 4).
2.  **Manual Labeling (Ground Truth):** A human expert reviews a random sample of flagged issues (to estimate FP) and a random sample of unflagged code (to estimate FN - difficult, often estimated via known test cases).
    *   *Note:* For this study, we use a "Closed World" validation set of 50 known anti-pattern snippets and 50 clean snippets to rigorously calculate metrics.
3.  **Metric Calculation:** Compute Precision, Recall, and F1 for each of the 7 anti-pattern categories.

**Quality Gate:**
*   **Viability Threshold:** A tool is considered "viable" for CI/CD integration if Precision > 80% (low noise). Lower precision tools are only suitable for manual audit workflows.

---

## Environment Consistency

### Session Rules

- Baseline and optimized benchmarks for the same module **must** be run in the same session on the same machine.
- The same runtime version must be used for both conditions. Version is recorded in the data file per run.
- No software updates or configuration changes are permitted between a Phase 1 and Phase 2 session for the same module.

### Runtime Consistency

- Node.js is invoked with `--max-old-space-size` fixed to a constant value across all runs in a session.
- The same input data seed is used in both Phase 1 and Phase 2, ensuring both conditions process identical data.

### Timer Resolution Note

Windows' default `performance.now()` resolution is coarser than Linux or macOS, which can inflate variance at very small `n`. Researchers should note the platform in their data. Low-n configurations on Windows may require more trials to achieve the CV threshold.

---

## Warm-Up Protocol

JIT-compiled runtimes (V8, PyPy) require warm-up to reach steady-state performance.

| Runtime | Warm-Up Iterations | Rationale |
|---------|--------------------|-----------|
| Node.js (V8) | 50 | Empirically determined; variance drops below 2% across 10 consecutive iterations |
| Browser (Chrome headless) | 3 full passes | Allow V8 to reach steady state before CDP measurement |
| Python CPython | 10 | Minimal JIT effect |
| Python PyPy | 100 | Aggressive JIT compilation requires more warm-up |

Warm-up iterations are **never** included in the recorded dataset.

---

## Measurement Protocol

For each combination of `(module, n, environment)`:

1. Force garbage collection (where runtime API permits — Node.js `--expose-gc`, Python `gc.collect()`).
2. Record pre-trial memory snapshot (`process.memoryUsage()` → `heapUsed`, `rss`).
3. Record `process.hrtime.bigint()` start timestamp (nanosecond precision).
4. Execute the benchmark function exactly **once** per trial (not a repeated inner loop, to avoid optimizer unrolling effects).
5. Record end timestamp.
6. Record post-trial memory snapshot.
7. Record CPU time via `process.cpuUsage()`.
8. Sleep 200 ms between trials to allow the runtime to drain any deferred GC or I/O callbacks.
9. Repeat steps 1–8 for 30 independent trials.

For DOM benchmarks (BM-07), additional measurements are captured via Chrome DevTools:
- Layout recalculation duration (`Layout` trace event)
- Style recalculation duration (`UpdateLayoutTree` trace event)
- Main thread blocking time (sum of `TaskDuration` events > 50 ms)
- Paint and composite time

---

## Input Size Matrix

| n | Rationale |
|---|-----------|
| 10 | Small input — establishes fixed overhead baseline |
| 100 | Typical small collection in real applications |
| 1,000 | Common mid-range data size; JIT effects become visible |
| 10,000 | Large collection; O(n²) patterns begin to diverge significantly |
| 100,000 | Stress-test; exposes severe scalability issues |

**Notes:**
- BM-07 (DOM) is capped at `n = 10,000` due to browser memory constraints.
- BM-03 (async I/O) uses a mock HTTP server to eliminate network latency; only concurrency and scheduling overhead are measured.

---

## Data Recording Schema

All raw trial data is written to structured JSON files:

```json
{
  "moduleId": "BM-04",
  "pattern": "baseline",
  "environment": "node_lts",
  "n": 10000,
  "trial": 12,
  "wallTimeNs": 483920100,
  "cpuTimeMs": 481.5,
  "heapBeforeBytes": 10485760,
  "heapAfterBytes": 11534336,
  "rssBytes": 52428800,
  "timestampUtc": "2026-03-15T09:42:11Z",
  "platform": "win32",
  "nodeVersion": "20.11.0"
}
```

---

## CV Threshold Rule

After 30 trials, the coefficient of variation (CV = stddev / mean) is computed:
- **CV ≤ 10%**: proceed — data is stable.
- **CV > 10%**: pause and investigate variance source (background load, GC interference, thermal throttling) before accepting the data.

---

## Optimization Correctness Gate (Phase 2)

Before any optimized benchmark enters measurement:

1. Generate 100 deterministic test cases at `n = 100`.
2. Compare output of baseline and optimized implementations element-by-element.
3. Cover edge cases: `n = 0`, `n = 1`, duplicate keys, empty strings, null values.
4. Any output mismatch **fails the gate** and blocks Phase 2 for that module.

---

## Anomaly Handling

If optimized configuration produces speedup < 1.0 (optimization is slower):

1. Flag the trial set and initiate root cause investigation.
2. Common causes: JIT deoptimization, increased GC pressure from Map/Set allocation, Promise scheduling overhead at small `n`.
3. If confirmed as genuine, retain in dataset and report transparently.
4. Perform sensitivity analysis to identify the crossover `n` at which the optimization becomes beneficial.
