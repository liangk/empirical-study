# Empirical Performance Studies for Node.js

Rigorous, data-driven performance research by [Code Evolution Lab](https://codeevolutionlab.com).
Each study is self-contained under `studies/` with its own dependencies, benchmarks, results, and articles.

## Studies

| # | Topic | Status | Article |
|---|-------|--------|---------|
| 01 | [N+1 Query Problem](studies/01-n-plus-1-query/) | ✅ Complete | [stackinsight.dev](https://stackinsight.dev) |
| 02 | [Blocking I/O](studies/02-blocking-io/) | 🚧 In Progress | — |
| 03 | [Memory Leaks](studies/03-memory-leaks/) | � In Progress | — |
| 04 | [Loop Performance](studies/04-loop-performance/) | ✅ Complete | [stackinsight.dev](https://stackinsight.dev) |
| 05 | [Missing Index Crisis](studies/05-missing-index/) | � In Progress | — |
| 06 | Bundle Bloat | 📋 Planned | — |
| 07 | DOM Manipulation | 📋 Planned | — |
| 08 | Large Payloads | 📋 Planned | — |
| 09 | ReDoS Vulnerabilities | 📋 Planned | — |
| 10 | Missing Caching | 📋 Planned | — |
| 11 | Resource Leaks | 📋 Planned | — |
| 12 | Inefficient Loops | 📋 Planned | — |

## Repository Structure

```
empirical-study/
  studies/
    01-n-plus-1-query/      # Prisma N+1 query benchmarks
    02-blocking-io/         # Blocking I/O prevalence + benchmarks
    03-memory-leaks/        # Memory leak detection in React/Vue/Angular
    04-loop-performance/    # Loop anti-pattern benchmarks + corpus study
    05-missing-index/       # Missing index benchmarks (PostgreSQL + Prisma)
    ...
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
- **Study 04:** Prisma-free, pure Node.js + Python, hrtime, Babel AST
- **Study 05:** Prisma, PostgreSQL, EXPLAIN ANALYZE, performance.now()

## Links

- **Publication:** [stackinsight.dev](https://stackinsight.dev)
- **Tool:** [codeevolutionlab.com](https://codeevolutionlab.com)
- **GitHub:** [github.com/liangk/empirical-study](https://github.com/liangk/empirical-study)

## License

MIT
