# Study 02: The Hidden Cost of Blocking I/O in Node.js

## Overview

Empirical study measuring the prevalence and performance impact of synchronous (blocking) I/O
operations in Node.js applications. Combines static analysis of public repositories with
synthetic load-testing benchmarks.

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

Each finding is categorized by context:
- **Request handler** — blocks concurrent requests (critical)
- **Loop body** — compounds blocking duration (critical)
- **Module init / top-level** — blocks startup only (acceptable)
- **Other** — requires manual review

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

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript 5+
- **Server:** Express 4
- **Load testing:** autocannon
- **Static analysis:** Babel parser + AST traversal
- **Repo cloning:** simple-git

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

## Results

- Scan results: `results/scan-*.json`
- Benchmark results: `results/bench-*.json`

## Articles

Published versions in `content/`.

## Data

- `data/repo-samples.md` — Curated list of ~250 public Node.js repos for scanning
