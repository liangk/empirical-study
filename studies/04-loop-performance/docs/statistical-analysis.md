# Study 04: Statistical Analysis Methods

## Summary Statistics

For each `(module, n, environment, pattern)` configuration, computed from 30 trials:

| Statistic | Formula / Description |
|-----------|----------------------|
| Mean wall-clock time | `μ = Σtᵢ / 30` |
| Median wall-clock time | Middle value of sorted trials |
| Standard deviation | `σ = √(Σ(tᵢ − μ)² / (30 − 1))` (sample) |
| Coefficient of variation | `CV = σ / μ × 100%` |
| p05, p25, p75, p95 | 5th, 25th, 75th, 95th percentile |
| Min / Max | Flagged if `max/min > 3×` (outlier contamination) |
| Mean heap delta | `mean(heapAfter − heapBefore)` per trial |
| Peak heap delta | `max(heapAfter − heapBefore)` across trials |

**CV Threshold:** Any configuration with CV > 10% is flagged for re-collection.

---

## Comparative Metrics (Phase 1 vs Phase 2)

### Speedup Ratio

```
speedup = mean_wall_time_baseline / mean_wall_time_optimized
```

A speedup of 1.0 means no improvement. Speedup < 1.0 means the optimization is slower (anomaly — see anomaly handling).

### Percent Improvement

```
improvement_pct = ((mean_baseline − mean_optimized) / mean_baseline) × 100
```

### Memory Reduction Ratio

```
memory_reduction = mean_heap_delta_baseline / mean_heap_delta_optimized
```

Only meaningful for modules where memory allocation is a primary metric (BM-01, BM-02, BM-06).

---

## Statistical Significance — Paired t-Test

A paired two-sample t-test is applied to the 30 baseline trials versus 30 optimized trials for each configuration.

**Null hypothesis:** H₀: μ_baseline = μ_optimized (no performance difference).

**Test statistic:**
```
t = (mean_diff) / (stddev_diff / √n_trials)

where:
  mean_diff  = mean(baseline_tᵢ − optimized_tᵢ)
  stddev_diff = std(baseline_tᵢ − optimized_tᵢ)
  n_trials   = 30
```

**Significance level:** α = 0.05 (two-tailed).

Results with **p > 0.05** are reported as not statistically significant and are **not** used to support optimization claims.

---

## Effect Size — Cohen's d

```
d = (mean_baseline − mean_optimized) / pooled_stddev

where:
  pooled_stddev = √((σ²_baseline + σ²_optimized) / 2)
```

**Effect size thresholds:**

| Cohen's d | Interpretation |
|-----------|---------------|
| d < 0.2 | Negligible |
| 0.2 ≤ d < 0.5 | Small |
| 0.5 ≤ d < 0.8 | Medium |
| d ≥ 0.8 | Large |

---

## Scaling Analysis — Power-Law Regression (Phase 3)

To estimate empirical complexity, wall-clock time `t` is modelled as:

```
t = a × nᵇ
```

Linearized via log transformation:

```
log(t) = log(a) + b × log(n)
```

A simple linear regression on `(log n, log t)` yields the empirical exponent `b`.

**Interpretation:**
- `b ≈ 1.0` → O(n) — linear
- `b ≈ 2.0` → O(n²) — quadratic (expected for BM-04 baseline)
- `b ≈ 0.0` → O(1) — constant (amortized, e.g., BM-03 optimized)

**Fit quality:** Report R² (coefficient of determination). Low R² (< 0.95) indicates non-power-law behaviour (e.g., JIT effects, cache boundaries).

---

## Static Analysis Evaluation — Precision, Recall, F1 (Phase 5)

For each tool and each anti-pattern:

```
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 × (Precision × Recall) / (Precision + Recall)
```

Where:
- **TP (True Positive):** Tool correctly identifies a loop anti-pattern.
- **FP (False Positive):** Tool flags code that is not an anti-pattern (or is already optimized).
- **FN (False Negative):** Tool misses a real anti-pattern.

Ground truth is established by manual code review by two independent reviewers. Disagreements are resolved by discussion and majority.

**Reporting format per tool per anti-pattern:**

| Module | TP | FP | FN | Precision | Recall | F1 |
|--------|----|----|----|-----------|--------|----|
| BM-01 (regex) | — | — | — | — | — | — |
| BM-04 (nested) | — | — | — | — | — | — |
| ... | | | | | | |
