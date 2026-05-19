# Study 10: ReDoS Vulnerabilities in the Wild

**The Regex That Took Down Production: ReDoS Vulnerabilities — Empirical Analysis of Regex Complexity, Catastrophic Backtracking, and Real-World Impact**

## Overview

This study quantifies the prevalence and security/performance impact of Regular Expression Denial of Service (ReDoS) vulnerabilities in Node.js applications. I analyze regex patterns across 500 repositories, simulate catastrophic backtracking scenarios, and document real-world production incidents.

## Research Objectives

1. How prevalent are ReDoS-vulnerable regex patterns in Node.js codebases?
2. What is the CPU time and event loop blocking impact of malicious inputs?
3. Which regex constructs (nested quantifiers, overlapping alternatives) are most dangerous?
4. What mitigation strategies (timeouts, safe patterns) are most effective?

## Detection Categories

| ID | Pattern | Severity | Description |
|----|---------|----------|-------------|
| `nested_quantifiers` | Nested Quantifiers | Critical | `a*a*` or `(a+)+` causing exponential backtracking |
| `overlapping_alternatives` | Overlapping Alternatives | High | `a|a*` or complex alternation patterns |
| `possessive_quantifiers` | Missing Possessive | Medium | `a+` greedy quantifier that may cause backtracking in some patterns |
| `large_repetition` | Large Repetition | Medium | `{100,}` or similar unbounded repeats |
| `complex_groups` | Complex Groups | High | Nested groups with quantifiers |

## Benchmark Modules

| Module | Pattern | Baseline | Optimized | Expected Gain |
|--------|---------|----------|-----------|---------------|
| BM-01 | Catastrophic Backtracking | Vulnerable regex on malicious input | Timeout after 1s | Prevents DoS |
| BM-02 | Event Loop Blocking | Regex match blocking event loop | Async with timeout | Maintains responsiveness |
| BM-03 | CPU Time Explosion | O(2^n) complexity | O(n) safe pattern | 1000× faster |
| BM-04 | Memory in Regex | Large input causing stack overflow | Input size limits | Prevents crashes |

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 — Benchmarks | 🔲 Pending | Regex complexity and backtracking measurements |
| Phase 2 — Corpus Scan | ✅ Ready | 500 repos identified and corpus defined |
| Phase 3 — Static Detector | ✅ Scaffold | `redos-detector.ts` — AST-based regex analysis |
| Phase 4 — Exploit Simulation | 🔲 Pending | Malicious input generation and testing |
| Article | 🔲 Pending | Draft pending |

## Quick Start

```bash
npm install

# Run all benchmarks
npm run bench:all

# Run individual modules
npm run bench:bm01

# Scan corpus repos for ReDoS patterns
npm run scan

# Detect patterns in a local codebase
npm run detect -- --path=/path/to/project

# Simulate ReDoS exploits
npm run simulate
```

## Corpus

500 Node.js repositories across domains:
- Web frameworks and libraries (100 repos)
- API servers and microservices (100 repos)
- CLI tools and utilities (100 repos)
- Data processing and ETL (100 repos)
- Security and authentication (100 repos)

The finalized 500-repo corpus is defined in [`data/corpus.md`](data/corpus.md).

## Methodology

Four-phase approach:
1. **Phase 1 — Controlled Benchmarks**: Measure regex execution time and backtracking complexity across pattern types.
2. **Phase 2 — Real-World Corpus Profiling**: Clone 500 repos, extract regex literals, analyze complexity scores.
3. **Phase 3 — Static Detector**: `redos-detector.ts` identifies vulnerable patterns using AST analysis.
4. **Phase 4 — Exploit Simulation**: Generate malicious inputs and test timeout protections.

See [`docs/methodology.md`](docs/methodology.md) for full details.

## Project Structure

```
studies/10-redos/
├── data/
│   └── corpus.md                   # 500 Node.js repositories
├── docs/
│   ├── methodology.md
│   └── benchmark-specs.md
├── results/                        # Generated output (git-ignored)
├── src/
│   ├── step1-benchmarks/
│   │   ├── types.ts                # BenchResult, ModuleResult interfaces
│   │   ├── stats.ts                # Mean/median/stddev/cv/percentile
│   │   ├── runner.ts               # Regex timing and complexity analysis
│   │   └── run-all.ts              # Benchmark orchestrator
│   ├── step2-regex-analysis/
│   │   └── scanner.ts              # Corpus scanning for regex patterns
│   ├── step3-static-analysis/
│   │   └── detector/
│   │       └── redos-detector.ts   # AST-based ReDoS detection
│   └── step4-exploit-simulation/
│       └── simulator.ts            # Malicious input generation
├── content/
│   └── redos-empirical-study.md    # Study writeup
├── package.json
├── README.md
└── tsconfig.json
```

## Key Findings (Preliminary)

- **Prevalence**: X% of Node.js repos contain potentially vulnerable regex patterns
- **Impact**: Malicious inputs can cause up to Y seconds of CPU time
- **Common Patterns**: Z% involve nested quantifiers in user input validation
- **Mitigation**: Timeout wrappers reduce attack surface by W%

## Contributing

This is part of the Code Evolution Lab empirical study series. See the main repository for contribution guidelines.

## License

MIT - See main repository license.