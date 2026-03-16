# Study 06: Statistical Analysis Plan

## Overview

Resource leak benchmarks differ from speedup benchmarks (Studies 04/05). The primary metrics are **resource accumulation rate** (slope) and **time-to-failure** (TTF), not speedup ratios. We still use paired comparisons and effect sizes to validate that proper cleanup eliminates the leak.

---

## Per-Module Analysis

For each (module, n) pair, 30 trials of the leaky pattern and 30 trials of the proper pattern produce:

### 1. Resource Accumulation Rate

Linear regression on resource count vs. iteration within each trial:

```
resources(i) = a + b × i
```

- **b_leaky**: leak rate (resources per iteration) for leaky pattern
- **b_proper**: leak rate for proper cleanup pattern
- **Expected**: b_leaky > 0, b_proper ≈ 0

Report median `b` across 30 trials for each pattern.

### 2. Memory Growth Rate

Linear regression on `heapUsed` vs. iteration:

```
heap(i) = a + b × i    (bytes per iteration)
```

- **b** is the **leak budget** — bytes leaked per operation.
- At production request rates (e.g., 100 req/s), project time until OOM: `TTF_oom = heap_limit / (b × rate)`.

### 3. Time-to-Failure (TTF)

For modules with hard failure thresholds (BM-01 pool, BM-02 EMFILE):

- Record the iteration index at which the system error occurs.
- Report median TTF across 30 trials.
- Predicted TTF: `(limit - initial) / b_leaky`.
- Compare predicted vs. observed TTF.

---

## Statistical Tests

### Paired Welch's t-test

Compare leaky vs. proper cleanup on:
- Final resource count at iteration n
- Total memory growth over n iterations
- Leak rate (slope b)

Null hypothesis: μ_leaky = μ_proper. Reject at p < 0.05.

### Cohen's d (Effect Size)

```
d = |μ_leaky - μ_proper| / σ_pooled
```

- d > 0.8 = large effect (expected for all modules)
- Report per module and per n value.

### Summary Statistics

Per (module, pattern, n):
- mean, median, stddev, p05, p95, CV
- Applied to: final resource count, memory growth, leak rate slope

---

## Scaling Analysis

### Leak Rate vs. Iteration Count

For each module, plot resource count at final iteration vs. n (10, 50, 100, 500, 1000).

Expected for leaky pattern: linear relationship (resources = b × n).
Expected for proper pattern: flat (resources ≈ constant).

### Production Projection

Using the empirical leak rate `b`, project failure timelines at realistic request rates:

| Rate | Description | TTF formula |
|------|-------------|-------------|
| 1 req/s | Low-traffic API | `limit / b` seconds |
| 10 req/s | Moderate SaaS | `limit / (b × 10)` seconds |
| 100 req/s | High-traffic production | `limit / (b × 100)` seconds |
| 1000 req/s | Peak load | `limit / (b × 1000)` seconds |

---

## Corpus Analysis

### Prevalence Metrics

- **Repo prevalence**: % of repos with ≥1 finding
- **Per-pattern prevalence**: % of repos with each pattern type
- **Finding density**: findings per 1000 lines of code
- **Top offenders**: repos ranked by total findings

### Pattern Distribution

Report counts and percentages for each detection category:
- `unclosed_connection`
- `unclosed_stream`
- `unclosed_file_handle`
- `resource_without_cleanup`

---

## Why Leak Rate Over Speedup

In Studies 04/05, the optimized pattern was faster — the question was "how much faster?"

In Study 06, the proper cleanup pattern is not necessarily faster per iteration. It may even be marginally slower (cleanup takes time). The question is: **does the leaky pattern accumulate resources that eventually cause failure?** The metric that captures this is the leak rate slope `b`, not a speedup ratio.

We still report per-iteration timing to confirm that proper cleanup has negligible overhead (expected: <5% slower per iteration).
