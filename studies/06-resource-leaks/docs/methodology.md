# Study 06: Methodology

## Overview

This study uses a four-phase methodology: controlled failure simulation, scaling/exhaustion analysis, real-world corpus profiling, and static analysis tool evaluation. Unlike CPU or query benchmarks (Studies 04/05), the primary metric here is **resource exhaustion rate** — how quickly a leaked resource (connection, file descriptor, socket, memory) accumulates to the point of failure.

---

## Phase 1: Controlled Failure Simulation

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

| Category | AST Pattern | Severity |
|----------|-------------|----------|
| `unclosed_connection` | `createConnection`/`connect`/`getConnection`/`createPool` without `close`/`end`/`release` in same function scope | High |
| `unclosed_stream` | `createReadStream`/`createWriteStream`/`pipe` without `close`/`destroy` | High |
| `unclosed_file_handle` | `fs.open`/`openSync`/`fs.promises.open` without `close` | High |
| `resource_without_cleanup` | `new WebSocket`/`Worker`/`EventSource`/`BroadcastChannel` without cleanup method | Medium |

### Scanner Protocol

1. Clone each repo (shallow, depth=1).
2. Find all `.ts` and `.js` files (excluding `node_modules`, `dist`, `build`, `.git`, test fixtures).
3. Parse each file with `@babel/parser` (JSX + TypeScript plugins).
4. Run all 4 detection rules via AST traversal.
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
| n values | 1K–1M rows | 10–1000 iterations |
| Corpus size | 40 repos | 400 repos |
| Detection tool | Prisma schema parser | Babel AST traversal |
