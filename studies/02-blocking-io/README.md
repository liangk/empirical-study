# Study 02: The Hidden Cost of Blocking I/O in Node.js

## Overview

Empirical study measuring the prevalence and performance impact of synchronous (blocking) I/O
operations in Node.js applications. Combines static analysis of public repositories with
synthetic load-testing benchmarks.

The study is split into two complementary parts:

1. **Step 1 (ecosystem prevalence):** AST scan of public repositories to find where blocking APIs are used.
2. **Step 2 (runtime impact):** controlled load tests comparing sync vs async implementations.

Together, these answer both "how common is it?" and "how much does it hurt?".

## Research Questions

1. How prevalent are blocking I/O patterns in production Node.js apps?
2. What is the measurable latency/throughput impact under concurrent load?
3. Which patterns cause the most severe event loop blocking?
4. When is synchronous I/O acceptable vs. harmful?

## Methodology

### Step 1 — Repository Scan (`src/step1-repo-scan/`)

AST-based static analysis (adapted from [Code Evolution Lab](https://codeevolutionlab.com))
scans public repositories for blocking patterns:

| Pattern | Module | Examples |
|---------|--------|----------|
| Sync file I/O | `fs` | `readFileSync`, `writeFileSync`, `existsSync` |
| Sync child process | `child_process` | `execSync`, `spawnSync` |
| Sync crypto | `crypto` | `pbkdf2Sync`, `scryptSync` |
| Sync compression | `zlib` | `gzipSync`, `deflateSync` |

Scan workflow:

1. Parse repository list from `data/repo-samples.md`
2. Shallow clone repositories with `simple-git`
3. Recursively scan JS/TS files (skipping heavy directories)
4. Parse AST with Babel parser
5. Detect sync methods + classify execution context
6. Write raw results to `results/scan-*.json`
7. Aggregate summary metrics into `results/summary-*.json`

Each finding is categorized with a **two-layer context model**:

1. **High-level context (`context`)**
   - `request_path` — user-facing request execution path
   - `background_path` — timers/listeners/promise callbacks/job-like flows
   - `startup_path` — module bootstrap/top-level/constructor initialization
   - `tooling_path` — tests/scripts/migrations/seed/build tooling
   - `unknown_path` — unmatched ancestry (review queue)

2. **Detailed reason (`contextDetail`)**
   - Examples: `handler_inside_loop`, `timer_callback`, `event_listener_callback`,
     `module_or_constructor_init`, `tooling_or_test_file`, `unknown_ancestry`

Each issue also includes **evidence fields** (`matchedBy`, `enclosingFunction`, `ancestorKinds`) so classifications are auditable and reproducible when re-running the study years later.

Severity model (high level):

- **critical:** request path + inside loop
- **high:** request path or looped background pattern
- **medium:** uncertain / background non-loop contexts
- **low:** startup/tooling contexts

### Step 2 — Performance Benchmarks (`src/step2-benchmarks/`)

Synthetic Express servers with intentional blocking vs. async implementations,
load-tested with [autocannon](https://github.com/mcollina/autocannon).

| TC | Scenario | Blocking Pattern |
|----|----------|------------------|
| TC1 | Config/template read in handler | `fs.readFileSync` |
| TC2 | Shell command in handler | `child_process.execSync` |
| TC3 | Password hashing in auth | `crypto.pbkdf2Sync` |
| TC4 | File write in handler | `fs.writeFileSync` |
| TC5 | File existence check in handler | `fs.existsSync` + `fs.statSync` |

**Metrics:** P50/P95/P99 latency, throughput (req/sec), error rate, event loop delay.

Benchmark workflow:

1. Start **bad** server variant for a test case
2. Run load test with `autocannon`
3. Capture request/latency/error metrics and event loop delay
4. Stop bad server
5. Repeat with **good** variant
6. Print comparison and persist timestamped results to `results/bench-*.json`

Default load profile (overridable via CLI):

- duration: 10s
- concurrency: 50
- pipelining: 1

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript 5+
- **Server:** Express 4
- **Load testing:** autocannon
- **Static analysis:** Babel parser + AST traversal
- **Repo cloning:** simple-git

## Project Structure

```text
studies/02-blocking-io/
├─ data/
│  └─ repo-samples.md                  # curated repository sample list
├─ src/
│  ├─ step1-repo-scan/
│  │  ├─ scanner.ts                    # clone + per-file detection
│  │  ├─ aggregate-results.ts          # aggregate summary stats
│  │  └─ detector/                     # parser, detector, typed outputs
│  └─ step2-benchmarks/
│     ├─ scenarios/                    # TC1..TC5 bad/good servers
│     ├─ load-test/                    # autocannon wrapper + event loop monitor
│     └─ run-all.ts                    # orchestrates all scenarios
├─ results/                            # scan/summary/benchmark outputs
└─ content/                            # publication drafts
```

## Prerequisites

1. Node.js 18+ and npm
2. Network access to clone sample repositories for Step 1
3. Enough disk space for temporary clones/results

> No database is required for this study.

## Quick Start

```bash
# Install dependencies
npm install

# --- Step 1: Repository Scan ---
npm run scan              # Clone + scan repos from data/repo-samples.md
npm run scan:aggregate    # Aggregate scan results into summary

# --- Step 2: Performance Benchmarks ---
npm run bench:all         # Run all scenarios (bad + good + load test)
npm run bench:scenario -- --tc=1   # Run a single scenario
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `npm run scan` | Clone repositories and produce raw scan results |
| `npm run scan:aggregate` | Aggregate latest/raw scan results into summary metrics |
| `npm run bench:all` | Run all five benchmark scenarios (bad + good) |
| `npm run bench:bad` | Run bad variants only (if available in local setup) |
| `npm run bench:good` | Run good variants only (if available in local setup) |
| `npm run bench:scenario -- --tc=1` | Run one scenario in isolation |

## Recommended Execution Order

For a full study run:

1. `npm run scan`
2. `npm run scan:aggregate`
3. `npm run bench:all -- --duration 20 --concurrency 100`
4. Use latest `results/summary-*.json` + `results/bench-*.json` for article/reporting

## Result Files and What They Contain

- `results/scan-*.json`
  - per-repository findings
  - line-level issue metadata
  - context + heuristic evidence
- `results/summary-*.json`
  - prevalence rate
  - by-type/by-context/by-severity distributions
  - top offending repositories/methods
- `results/bench-*.json`
  - per-scenario bad/good metrics
  - latency percentiles, throughput, errors/timeouts
  - event loop delay indicators

## Results

- Scan results: `results/scan-*.json`
- Benchmark results: `results/bench-*.json`

## How to Interpret Results

When reading scan output:

1. Start with `prevalenceRate` and `reposWithIssues`
2. Inspect `byContext.request_path` for user-impacting risk
3. Use `byContextDetail` + `matchedBy` for manual validation
4. Treat `unknown_path` as a review queue, not a false-positive bucket

When reading benchmark output:

1. Compare **throughput** bad vs good
2. Compare **P95/P99 latency** (tail behavior)
3. Check **errors/timeouts** for stability regressions
4. Use **eventLoopDelayMax/Avg** to confirm event loop blocking impact

## Reproducibility Notes

- Keep benchmark machine load stable between runs.
- Use the same duration/concurrency when comparing revisions.
- Keep Node version fixed for publication-level comparisons.
- Repeat high-impact runs (especially TC2/TC3) to validate consistency.

## Articles

Published versions in `content/`.

## Troubleshooting

- **Clone failures in Step 1:** rerun `npm run scan`; transient network issues are common.
- **Large scan runtime:** reduce sample count or run with smaller curated list.
- **High benchmark variance:** increase duration and repeat runs.
- **Unexpected zero/odd latency fields:** rely on fallback percentiles in load-test wrapper and rerun.
- **Port conflicts in benchmarks:** ensure no existing process uses the scenario ports.

## Data

- `data/repo-samples.md` — Curated list of ~250 public Node.js repos for scanning
