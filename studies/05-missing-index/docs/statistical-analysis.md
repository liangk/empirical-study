# Study 05: Statistical Analysis Methods

## Summary Statistics (per configuration)

For each (module, pattern, n) triple, computed over 30 trials:

| Statistic | Formula | Purpose |
|-----------|---------|---------|
| Mean | Σxᵢ / n | Point estimate (sensitive to outliers) |
| **Median** | Middle value when sorted | **Primary estimate** — robust to I/O spikes |
| Std dev | √(Σ(xᵢ - μ)² / (n-1)) | Spread measure |
| P05 / P95 | 5th / 95th percentile | Tail behavior |
| CV | σ / μ | Acceptance threshold: < 15% |

## Speedup Ratio

```
speedup = median(baseline_trials) / median(optimized_trials)
```

A speedup > 1.0 means the optimized configuration is faster. A speedup of 10× means the baseline takes 10× longer than the optimized.

## Paired t-Test

Tests whether the population means of baseline and optimized are different:
- H₀: μ_baseline = μ_optimized
- H₁: μ_baseline > μ_optimized (one-tailed; we expect baseline to be slower)
- Threshold: p < 0.05 to reject H₀

The t-statistic for paired samples (same query, same database state, sequential trials):
```
t = mean(baseline - optimized) / (stddev(baseline - optimized) / √n)
```

Note: Trials are not truly paired (baseline and optimized run in separate sessions), so we use the independent two-sample t-test with Welch's correction for unequal variances.

## Cohen's d (Effect Size)

```
d = |μ_baseline - μ_optimized| / σ_pooled
```

where `σ_pooled = √((σ₁² + σ₂²) / 2)`.

Interpretation scale:
- d < 0.2: Negligible
- 0.2 ≤ d < 0.5: Small
- 0.5 ≤ d < 0.8: Medium
- d ≥ 0.8: **Large** (practically significant)

## Power-Law Regression (Scaling Analysis)

Fits `t(n) = a × n^b` via log-log OLS:
```
log(t) = log(a) + b × log(n)
```

- **b ≈ 0**: Effectively constant (O(1)) — ideal index scan
- **b ≈ 0.3**: O(log n) growth — typical B-tree index
- **b ≈ 1.0**: Linear (O(n)) — sequential scan
- **b > 1.0**: Super-linear — sort-heavy operations

R² (coefficient of determination) measures goodness of fit. R² > 0.90 indicates the power-law model is an appropriate description of the scaling behavior.

## EXPLAIN ANALYZE Plan Classification

For each benchmark configuration, one trial is run with `EXPLAIN (ANALYZE, FORMAT JSON)` to capture the query plan. The top-level node type is extracted:

| Plan type | Meaning |
|-----------|---------|
| `Seq Scan` | Full table scan — no index used |
| `Index Scan` | B-tree index used; fetches heap for non-indexed columns |
| `Index Only Scan` | Covering index; no heap fetch needed |
| `Bitmap Index Scan` → `Bitmap Heap Scan` | Index used but multiple matching rows gathered via bitmap first |

Plan type transitions (e.g., Seq Scan → Index Scan) confirm that the index is being used by the planner and that the speedup is attributable to the index, not some other factor.
