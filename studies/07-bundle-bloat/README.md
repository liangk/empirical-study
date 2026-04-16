# Study 07: The True Cost of Bundle Bloat

Empirical analysis of non-tree-shakeable import patterns in React, Vue, and Angular applications — full library imports, barrel imports from component libraries, and moment.js usage that inflate production bundles without developer awareness.

## Research Objectives

1. Quantify how common non-tree-shakeable import patterns are across 500 frontend repositories
2. Measure the actual bundle size cost of each anti-pattern via controlled esbuild benchmarks
3. Identify the highest-impact libraries: lodash, moment, @mui/material, antd, etc.
4. Validate detection rules used in [Code Evolution Lab](https://codeevolutionlab.com)

## Detection Categories

| Category | Severity | Pattern | Typical Size Cost |
|----------|----------|---------|-------------------|
| `moment_import` | High | `import moment from 'moment'` | +67 KB gzipped |
| `full_lodash_import` | High | `import _ from 'lodash'` | +25 KB gzipped |
| `barrel_import` | Medium | `import { X } from '@mui/material'` | varies (+50–200 KB) |
| `namespace_import` | Medium | `import * as X from 'library'` | prevents tree-shaking |
| `cjs_require` | Medium | `require('lodash')` in ESM source | prevents tree-shaking |

## Benchmark Modules

| Module | Anti-pattern | Optimized alternative | Metric |
|--------|-------------|----------------------|--------|
| BM-01 | `import _ from 'lodash'` | `import { debounce } from 'lodash-es'` | Bundle size (KB) |
| BM-02 | `import moment from 'moment'` | `import dayjs from 'dayjs'` | Bundle size (KB) |
| BM-03 | `import { Button } from '@mui/material'` | `import Button from '@mui/material/Button'` | Bundle size (KB) |
| BM-04 | `import { Button } from 'antd'` | `import Button from 'antd/lib/button'` | Bundle size (KB) |
| BM-05 | `import * as Icons from 'react-icons/fa'` | `import { FaHome } from 'react-icons/fa'` | Bundle size (KB) |

## Quick Start

```bash
# Install dependencies
npm install

# Run bundle size benchmarks (requires esbuild)
npm run bench:all

# Scan real-world repos
npm run realworld:scan

# Run the detector on your own project
npm run detect -- --path /path/to/your/project
```

## Corpus

500 React, Vue, and Angular repositories across 8 domains (approximately 60–65 per domain):

1. React UI Component Libraries
2. Vue / Angular UI Libraries
3. Full-Stack / SaaS Applications
4. Developer Tools / IDEs
5. Data Visualization / Dashboards
6. E-commerce / CMS Platforms
7. State Management / Data Fetching Libraries
8. Mobile / Cross-Platform Apps

See `data/corpus.md` for the full list.

## Project Structure

```
studies/07-bundle-bloat/
  data/corpus.md                              # ~500 frontend repos, 8 domains
  docs/
    methodology.md                            # Research methodology
    benchmark-specs.md                        # Per-module specifications
  src/
    step1-benchmarks/
      fixtures/                               # Minimal entry points for esbuild
      run-all.ts                              # Bundle size benchmark orchestrator
    step2-realworld/
      corpus.ts                               # Corpus parser
      scanner.ts                              # Clone + scan repos
    step3-static-analysis/
      detector/bundle-bloat-detector.ts       # Babel AST import pattern detector
  results/                                    # Output (gitignored)
```

## Articles

- **Published:** — *(in progress)*

## Related

- **Previous studies:** [N+1 Query](../01-n-plus-1-query), [Blocking I/O](../02-blocking-io), [Memory Leaks](../03-memory-leaks), [Loop Performance](../04-loop-performance), [Missing Index](../05-missing-index), [Resource Leaks](../06-resource-leaks)
