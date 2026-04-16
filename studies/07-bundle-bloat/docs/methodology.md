# Study 07: Methodology — Bundle Bloat in Frontend Applications

## Overview

This study quantifies the prevalence and bundle-size cost of non-tree-shakeable import patterns
in production React, Vue, and Angular applications. It combines controlled esbuild bundle-size
benchmarks (Step 1) with a real-world AST scan of 500 repositories (Step 2) and a standalone
static analysis detector (Step 3).

---

## Phase 1: Controlled Bundle Size Benchmarks

### Hypothesis

Non-tree-shakeable import patterns — full default imports of large libraries, barrel imports from
component libraries, namespace imports — measurably increase production bundle sizes by tens to
hundreds of kilobytes compared to tree-shakeable alternatives, with no functional difference.

### Benchmark Modules

| Module | Library | Anti-pattern | Optimized |
|--------|---------|-------------|-----------|
| BM-01 | lodash | `import _ from 'lodash'` | `import { debounce } from 'lodash-es'` |
| BM-02 | moment | `import moment from 'moment'` | `import dayjs from 'dayjs'` |
| BM-03 | @mui/material | `import { Button } from '@mui/material'` | `import Button from '@mui/material/Button'` |
| BM-04 | antd | `import { Button } from 'antd'` | `import Button from 'antd/lib/button'` |
| BM-05 | react-icons | `import * as Icons from 'react-icons/fa'` | `import { FaHome } from 'react-icons/fa'` |

### Benchmark Protocol

For each module (BM-01 to BM-05):

1. Create a minimal TypeScript entry point that uses one representative export from the library
2. Bundle the anti-pattern version using `esbuild --bundle --minify --platform=browser`
3. Bundle the optimized version using the same esbuild flags
4. Record: raw output size (bytes), gzipped size (bytes), size ratio (anti-pattern / optimized)
5. Repeat 3× per configuration and use the median

Bundler: esbuild (fast, zero-config, representative of modern Vite/Rollup behavior).
Platform: `browser`. Format: `esm`. Minification: enabled.

### Metrics

| Metric | Description |
|--------|-------------|
| `rawSize` | Uncompressed bundle size in bytes |
| `gzipSize` | Gzip-compressed size in bytes |
| `sizeRatio` | `antiPattern.gzipSize / optimized.gzipSize` |
| `savings` | `antiPattern.gzipSize - optimized.gzipSize` in KB |

### Validity

- esbuild is the bundler underlying Vite, the dominant frontend build tool as of 2025
- Results are not identical to Webpack 5 tree-shaking but are representative and reproducible
- Real-world savings depend on what else is in the bundle; measurements use isolated entry points

---

## Phase 2: Real-World Corpus Profiling

### Corpus

500 JavaScript/TypeScript frontend repositories across 8 domains (≈62 per domain):

1. React UI Component Libraries
2. Vue / Angular UI Libraries
3. Full-Stack / SaaS Applications
4. Developer Tools / IDEs
5. Data Visualization / Dashboards
6. E-commerce / CMS Platforms
7. State Management / Data Fetching Libraries
8. Mobile / Cross-Platform Apps

Selection criteria:
- ≥200 GitHub stars
- Primary language JavaScript or TypeScript
- Active maintenance within the last 18 months
- Contains client-side / browser-targeted source code
- Has `package.json` with known frontend dependencies

### Scanner Protocol

For each repository:

1. Shallow clone (`--depth 1`) into `.repos/`
2. Discover all `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.mjs` source files
3. Exclude: `node_modules/`, `dist/`, `build/`, `coverage/`, `.d.ts`, test files
4. Skip files > 1 MB
5. Parse each file with `@babel/parser` (TypeScript + JSX plugins, `errorRecovery: true`)
6. Run all 5 detection rules in a single AST pass
7. Stream findings to `results/findings-<timestamp>.json`
8. Aggregate prevalence counts to `results/prevalence-<timestamp>.json`

### Detection Rules

| Rule | Trigger | Severity |
|------|---------|----------|
| `moment_import` | Default import of `moment` or `moment-timezone` | High |
| `full_lodash_import` | Default import of `lodash` or `underscore` | High |
| `barrel_import` | Named import from `@mui/material`, `antd`, `@ant-design/icons`, `@chakra-ui/react`, `@mantine/core` | Medium |
| `namespace_import` | `import * as X from 'library'` for any known large library | Medium |
| `cjs_require` | `require('lodash')`, `require('moment')`, etc. in non-test source files | Medium |

### Prevalence Metrics

- `totalRepos`: repositories scanned
- `reposWithFindings`: repositories with at least one detection
- `prevalenceRate`: `reposWithFindings / totalRepos`
- `totalFindings`: sum of all detections across all repos and files
- `byPattern`: finding count per detection category
- `byRepo`: top repositories by finding count

---

## Phase 3: Static Analysis Detector

The standalone detector (`src/step3-static-analysis/detector/bundle-bloat-detector.ts`) exposes
the same five rules as a CLI tool:

```bash
npm run detect -- --path /path/to/your/project
```

Output format mirrors Study 06's resource-leak-detector: `[HIGH]` / `[MEDIUM]` prefixed lines
with file path, line number, and description.

---

## Statistical Analysis

No inferential statistics are required for bundle size measurements — the effect sizes are large
and deterministic. For corpus prevalence:

- Report raw counts and percentages
- Report distribution of findings per repo (median, P90)
- Report sensitivity: prevalence excluding known-FP sources (e.g., library repos that
  intentionally re-export everything from a barrel)

---

## Limitations

- The detector checks import syntax only; it cannot determine whether the bundler's tree-shaking
  will eliminate dead code at build time (e.g., Webpack 5 with sideEffects: false)
- Some barrel imports are already handled by bundler plugins (e.g., `babel-plugin-import` for
  antd, `@mui/material` auto-treeshaking in Webpack 5 with ESM)
- The corpus is biased toward popular, well-starred repositories; prevalence in smaller/private
  codebases may differ
