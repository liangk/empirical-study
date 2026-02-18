# Study 04: Benchmark Module Specifications

Each module is an isolated, self-contained benchmark with no shared state between runs. Both baseline and optimized variants accept `n` as a parameter and generate deterministic synthetic input via a seeded PRNG.

---

## BM-01 — Regex Compilation Inside Loop

**Anti-pattern:** A regular expression literal or `new RegExp()` is constructed inside a loop body, causing recompilation on every iteration.

**Theoretical complexity:** O(n × regex_compile_cost) — the compile cost is a fixed overhead applied n times unnecessarily.

**Optimization strategy:** Hoist the regex constant outside the loop. The compiled regex object is reused across all iterations.

**Transformation type:** Constant extraction / hoisting.

**Synthetic data schema:**
- Array of `n` strings, each a date-like string in format `YYYY-MM-DD` (80%) or random alphanumeric (20%).
- Generated deterministically from seed `0xBEEF01`.

**Metric focus:** Execution wall-clock time, GC pressure (heap delta per trial).

**Input sizes:** n = 10, 100, 1,000, 10,000, 100,000.

**Hypothesis:** H2 — speedup ≥ 5× at n ≥ 10,000.

---

## BM-02 — JSON Parsing Inside Loop

**Anti-pattern:** `JSON.parse()` is called inside a loop on the same JSON string every iteration, re-parsing an unchanged value repeatedly.

**Theoretical complexity:** O(n × json_parse_cost) — parsing is redundant after the first call.

**Optimization strategy:** Parse the JSON string once before the loop and reuse the resulting object.

**Transformation type:** Memoization / hoisting.

**Synthetic data schema:**
- A single JSON string representing an object with 20 fields (mix of string, number, boolean, nested object).
- Array of `n` access-key strings that each iteration uses to look up a field in the parsed object.
- Generated deterministically from seed `0xBEEF02`.

**Metric focus:** Execution wall-clock time, heap allocation delta.

**Input sizes:** n = 10, 100, 1,000, 10,000, 100,000.

---

## BM-03 — Sequential Async I/O Inside Loop

**Anti-pattern:** Each iteration of a `for` loop `await`s an async operation sequentially. Total time is the sum of all individual operation times.

**Theoretical complexity:** O(n × latency) sequential vs. O(latency) parallel (bounded by concurrency limit).

**Optimization strategy:** Replace sequential `await` with `Promise.all()` to parallelize all I/O operations.

**Transformation type:** Parallelization.

**Synthetic data schema:**
- Array of `n` item IDs (integers 1..n).
- A local mock HTTP server responds with a fixed-size JSON payload (200 bytes) with a simulated delay of 2ms.
- Server binds to `localhost:0` (OS-assigned port) to avoid conflicts.

**Metric focus:** Total wall-clock time (latency sum vs. max-latency parallel).

**Input sizes:** n = 10, 100, 1,000, 10,000 (capped; 100,000 concurrent sockets are OS-limited).

**Hypothesis:** H3 — wall-clock reduction ≥ 50% relative to sequential.

**Note:** Mock server delay is fixed at 2ms. The benchmark measures scheduling/concurrency overhead, not network variance.

---

## BM-04 — Nested Loops with Inner Linear Scan

**Anti-pattern:** An inner `forEach`/`for` loop searches through the second array on every iteration of the outer loop, yielding O(n²) comparisons.

**Theoretical complexity:** O(n²) baseline vs. O(n) optimized.

**Optimization strategy:** Pre-build a `Map` keyed by the join field before the outer loop. Each outer-loop iteration then does an O(1) `Map.get()` lookup instead of a linear scan.

**Transformation type:** Data structure substitution.

**Synthetic data schema:**
- Two arrays of `n` objects: `users` (id, name) and `orders` (userId, amount).
- `userId` values are drawn uniformly from 1..n (some users may have 0 or multiple orders).
- Generated deterministically from seed `0xBEEF04`.

**Metric focus:** Execution wall-clock time, scaling curve shape.

**Input sizes:** n = 10, 100, 1,000, 10,000, 100,000.

**Hypotheses:**
- H1 — empirical growth is superlinear (O(n²)) consistent with theory.
- H4 — Map-based speedup ≥ 100× at n = 10,000.

---

## BM-05 — Nested Array Methods (forEach-in-forEach)

**Anti-pattern:** An inner `forEach` is nested inside an outer `forEach`, creating O(n²) function call overhead on top of the computational work.

**Theoretical complexity:** O(n²) for the cross-product traversal.

**Optimization strategy:** Flatten to a single-pass loop using a combined approach (pre-aggregation or index-based traversal).

**Transformation type:** Loop fusion.

**Synthetic data schema:**
- A 2D array of `n × m` integers where `m = min(n, 100)` (capped to keep total work bounded at large n).
- Values are integers 0–255.
- Generated deterministically from seed `0xBEEF05`.

**Metric focus:** Execution wall-clock time, function call overhead.

**Input sizes:** n = 10, 100, 1,000, 10,000, 100,000.

---

## BM-06 — Chained Array Methods (Multi-Pass)

**Anti-pattern:** `array.filter(predicate).map(transform)` creates an intermediate array and iterates the input twice (two full passes).

**Theoretical complexity:** O(2n) baseline vs. O(n) optimized — constant factor improvement, not asymptotic.

**Optimization strategy:** Fuse into a single `reduce()` or `for` loop that applies both predicate and transform in one pass, eliminating the intermediate array allocation.

**Transformation type:** Loop fusion / single-pass reduction.

**Synthetic data schema:**
- Array of `n` objects with fields: `{ id: number, value: number, active: boolean }`.
- Predicate: `active === true` (approximately 50% pass rate).
- Transform: `{ id, doubled: value * 2 }`.
- Generated deterministically from seed `0xBEEF06`.

**Metric focus:** Execution wall-clock time, heap allocation (intermediate array savings).

**Input sizes:** n = 10, 100, 1,000, 10,000, 100,000.

---

## BM-07 — DOM Manipulation Inside Loop (Browser Only)

**Anti-pattern:** Appending to `innerHTML` inside a loop forces a layout recalculation and reflow on every iteration, as the browser re-parses and re-renders the DOM tree.

**Theoretical complexity:** O(n × layout_cost) where `layout_cost` grows with DOM tree size.

**Optimization strategy:** Build all DOM nodes into a `DocumentFragment` in the loop (no layout effect), then perform a single `appendChild(fragment)` to commit all changes at once.

**Transformation type:** Batching / deferred write.

**Synthetic data schema:**
- Array of `n` strings (simulated list item labels, e.g., `"Item 42"`).
- Container is a `<ul id="list">` element, reset between trials.

**Metric focus:** Layout recalculation duration (Chrome DevTools `Layout` trace event), main thread blocking time, UI thread frame budget.

**Input sizes:** n = 10, 100, 1,000, 10,000 (capped — browser memory limits).

**Environment:** Chrome DevTools (Performance tab) for production measurements.
The `node-runner.ts` file provides jsdom-based simulation for automated correctness testing only.

**Hypothesis:** H5 — layout recalculation time reduction ≥ 70%.
