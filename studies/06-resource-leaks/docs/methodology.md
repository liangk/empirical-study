# Study 06: Methodology

## Overview

This study uses a four-phase methodology: controlled failure simulation, scaling/exhaustion analysis, real-world corpus profiling, and static analysis tool evaluation. Unlike CPU or query benchmarks (Studies 04/05), the primary metric here is **resource exhaustion rate** — how quickly a leaked resource (connection, file descriptor, socket, memory) accumulates to the point of failure.

---

## Phase 1: Controlled Failure Simulation (Baseline)

### Environment

- **Runtime:** Node.js ≥ 18
- **OS:** Windows x64 (same machine as Studies 04/05)
- **Database:** PostgreSQL ≥ 14 (for BM-01 connection pool tests)
- **Filesystem:** NTFS local disk (for BM-02/BM-03 file descriptor tests)
- **Network:** Loopback (for BM-04 HTTP socket tests)

### Benchmark Modules

| Module | Resource Type | Leak Pattern | Failure Mode |
|--------|--------------|--------------|--------------|
| BM-01 | DB connections | `createConnection` without `close` in request handler | Pool exhaustion → hang/timeout |
| BM-02 | File descriptors | `fs.open` / `openSync` without `close` | EMFILE (too many open files) |
| BM-03 | File streams | `createReadStream` without `destroy` on error | FD leak + memory growth |
| BM-04 | HTTP sockets | Outgoing `http.request` without `destroy`/`abort` | Socket hang-up, ECONNRESET |
| BM-05 | Timers | `setInterval` without `clearInterval` | Unbounded memory growth |
| BM-06 | Event listeners | `emitter.on` without `removeListener` | Memory growth + MaxListenersExceeded |

### Protocol

For each benchmark module:

1. **Baseline (leaky):** Execute the leaky pattern in a loop for `n` iterations (n = 10, 50, 100, 500, 1000).
2. **Measure per iteration:**
   - `process.memoryUsage().heapUsed` (bytes)
   - `process.memoryUsage().rss` (bytes)
   - Active handle count: `process._getActiveHandles().length`
   - Active request count: `process._getActiveRequests().length`
   - Module-specific: open FD count, connection pool size, listener count
3. **Record failure point:** The iteration at which a system error occurs (EMFILE, pool timeout, MaxListenersExceeded, OOM).
4. **Optimized (proper cleanup):** Execute the same workload with proper resource cleanup. Measure identical metrics.
5. **Compare:** Resource accumulation rate (leak slope) and time-to-failure (TTF).

### Trials

- 30 trials per module per `n` value.
- 5 warmup iterations (not recorded) to stabilize runtime state.
- Forced GC (`global.gc()`) between trials (run with `--expose-gc`).

### Timing

- `performance.now()` for wall-clock iteration time.
- `process.hrtime.bigint()` for high-resolution sub-ms measurements where needed.

### CV Threshold

CV < 15% across 30 trials. Resource exhaustion timings have inherent OS-level variance (FD limits, TCP socket recycling).

---

## Phase 1b: Two-Dimensional Impact Experiments

While Phase 1 establishes baseline leak rates under controlled conditions, real-world scenarios involve interactions between multiple parameters. Phase 1b explores these interactions via a **discrete-event pool simulator** that runs 2D parameter grids to show how leak impact varies across realistic workload conditions.

### Simulator Design

- **Discrete-event simulation:** No real async delays; fast execution (~seconds per grid)
- **Seeded PRNG (mulberry32):** Fully reproducible results across runs
- **Configurable pool:** Max connections, acquire timeout, query time, query jitter
- **Configurable workload:** Duration, concurrency, arrival pattern, burst size, leak probability, error rate, leak-on-error behavior
- **Metrics:** Time-to-exhaustion, failure rate, throughput, p95 latency, leaked connections, peak active connections

### Five Experiment Cases

Each case explores a 2D parameter grid (4–10 values per axis) to show when and how leaks become operationally critical.

#### Case 1: Leak Probability × Concurrency
**Research question:** How do small leak rates become catastrophic at high parallelism?

| Parameter | Values |
|-----------|--------|
| Leak probability (X) | 0%, 1%, 2%, 5%, 10%, 20% |
| Concurrency (Y) | 1, 5, 10, 20, 50, 100 |

**Fixed:** Pool size 20, query time 50ms, steady arrivals  
**Metrics:** Failure rate, time-to-exhaustion, throughput, leaked connections  
**Expected:** At low concurrency, 1% leak is invisible; at concurrency 100, it causes exhaustion within seconds.

#### Case 2: Query Time × Pool Size
**Research question:** When do long-held connections saturate the pool even with moderate leak rates?

| Parameter | Values |
|-----------|--------|
| Query time (X) | 5ms, 20ms, 50ms, 100ms, 200ms, 500ms, 1000ms |
| Pool size (Y) | 5, 10, 20, 50, 100 |

**Fixed:** 5% leak probability, concurrency 20  
**Metrics:** Throughput, failure rate, leaked connections, mean latency  
**Expected:** Small pool + long query = saturation even without leaks; leaks amplify the problem.

#### Case 3: Burst Size × Acquire Timeout
**Research question:** Do traffic spikes cause latency degradation or hard failures?

| Parameter | Values |
|-----------|--------|
| Burst size (X) | 1, 5, 10, 20, 30, 50 |
| Acquire timeout (Y) | 50ms, 100ms, 500ms, 1000ms, 2000ms, 5000ms |

**Fixed:** Pool size 20, 5% leak probability, bursts every 200ms  
**Metrics:** p95 latency, failure rate, throughput, peak active connections  
**Expected:** Large bursts + short timeout = hard failures; long timeout = latency spikes.

#### Case 4: Error Rate × Leak-on-Error Behavior
**Research question:** How does error frequency interact with cleanup-on-error patterns?

| Parameter | Values |
|-----------|--------|
| Error rate (X) | 0%, 1%, 5%, 10%, 15%, 20%, 30% |
| Leak-on-error + base leak (Y) | 8 combinations: cleanup vs no-cleanup × {0%, 2%, 5%, 10%} base leak |

**Fixed:** Pool size 20, concurrency 20  
**Metrics:** Leaked connections, failure rate, time-to-exhaustion, throughput  
**Expected:** Missing cleanup in error path amplifies leak rate dramatically when errors are frequent.

#### Case 5: Leak Probability × DB Max Connections
**Research question:** Cross-service blast radius — how does one leaking service exhaust shared DB budget?

| Parameter | Values |
|-----------|--------|
| Leak probability (X) | 0%, 1%, 2%, 5%, 10%, 20% |
| DB max connections (Y) | 5, 10, 20, 50, 100, 200 |

**Fixed:** Concurrency 20, query time 50ms  
**Metrics:** Time-to-exhaustion, failure rate, leaked connections, throughput  
**Expected:** Large DB pool hides leaks temporarily; small pool fails fast, limiting blast radius.

### Output Format

Each case produces:
- **Console tables:** 2D grids for each metric (failure rate, throughput, etc.)
- **JSON export:** `results/experiments-<timestamp>.json` with full grid data for visualization

### Parameter Configuration

All experiment parameters are hardcoded in the case files for reproducibility. To modify parameters: edit the `const` declarations at the top of each case file.

### BM-02 through BM-06: Extended Experiments

While BM-01 focuses on connection pool exhaustion, BM-02 through BM-06 cover file descriptors, streams, HTTP sockets, timers, and event listeners. Each module has **3 focused experiment cases** following the same 2D grid methodology.

**Common patterns across all modules:**
- **Case 1:** Leak Probability × Concurrency — fundamental scaling relationship
- **Case 2:** Module-specific resource parameter (file size, closure size, timeout, etc.)
- **Case 3:** Error Rate × Leak-on-Error OR performance-specific interaction

See `docs/experiment-design-bm02-06.md` for detailed case definitions, parameter ranges, and expected findings for each module.

---

## Phase 2: Scaling / Exhaustion Analysis

### Resource Accumulation Rate

For each module, fit a linear regression on resource count vs. iteration:

```
resources(i) = a + b × i
```

Where `b` is the **leak rate** (resources leaked per iteration). Compare:
- Leaky baseline: b > 0 (positive slope = leak)
- Proper cleanup: b ≈ 0 (flat = no leak)

### Time-to-Failure Model

For modules with hard failure thresholds (EMFILE, pool exhaustion):

```
TTF = (system_limit - initial_count) / leak_rate
```

Validate empirically: does the predicted TTF match the observed failure iteration?

### Memory Growth Rate

For memory-based leaks (BM-05, BM-06):

```
heap_growth(i) = a + b × i    (bytes per iteration)
```

Report `b` as the **leak budget** — bytes leaked per operation. At production request rates (e.g., 100 req/s), project time until OOM.

---

## Phase 3: Real-World Corpus Profiling

### Corpus Construction

400 Node.js repositories selected across 8 domains (50 per domain). Selection criteria:
- ≥ 100 GitHub stars
- Primary language: JavaScript or TypeScript
- Actively maintained (commits in last 18 months)
- Contains server-side or CLI code (not pure frontend)
- Has `package.json` with Node.js-relevant dependencies

### Detection Categories

All 6 detection patterns align with benchmark modules BM-01 through BM-06:

| Category | AST Pattern | Severity | Benchmark |
|----------|-------------|----------|-----------|
| `unclosed_connection` | `createConnection`/`connect`/`getConnection`/`createPool` without `close`/`end`/`release` in same function scope | High | BM-01 |
| `unclosed_file_handle` | `fs.open`/`openSync`/`fs.promises.open` without `close` | High | BM-02 |
| `unclosed_stream` | `createReadStream`/`createWriteStream`/`pipe` without `close`/`destroy` | High | BM-03 |
| `resource_without_cleanup` | `new WebSocket`/`Worker`/`EventSource`/`BroadcastChannel` without cleanup method | Medium | BM-04 |
| `unclosed_timer` | `setInterval`/`setTimeout` without `clearInterval`/`clearTimeout` | Medium | BM-05 |
| `unclosed_event_listener` | `on`/`addListener`/`addEventListener` without `off`/`removeListener` | Medium | BM-06 |

### Scanner Protocol

1. Clone each repo (shallow, depth=1).
2. Find all `.ts` and `.js` files (excluding `node_modules`, `dist`, `build`, `.git`, test fixtures).
3. Parse each file with `@babel/parser` (JSX + TypeScript plugins).
4. Run all 6 detection rules via AST traversal.
5. Record: repo, file, line, pattern type, severity, description.
6. Aggregate: findings per repo, prevalence rate, pattern distribution.

---

## Phase 4: Static Analysis Tool Evaluation

Ground truth constructed by:
1. Manually labeling 50 true positives (files with confirmed resource leaks) and 50 true negatives (files with proper cleanup).
2. Running the detector on all 100 labeled cases.
3. Computing precision, recall, F1 per detection category.

---

## Key Methodological Differences from Previous Studies

| Aspect | Study 05 (Indexes) | Study 06 (Resource Leaks) |
|--------|-------------------|--------------------------|
| Primary metric | Query speedup ratio | Resource exhaustion rate / TTF |
| Timing unit | Milliseconds | Milliseconds + resource counts |
| Baseline state | No index | No cleanup (leaky pattern) |
| Optimized state | With index | With proper cleanup |
| Failure mode | Slow query | System error (EMFILE, OOM, pool timeout) |
| CV threshold | 15% | 15% |
| n values | 1K–1M rows | 10–1000 iterations (Phase 1) + 2D grids (Phase 1b) |
| Corpus size | 40 repos | 400 repos |
| Detection tool | Prisma schema parser | Babel AST traversal |
| Multi-parameter analysis | Single n sweep | 5 two-dimensional experiment cases |
