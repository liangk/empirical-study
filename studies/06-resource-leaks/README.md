# Study 06: Resource Leak Patterns in Production

Empirical analysis of resource leak patterns in Node.js applications — connection pool exhaustion, file descriptor leaks, stream leaks, socket leaks, timer leaks, and event listener accumulation.

## Research Objectives

1. Identify the most common resource leak patterns in Node.js codebases
2. Measure time-to-failure for each leak type under controlled conditions
3. Quantify resource accumulation rates and memory growth
4. Scan 400 production repositories to determine real-world prevalence
5. Validate detection rules used in [Code Evolution Lab](https://codeevolutionlab.com)

## Benchmark Modules

| Module | Resource | Leak Pattern | Failure Mode |
|--------|----------|-------------|--------------|
| BM-01 | DB connections | `connect()` without `release()` | Pool exhaustion |
| BM-02 | File descriptors | `fs.open()` without `close()` | EMFILE |
| BM-03 | File streams | `createReadStream()` without `destroy()` | FD + memory leak |
| BM-04 | HTTP sockets | `http.request()` without `destroy()` | Socket accumulation |
| BM-05 | Timers | `setInterval()` without `clearInterval()` | Memory growth |
| BM-06 | Event listeners | `emitter.on()` without `off()` | Memory + MaxListeners |

## Detection Categories

| Category | Severity | AST Pattern |
|----------|----------|-------------|
| `unclosed_connection` | High | DB connect/open without close/release |
| `unclosed_stream` | High | createReadStream/createWriteStream without destroy |
| `unclosed_file_handle` | High | fs.open without close |
| `resource_without_cleanup` | Medium | new WebSocket/Worker without cleanup |
| `unclosed_timer` | Medium | setInterval/setTimeout without clearInterval/clearTimeout |
| `unclosed_event_listener` | Medium | .on/.addListener without .off/.removeListener |

## Quick Start

```bash
# Install dependencies
npm install

# Run all benchmarks (requires --expose-gc for accurate GC measurements)
node --expose-gc -r ts-node/register src/step1-benchmarks/run-all.ts

# Run a single module
npm run bench:bm01

# Run two-dimensional impact experiments
npm run experiments          # All 5 cases
npm run experiments:case1    # Leak probability × Concurrency
npm run experiments:case2    # Query time × Pool size
npm run experiments:case3    # Burst size × Acquire timeout
npm run experiments:case4    # Error rate × Leak-on-error behavior
npm run experiments:case5    # Leak probability × DB max connections

# Run scaling analysis (requires bench results)
npm run scaling

# Scan real-world repos
npm run realworld:scan

# Run the detector on your own project
npm run detect -- --path /path/to/your/project
```

## Two-Dimensional Impact Experiments

Beyond baseline leak rate measurements, we explore **parameter interactions** via discrete-event simulation.

### BM-01: Connection Pool Exhaustion (5 cases)

| Case | X-Axis | Y-Axis | Shows |
|------|--------|--------|-------|
| 1 | Leak probability (0–20%) | Concurrency (1–100) | How small leaks become catastrophic at high parallelism |
| 2 | Query time (5–1000ms) | Pool size (5–100) | When long-held connections saturate the pool |
| 3 | Burst size (1–50) | Acquire timeout (50–5000ms) | Whether spikes cause latency or hard failures |
| 4 | Error rate (0–30%) | Leak-on-error + base leak | Missing cleanup in error paths amplifies leak rate |
| 5 | Leak probability (0–20%) | DB max connections (5–200) | Cross-service blast radius |

**Run with:**
```bash
npm run experiments           # All BM-01 cases
npm run experiments:case1     # Individual case
```

### BM-02 through BM-06: Extended Experiments (3 cases each)

Each module (File Descriptors, Streams, HTTP Sockets, Timers, Event Listeners) has **3 focused experiment cases**:

**Common Case 1:** Leak Probability × Concurrency — how leaks scale with parallelism  
**Module-specific Case 2:** Resource-specific parameter interactions  
**Common Case 3:** Error Rate × Leak-on-Error OR performance-specific thresholds

See `docs/experiment-design-bm02-06.md` for:
- Detailed case definitions for each module
- Parameter ranges and grid configurations
- Expected findings and failure mode analysis

Each experiment runs a **6×6 to 8×8 parameter grid** (30-second simulated duration per cell) and outputs 2D tables for metrics like failure rate, throughput, time-to-exhaustion, memory growth, and resource-specific metrics (FD count, socket count, timer count, listener count).

**Results:** `results/experiments-bm0X-<timestamp>.json` (per module)

## Corpus

400 Node.js repositories across 8 domains (50 per domain):
1. Web APIs / Backend Services
2. CLI Tools
3. Database / ORM Libraries
4. File Processing / Build Tools
5. Real-time / WebSocket Applications
6. DevOps / Infrastructure
7. Testing / Developer Tools
8. Data Processing / Messaging

See `data/corpus.md` for the full list.

## Methodology

See `docs/methodology.md` for the complete protocol:
- **Phase 1:** Controlled failure simulation (30 trials × 5 n values × 6 modules)
- **Phase 1b:** Two-dimensional impact experiments (5 cases, 2D parameter grids, discrete-event simulation)
- **Phase 2:** Scaling / exhaustion analysis (leak rate regression, production TTF projections)
- **Phase 3:** Real-world corpus profiling (400 repos, AST-based detection)
- **Phase 4:** Static analysis tool evaluation (precision/recall/F1)

## Project Structure

```
studies/06-resource-leaks/
  data/corpus.md                          # 400 repos, 8 domains
  docs/
    methodology.md                        # Research methodology
    benchmark-specs.md                    # Per-module specifications
    statistical-analysis.md               # Statistical analysis plan
  src/
    step1-benchmarks/
      harness/types.ts                    # LeakTrialRecord, LeakSummary, LeakComparison
      harness/runner.ts                   # Trial runner, snapshot, comparison
      harness/stats.ts                    # mean, median, stddev, t-test, Cohen's d
      modules/bm01-db-connection/         # Pool exhaustion scenario
      modules/bm02-file-descriptor/       # EMFILE scenario
      modules/bm03-stream-leak/           # Stream FD + memory scenario
      modules/bm04-http-socket/           # Socket accumulation scenario
      modules/bm05-timer-leak/            # Timer memory scenario
      modules/bm06-event-listener/        # Listener memory scenario
      experiments/
        types.ts                          # Experiment types (SimulationResult, GridCell, etc.)
        pool-simulator.ts                 # Discrete-event pool simulator
        case1-leak-prob-x-concurrency.ts  # Leak prob × Concurrency
        case2-query-time-x-pool-size.ts   # Query time × Pool size
        case3-burst-x-timeout.ts          # Burst size × Acquire timeout
        case4-error-rate-x-leak-on-error.ts # Error rate × Leak-on-error
        case5-leak-prob-x-max-conns.ts    # Leak prob × DB max connections
        run-experiments.ts                # Experiment orchestrator
      run-all.ts                          # Orchestrator
    step2-scaling/fit-curves.ts           # Leak rate regression + TTF projections
    step3-realworld/
      corpus.ts                           # Corpus parser
      scanner.ts                          # Clone + scan repos
    step4-static-analysis/
      detector/resource-leak-detector.ts  # Babel AST leak detector
  results/                                # Output (gitignored)
  CHECKLIST.md                            # Implementation progress
```

## Articles

- **Part 1 — Scaling & Exhaustion Analysis:** [stackinsight.dev/blog/resource-leak-scaling-empirical-study](https://stackinsight.dev/blog/resource-leak-scaling-empirical-study)
- **Part 2 — Real-World Corpus & Detector:** [stackinsight.dev/blog/resource-leak-corpus-empirical-study](https://stackinsight.dev/blog/resource-leak-corpus-empirical-study)

## Related

- **Detector source:** Adapted from [Code Evolution Lab](https://codeevolutionlab.com) `resource-leaks-detector.ts`
- **Previous studies:** [N+1 Query](../01-n-plus-1-query), [Blocking I/O](../02-blocking-io), [Memory Leaks](../03-memory-leaks), [Loop Performance](../04-loop-performance), [Missing Index](../05-missing-index)
