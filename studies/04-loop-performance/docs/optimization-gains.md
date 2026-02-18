# Study 04: Optimization Gains Report

> **Status:** Template — fill in after Phase 2 statistical analysis is complete.
> All values below are placeholders. Run `npm run bench:all` then `npm run scaling` to populate `results/`.

---

## Summary Table

| Module | Anti-Pattern | Optimization | n=10 Speedup | n=1k Speedup | n=10k Speedup | n=100k Speedup | p-value | Cohen's d | H met? |
|--------|-------------|-------------|-------------|-------------|--------------|----------------|---------|-----------|--------|
| BM-01 | Regex in loop | Hoist regex | — | — | — | — | — | — | H2: ≥5×? |
| BM-02 | JSON parse in loop | Cache parse | — | — | — | — | — | — | — |
| BM-03 | Sequential async I/O | Promise.all | — | — | — | — | — | — | H3: ≥50%? |
| BM-04 | Nested loops O(n²) | Map O(n) | — | — | — | — | — | — | H1+H4: ≥100×? |
| BM-05 | Nested array methods | Flat loop | — | — | — | — | — | — | — |
| BM-06 | Chained filter+map | reduce() | — | — | — | — | — | — | — |
| BM-07 | DOM innerHTML loop | DocumentFragment | — | — | — (n≤10k) | — | — | — | H5: ≥70% layout? |

---

## Per-Module Detail

### BM-01 — Regex Compilation Hoisting

**Hypothesis H2:** Speedup ≥ 5× at n ≥ 10,000.

| n | Baseline mean (ms) | Optimized mean (ms) | Speedup | p-value | Cohen's d | CV (base) | CV (opt) |
|---|--------------------|---------------------|---------|---------|-----------|-----------|----------|
| 10 | — | — | — | — | — | — | — |
| 100 | — | — | — | — | — | — | — |
| 1,000 | — | — | — | — | — | — | — |
| 10,000 | — | — | — | — | — | — | — |
| 100,000 | — | — | — | — | — | — | — |

**Interpretation:** *(Fill after data collection — note expected behavior: constant-factor speedup; speedup should be roughly constant across n since overhead is per-iteration compilation cost.)*

**Memory delta (BM-01):**

| n | Baseline ΔHeap (KB) | Optimized ΔHeap (KB) | Reduction |
|---|---------------------|----------------------|-----------|
| 10,000 | — | — | — |

---

### BM-02 — JSON Parsing Hoisting

| n | Baseline (ms) | Optimized (ms) | Speedup | p-value | Cohen's d |
|---|---------------|----------------|---------|---------|-----------|
| 10 | — | — | — | — | — |
| 100 | — | — | — | — | — |
| 1,000 | — | — | — | — | — |
| 10,000 | — | — | — | — | — |
| 100,000 | — | — | — | — | — |

**Memory delta (BM-02):**

| n | Baseline ΔHeap (KB) | Optimized ΔHeap (KB) | Reduction |
|---|---------------------|----------------------|-----------|
| 10,000 | — | — | — |

---

### BM-03 — Sequential Async I/O → Promise.all

**Hypothesis H3:** Wall-clock reduction ≥ 50%, independent of payload size.

| n | Baseline (ms) | Optimized (ms) | Speedup | p-value | Cohen's d |
|---|---------------|----------------|---------|---------|-----------|
| 10 | — | — | — | — | — |
| 100 | — | — | — | — | — |
| 1,000 | — | — | — | — | — |
| 10,000 | — | — | — | — | — |

**Note:** BM-03 uses mock HTTP server; network latency is eliminated. Speedup reflects concurrency scheduling overhead only.

---

### BM-04 — Nested Loops → Map Lookup

**Hypothesis H1:** O(n²) growth empirically confirmed.
**Hypothesis H4:** Speedup ≥ 100× at n = 10,000.

| n | Baseline (ms) | Optimized (ms) | Speedup | p-value | Cohen's d |
|---|---------------|----------------|---------|---------|-----------|
| 10 | — | — | — | — | — |
| 100 | — | — | — | — | — |
| 1,000 | — | — | — | — | — |
| 10,000 | — | — | — | — | — |
| 100,000 | — | — | — | — | — |

**Scaling exponent (Phase 3):**

| Variant | Empirical exponent b | Theoretical | R² | Classification |
|---------|---------------------|-------------|-----|----------------|
| Baseline | — | 2.0 (O(n²)) | — | — |
| Optimized | — | 1.0 (O(n)) | — | — |

---

### BM-05 — Nested Array Methods → Flat Loop

| n | Baseline (ms) | Optimized (ms) | Speedup | p-value | Cohen's d |
|---|---------------|----------------|---------|---------|-----------|
| 10 | — | — | — | — | — |
| 100 | — | — | — | — | — |
| 1,000 | — | — | — | — | — |
| 10,000 | — | — | — | — | — |
| 100,000 | — | — | — | — | — |

---

### BM-06 — Chained filter+map → reduce()

| n | Baseline (ms) | Optimized (ms) | Speedup | p-value | Cohen's d |
|---|---------------|----------------|---------|---------|-----------|
| 10 | — | — | — | — | — |
| 100 | — | — | — | — | — |
| 1,000 | — | — | — | — | — |
| 10,000 | — | — | — | — | — |
| 100,000 | — | — | — | — | — |

**Note:** May show near-1× speedup at small n (JIT inlining / V8 Array method optimization). Speedup expected to grow with n as intermediate array allocation cost dominates.

---

### BM-07 — DOM Manipulation → DocumentFragment

**Hypothesis H5:** Layout recalculation time reduced ≥ 70%.

> **Note:** Timing from browser Chrome DevTools (not node-runner). Fill after browser measurement session.

| n | Baseline layout (ms) | Optimized layout (ms) | Reduction | Main thread blocking (ms) |
|---|--------------------- |-----------------------|-----------|--------------------------|
| 100 | — | — | — | — |
| 1,000 | — | — | — | — |
| 10,000 | — | — | — | — |

---

## Anomalies & Negative Results

*(Record any configurations where speedup < 1.0)*

| Module | n | Speedup | Root Cause Investigation | Crossover n |
|--------|---|---------|--------------------------|-------------|
| — | — | — | — | — |

---

## Scaling Analysis Summary (Phase 3)

> From `results/scaling-*.json`. Power-law fit: $T(n) \approx c \cdot n^b$.

| Module | Variant | b (empirical) | b (theoretical) | R² | Match? |
|--------|---------|--------------|----------------|-----|--------|
| BM-01 | Baseline | — | 1.0 | — | — |
| BM-01 | Optimized | — | 1.0 | — | — |
| BM-02 | Baseline | — | 1.0 | — | — |
| BM-02 | Optimized | — | 1.0 | — | — |
| BM-04 | Baseline | — | 2.0 | — | — |
| BM-04 | Optimized | — | 1.0 | — | — |
| BM-05 | Baseline | — | 2.0 | — | — |
| BM-05 | Optimized | — | 1.0 | — | — |
| BM-06 | Baseline | — | 1.0 | — | — |
| BM-06 | Optimized | — | 1.0 | — | — |

---

## Effect Size Interpretation

| Cohen's d | Classification | Practical Significance |
|-----------|---------------|------------------------|
| < 0.2 | Negligible | Optimization not worthwhile at this n |
| 0.2 – 0.5 | Small | Marginal benefit; context-dependent |
| 0.5 – 0.8 | Medium | Meaningful in performance-sensitive paths |
| > 0.8 | Large | Significant; optimize unconditionally |
