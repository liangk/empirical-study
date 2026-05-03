# Study 08: DOM Manipulation Performance Patterns

**Why Your Web App Feels Janky: An Empirical Analysis of Layout Thrashing and DOM Anti-Patterns**

## Overview

This study quantifies the prevalence and performance impact of DOM manipulation anti-patterns in real-world React, Vue, and vanilla JavaScript applications. I use Playwright-based browser benchmarks to measure frame rate degradation, layout thrash time, and reflow count — then scan a 300-repository corpus for detector-identified violations.

## Key Findings

- **49.3% of repos** (148/300) had at least one DOM anti-pattern — 2,789 total findings
- **innerHTML-in-loop is devastating**: 24× slower at n=100, scaling to **8,243× slower** at n=10,000
- **Layout thrashing** (BM-01) shows 2.3× slowdown at n=10,000 — grows with DOM size
- **Style mutation in loops** (BM-03) is consistently 2–3× slower than CSS class toggling
- **DOM query caching** (BM-04) shows only marginal improvement (~1.2×) with modern browsers
- **DocumentFragment** (BM-05) showed no measurable improvement in this benchmark setup
- **Vanilla JS dominates findings**: 1,556 instances vs React 558, Vue 235, Angular 13
- **dom_query_in_loop** is the most common pattern (1,110 instances, 39.8%) but has the lowest impact

## Benchmark Results

Benchmarks run in **real Chromium** via Playwright (headless). Each fixture exposes `window.__runBenchmark(n)` and collects `durationMs`, `fps`, and `longTaskCount` via `PerformanceObserver`. 30 trials per n, first 5 discarded as warmup, CV threshold 15%.

| Module | Pattern | n=100 | n=500 | n=1,000 | n=5,000 | n=10,000 |
|--------|---------|-------|-------|---------|---------|----------|
| BM-01 | Layout thrashing | 1.0× | 1.5× | 1.7× | 2.2× | **2.3×** |
| BM-02 | innerHTML in loop | **24×** | **268×** | **527×** | **4,373×** | **8,243×** |
| BM-03 | Style mutation | 2.0× | 2.7× | 2.8× | 3.3× | **3.1×** |
| BM-04 | DOM query in loop | — | 1.0× | 1.3× | 1.2× | 1.2× |
| BM-05 | DocumentFragment | 1.0× | 0.7× | 1.0× | 0.8× | 0.9× |

> BM-02 (innerHTML in loop) dominates. The `innerHTML +=` pattern forces the browser to re-parse the entire DOM contents on every iteration — an O(n²) operation that scales catastrophically. BM-04 and BM-05 show that modern Chromium's internal optimizations (query caching, batched reflows) reduce the impact of these patterns significantly.

## Corpus Scan Results

Scanned 300 frontend repositories across 6 domains with a Babel AST detector.

### By pattern

| Pattern | Count | Share | Severity |
|---------|-------|-------|----------|
| `dom_query_in_loop` | 1,110 | 39.8% | Medium |
| `forced_sync_layout` | 861 | 30.9% | High |
| `style_mutation_in_loop` | 691 | 24.8% | Medium |
| `innerhtml_in_loop` | 127 | 4.6% | High |

### By severity

| Severity | Count | Share |
|----------|-------|-------|
| High | 988 | 35.4% |
| Medium | 1,801 | 64.6% |

### By framework

| Framework | Findings | Share |
|-----------|----------|-------|
| Vanilla JS | 1,556 | 55.7% |
| React | 558 | 20.0% |
| Mixed | 427 | 15.3% |
| Vue | 235 | 8.4% |
| Angular | 13 | 0.5% |

### Top repositories by finding count

| Repository | Findings | Domain |
|------------|----------|--------|
| mrdoob/three.js | 195 | Animation/3D |
| highcharts/highcharts | 156 | Data viz |
| SortableJS/Sortable | 134 | Drag-and-drop |
| ag-grid/ag-grid | 133 | Data grid |
| mozilla/pdf.js | 105 | Document viewer |
| airbnb/lottie-web | 89 | Animation |
| streetwriters/notesnook | 67 | PWA/Productivity |
| wekan/wekan | 68 | Kanban/PWA |
| nocodb/nocodb | 71 | Full-stack/SaaS |
| sachinchoolur/lightGallery | 63 | Media/Gallery |

## Research Objectives

1. How prevalent are forced synchronous layout, `innerHTML`-in-loop, and style-mutation-in-loop patterns across production frontend codebases?
2. What is the frame rate and layout-time impact of each anti-pattern vs. its optimized equivalent?
3. Which frameworks (React, Vue, vanilla JS) exhibit higher rates of each pattern?
4. At what DOM node count does each anti-pattern cross the 60fps → <30fps threshold?

## Detection Categories

| ID | Pattern | Severity | Description |
|----|---------|----------|-------------|
| `forced_sync_layout` | Forced Synchronous Layout | High | Reading layout properties (offsetWidth, scrollTop, etc.) immediately after a DOM write, inside a loop |
| `innerhtml_in_loop` | innerHTML in Loop | High | Assigning `element.innerHTML` or `element.outerHTML` inside a `for`/`while`/`forEach` loop |
| `style_mutation_in_loop` | Style Mutation in Loop | Medium | Setting individual `element.style.X = Y` properties inside a loop instead of toggling a CSS class |
| `dom_query_in_loop` | DOM Query in Loop | Medium | Calling `querySelector`/`getElementById`/`getElementsBy*` inside a loop without caching |
| `dom_write_read_interleave` | Read/Write Interleaving | High | Alternating DOM reads and writes (layout thrashing pattern outside loops) |

## Benchmark Modules

| Module | Pattern | Baseline | Optimized | Measured Speedup (n=10,000) |
|--------|---------|----------|-----------|------------------------------|
| BM-01 | Forced synchronous layout | Read offsetWidth → set width in loop | Batch reads, batch writes | 2.3× |
| BM-02 | innerHTML in loop | n × `el.innerHTML +=` | Single template string | **8,243×** |
| BM-03 | Style mutation in loop | n × `el.style.X = V` | CSS class toggle | 3.1× |
| BM-04 | DOM query in loop | `querySelector` per iteration | Cached reference | 1.2× |
| BM-05 | Bulk list render | `appendChild` × n | `DocumentFragment` batch | 0.9× |

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 — Browser Benchmarks | ✅ Complete | 5 modules × 5 n-values × 30 trials in headless Chromium |
| Phase 2 — Corpus Scan | ✅ Complete | 300 repos scanned, 2,789 findings across 148 repos |
| Phase 3 — Static Detector | ✅ Complete | `dom-pattern-detector.ts` — 5 Babel AST rules |
| Article | 📝 Pending | Draft in progress |

## Quick Start

```bash
npm install
npx playwright install chromium   # one-time browser install

# Run all benchmarks (real Chromium, headless)
npm run bench:all

# Run individual modules
npm run bench:bm01

# Scan corpus repos for DOM anti-patterns
npm run realworld:scan

# Detect patterns in a local codebase
npm run detect -- --path /path/to/project
```

## Corpus

300 repositories across 6 domains:
- React component libraries and applications (100 repos)
- Vue applications and ecosystems (60 repos)
- Vanilla JS / web components (40 repos)
- Full-stack frameworks with frontend (50 repos)
- Dashboard / data viz applications (30 repos)
- Mobile-first / PWA applications (20 repos)

See [`data/corpus.md`](data/corpus.md) for the full list.

## Methodology

Three-phase approach:
1. **Phase 1 — Controlled Browser Benchmarks**: Playwright runs each fixture in headless Chromium, collecting `PerformanceObserver` layout shift, long task, and FPS measurements.
2. **Phase 2 — Real-World Corpus Profiling**: Clone 300 repos, run the AST detector, aggregate findings by domain and framework.
3. **Phase 3 — Standalone Static Detector**: `dom-pattern-detector.ts` can be run on any JS/TS codebase.

See [`docs/methodology.md`](docs/methodology.md) for full details.

## Project Structure

```
studies/08-dom-manipulation/
├── data/
│   └── corpus.md                   # 300 frontend repositories
├── docs/
│   ├── methodology.md
│   └── benchmark-specs.md
├── results/                        # Generated output (git-ignored)
│   ├── bench-*.json                # Benchmark results
│   ├── findings-*.json             # Per-file findings
│   ├── prevalence-*.json           # Aggregate prevalence
│   └── scan-errors-*.json          # Clone failures
├── src/
│   ├── step1-benchmarks/
│   │   ├── run-all.ts              # Playwright benchmark orchestrator
│   │   └── fixtures/               # 10 HTML pages (baseline + optimized)
│   ├── step2-realworld/
│   │   ├── corpus.ts               # Corpus parser
│   │   └── scanner.ts              # Clone + scan runner
│   └── step3-static-analysis/
│       └── detector/
│           └── dom-pattern-detector.ts  # 5 Babel AST rules
├── package.json
└── tsconfig.json
```

## Articles

Published at [stackinsight.dev/blog/dom-manipulation-empirical-study](https://stackinsight.dev/blog/dom-manipulation-empirical-study)

## Related Studies

- [Study 03: Memory Leaks](../03-memory-leaks/) — heap retention in React/Vue/Angular apps
- [Study 07: Bundle Bloat](../07-bundle-bloat/) — non-tree-shakeable import patterns
