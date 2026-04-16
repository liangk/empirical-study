# Empirical Performance Studies for Node.js

Rigorous, data-driven performance research by [Code Evolution Lab](https://codeevolutionlab.com).
Each study is self-contained under `studies/` with its own dependencies, benchmarks, results, and articles.

## Studies

| # | Topic | Status | Article |
|---|-------|--------|---------|
| 01 | [N+1 Query Problem](studies/01-n-plus-1-query/) | Complete | [stackinsight.dev/blog/n-plus-1-query-empirical-study](https://stackinsight.dev/blog/n-plus-1-query-empirical-study) |
| 02 | [Blocking I/O](studies/02-blocking-io/) | Complete | [stackinsight.dev/blog/blocking-io-empirical-study](https://stackinsight.dev/blog/blocking-io-empirical-study) |
| 03 | [Memory Leaks](studies/03-memory-leaks/) | Complete | [stackinsight.dev/blog/memory-leak-empirical-study](https://stackinsight.dev/blog/memory-leak-empirical-study) |
| 04 | [Loop Performance](studies/04-loop-performance/) | Complete | [stackinsight.dev/blog/loop-performance-empirical-study](https://stackinsight.dev/blog/loop-performance-empirical-study) |
| 05 | [Missing Index Crisis](studies/05-missing-index/) | Complete | [stackinsight.dev/blog/missing-index-empirical-study](https://stackinsight.dev/blog/missing-index-empirical-study) |
| 06 | [Resource Leaks](studies/06-resource-leaks/) | Complete | [Part 1: Scaling](https://stackinsight.dev/blog/resource-leak-scaling-empirical-study) · [Part 2: Corpus](https://stackinsight.dev/blog/resource-leak-corpus-empirical-study) |
| 07 | [Bundle Bloat](studies/07-bundle-bloat/) | Complete | [stackinsight.dev/blog/bundle-bloat-empirical-study](https://stackinsight.dev/blog/bundle-bloat-empirical-study) |
| 08 | [DOM Manipulation](studies/08-dom-manipulation/) | In Progress | — |
| 09 | Large Payloads | Planned | — |
| 10 | ReDoS Vulnerabilities | Planned | — |
| 11 | Missing Caching | Planned | — |
| 12 | Inefficient Loops | Planned | — |

## Repository Structure

```
empirical-study/
  studies/
    01-n-plus-1-query/      # Prisma N+1 query benchmarks
    02-blocking-io/         # Blocking I/O prevalence + benchmarks
    03-memory-leaks/        # Memory leak detection in React/Vue/Angular
    04-loop-performance/    # Loop anti-pattern benchmarks + corpus study
    05-missing-index/       # Missing index benchmarks (PostgreSQL + Prisma)
    06-resource-leaks/      # Resource leak benchmarks + real-world corpus scan
    07-bundle-bloat/        # Bundle size benchmarks + esbuild analysis
    08-dom-manipulation/    # DOM performance benchmarks + Playwright
  docs/                     # Shared writing guides, research plan
  tsconfig.base.json        # Shared TypeScript config
  package.json              # npm workspaces root
```

Each study folder contains:
- `README.md` — Study overview, methodology, quick start
- `package.json` — Study-specific dependencies
- `src/` — Benchmark and analysis code
- `results/` — Raw benchmark output (gitignored)
- `content/` — Article drafts (gitignored)

## Quick Start

```bash
# Install all workspaces
npm install

# Run a specific study
cd studies/01-n-plus-1-query && npm run bench:all
cd studies/02-blocking-io && npm run bench:all
```

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5+
- **Study 01:** Prisma, PostgreSQL, performance.now()
- **Study 02:** Express, autocannon, Babel AST analysis, perf_hooks
- **Study 03:** Babel AST analysis, simple-git, React/Vue/Angular detectors
- **Study 04:** Prisma-free, pure Node.js + Python, hrtime, Babel AST
- **Study 05:** Prisma, PostgreSQL, EXPLAIN ANALYZE, performance.now()
- **Study 06:** Babel AST analysis, simple-git, discrete-event simulation, perf_hooks
- **Study 07:** esbuild, Babel AST analysis, simple-git, bundle size benchmarks

## Links

- **Publication:** [stackinsight.dev](https://stackinsight.dev)
- **Tool:** [codeevolutionlab.com](https://codeevolutionlab.com)
- **GitHub:** [github.com/liangk/empirical-study](https://github.com/liangk/empirical-study)

## License

MIT
