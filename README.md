# Empirical Performance Studies for Node.js

Rigorous, data-driven performance research by [Code Evolution Lab](https://codeevolutionlab.com).
Each study is self-contained under `studies/` with its own dependencies, benchmarks, results, and articles.

## Studies

| # | Topic | Status | Article |
|---|-------|--------|---------|
| 01 | [N+1 Query Problem](studies/01-n-plus-1-query/) | ✅ Complete (100 & 1,000 users) | [stackinsight.dev](https://stackinsight.dev) |
| 02 | [Blocking I/O](studies/02-blocking-io/) | 🚧 In Progress | — |
| 03 | Missing Index | 📋 Planned | — |
| 04 | Resource Leaks | 📋 Planned | — |
| 05 | Bundle Bloat | 📋 Planned | — |
| 06 | DOM Manipulation | 📋 Planned | — |
| 07 | Inefficient Loops | 📋 Planned | — |
| 08 | Large Payloads | 📋 Planned | — |
| 09 | ReDoS Vulnerabilities | 📋 Planned | — |
| 10 | Missing Caching | 📋 Planned | — |
| 11 | Memory Leaks | 📋 Planned | — |

## Repository Structure

```
empirical-study/
  studies/
    01-n-plus-1-query/      # Prisma N+1 query benchmarks
    02-blocking-io/         # Blocking I/O prevalence + benchmarks
    03-missing-index/       # (future)
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

## Links

- **Publication:** [stackinsight.dev](https://stackinsight.dev)
- **Tool:** [codeevolutionlab.com](https://codeevolutionlab.com)
- **GitHub:** [github.com/liangk/empirical-study](https://github.com/liangk/empirical-study)

## License

MIT
