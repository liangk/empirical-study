# Study 09: Large Payload Anti-Patterns

**API Obesity: The Cost of Unbounded Queries — Empirical Analysis of Large Payload Impact on Parse Time, Memory, and Network Cost**

## Overview

This study quantifies the prevalence and performance impact of large payload anti-patterns in real-world REST and GraphQL APIs. I measure JSON parse time, memory consumption, and network transfer costs across varying payload sizes, then scan a 300-repository corpus for unbounded query patterns.

## Research Objectives

1. How prevalent are unbounded queries (missing pagination, SELECT *) in production APIs?
2. What is the parse time and memory overhead of large JSON payloads?
3. What are the real egress and mobile data costs of oversized responses?
4. Which API types (REST vs GraphQL) exhibit more large payload issues?

## Detection Categories

| ID | Pattern | Severity | Description |
|----|---------|----------|-------------|
| `unbounded_find_all` | Unbounded findAll | High | `findMany()` or `find()` without limit/where |
| `select_star` | SELECT * | High | SQL `SELECT *` without column list |
| `missing_pagination` | Missing Pagination | High | Endpoint without limit/offset or cursor |
| `deep_nested_include` | Deep Nested Include | Medium | Prisma `include` with 3+ levels |
| `unbounded_graphql` | Unbounded GraphQL | High | GraphQL resolver without pagination |

## Benchmark Modules

| Module | Pattern | Baseline | Optimized | Expected Gain |
|--------|---------|----------|-----------|---------------|
| BM-01 | JSON Parse Time | Parse 10MB blob | Parse 100KB chunk | 10–100× faster |
| BM-02 | Memory Consumption | Retain 10MB object | Retain 100KB chunk | 10× less memory |
| BM-03 | Unbounded Query | `findMany()` no limit | `findMany({ take: 100 })` | Constant vs O(n) |
| BM-04 | Deep Nested Include | 3-level include | Flat separate endpoints | 10–100× smaller |
| BM-05 | GraphQL Batch | Single 1000-item query | Cursor pagination | Controlled chunks |

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 — Benchmarks | 🔲 Pending | JSON parse time and memory measurements |
| Phase 2 — Corpus Scan | 🔲 Pending | 300 repos scanned for unbounded queries |
| Phase 3 — Static Detector | ✅ Scaffold | `payload-detector.ts` — 5 Babel AST rules |
| Article | 🔲 Pending | Draft pending |

## Quick Start

```bash
npm install

# Run all benchmarks
npm run bench:all

# Run individual modules
npm run bench:bm01

# Scan corpus repos for large payload patterns
npm run realworld:scan

# Detect patterns in a local codebase
npm run detect -- --path=/path/to/project
```

## Corpus

300 repositories across 6 domains:
- SaaS / Business Applications (50 repos)
- Data / Analytics APIs (50 repos)
- Developer Tools / APIs (50 repos)
- E-commerce / Marketplace APIs (50 repos)
- Content / Media APIs (50 repos)
- Fintech / Banking APIs (50 repos)

See [`data/corpus.md`](data/corpus.md) for the full list.

## Methodology

Three-phase approach:
1. **Phase 1 — Controlled Benchmarks**: Measure JSON.parse() time and memory delta across payload sizes (1KB to 10MB).
2. **Phase 2 — Real-World Corpus Profiling**: Clone 300 repos, run the AST detector, aggregate findings by domain and API type.
3. **Phase 3 — Standalone Static Detector**: `payload-detector.ts` can be run on any JS/TS codebase.

See [`docs/methodology.md`](docs/methodology.md) for full details.

## Project Structure

```
studies/09-large-payloads/
├── data/
│   └── corpus.md                   # 300 API repositories
├── docs/
│   ├── methodology.md
│   └── benchmark-specs.md
├── results/                        # Generated output (git-ignored)
├── src/
│   ├── step1-benchmarks/
│   │   ├── types.ts                # BenchResult, ModuleResult interfaces
│   │   ├── stats.ts                # Mean/median/stddev/cv/percentile
│   │   ├── runner.ts               # Payload generation, parse timing
│   │   └── run-all.ts              # Benchmark orchestrator
│   ├── step2-realworld/
│   │   ├── corpus.ts               # Corpus parser
│   │   └── scanner.ts              # Clone + scan runner
│   └── step3-static-analysis/
│       └── detector/
│           └── payload-detector.ts # 5 Babel AST rules
├── package.json
└── tsconfig.json
```

## Articles

*Pending publication.*

## Related Studies

- [Study 07: Bundle Bloat](../07-bundle-bloat/) — non-tree-shakeable import patterns
- [Study 08: DOM Manipulation](../08-dom-manipulation/) — layout thrashing and DOM anti-patterns
