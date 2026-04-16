# Study 08: DOM Manipulation Performance Patterns

**Why Your Web App Feels Janky: An Empirical Analysis of Layout Thrashing and DOM Anti-Patterns**

## Overview

This study quantifies the prevalence and performance impact of DOM manipulation anti-patterns in real-world React, Vue, and vanilla JavaScript applications. We use Playwright-based browser benchmarks to measure frame rate degradation, layout thrash time, and reflow count — then scan a 300-repository corpus for detector-identified violations.

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

| Module | Pattern | Baseline | Optimized | Expected Gain |
|--------|---------|----------|-----------|---------------|
| BM-01 | Forced synchronous layout | Read offsetWidth → set width in loop | Batch reads, batch writes | 5–20× layout time |
| BM-02 | innerHTML in loop | n × `el.innerHTML +=` | Single template string | 3–15× faster |
| BM-03 | Style mutation in loop | n × `el.style.X = V` | CSS class toggle | 2–8× faster |
| BM-04 | DOM query in loop | `querySelector` per iteration | Cached reference | 2–5× faster |
| BM-05 | Bulk list render | `appendChild` × n | `DocumentFragment` batch | 3–10× faster |

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
├── src/
│   ├── step1-benchmarks/
│   │   ├── run-all.ts              # Playwright benchmark orchestrator
│   │   └── fixtures/               # HTML pages for each benchmark
│   ├── step2-realworld/
│   │   ├── corpus.ts               # Corpus parser
│   │   └── scanner.ts              # Clone + scan runner
│   └── step3-static-analysis/
│       └── detector/
│           └── dom-pattern-detector.ts
├── package.json
└── tsconfig.json
```

## Articles

*Pending publication.*

## Related Studies

- [Study 03: Memory Leaks](../03-memory-leaks/) — heap retention in React/Vue/Angular apps
- [Study 07: Bundle Bloat](../07-bundle-bloat/) — non-tree-shakeable import patterns
