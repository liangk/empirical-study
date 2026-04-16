# Study 08: Methodology — DOM Manipulation Performance Patterns

## Overview

Three phases: controlled browser benchmarks (Phase 1), real-world corpus profiling (Phase 2), and a standalone static detector (Phase 3). The primary metric is **frame rate (fps)** and **layout time (ms)** under increasing DOM node counts. Statistical significance is assessed via Welch's t-test (α = 0.05) and Cohen's d.

---

## Phase 1: Controlled Browser Benchmarks

### Toolchain

- **Browser**: Chromium (headless), launched via Playwright `chromium.launch()`
- **Metrics collected per run**:
  - `PerformanceObserver` entries: `longtask`, `layout-shift`, `paint`
  - JavaScript-timed frame loop: `requestAnimationFrame` counter over a 2-second window → fps
  - `performance.measure()` wall-clock duration for the test body
- **n values** (DOM node count / iteration count): 100, 500, 1 000, 5 000, 10 000

### Benchmark Protocol

For each module (BM-01 through BM-05):
1. Serve the fixture HTML via a local `http.createServer` on an ephemeral port.
2. Open the page in Playwright, wait for `load`.
3. Inject the benchmark driver (calls `window.__runBenchmark(n)`) and await its Promise.
4. Collect the returned `{ durationMs, fps, longTaskCount }` object.
5. Repeat for **30 trials** per n × variant combination.
6. Discard the first **5 trials** (warmup).
7. Accept a trial set only if CV < 15% on `durationMs`; otherwise flag and continue.

### Acceptance Criteria

| Metric | Threshold |
|--------|-----------|
| Coefficient of variation (durationMs) | < 15% |
| Welch's t-test p-value | < 0.05 |
| Cohen's d | > 0.8 (large effect) |
| fps drop at n=5000 (baseline) | < 30 fps (confirms visible jank) |

---

## Phase 2: Real-World Corpus Profiling

### Corpus

- **Size**: 300 repositories
- **Domains**: React apps/libs, Vue apps/libs, vanilla JS/web components, full-stack frameworks, dashboards, PWAs
- **Inclusion criteria**: ≥ 200 GitHub stars, active within 18 months, primary language JavaScript or TypeScript, contains browser-targeted source

### Scan Procedure

1. Parse `data/corpus.md` to extract repo URLs.
2. Clone each repo with `--depth 1 --single-branch` via `simple-git`.
3. Glob for `**/*.{js,jsx,ts,tsx,mjs,vue}`, excluding `node_modules`, `dist`, `build`, `*.test.*`, `*.spec.*`.
4. Run `dom-pattern-detector.ts` on each file; collect findings.
5. Stream findings to `results/findings-<timestamp>.json` (NDJSON).
6. Aggregate prevalence by pattern and domain into `results/prevalence-<timestamp>.json`.

### Metrics

- **Prevalence rate**: `repos_with_findings / total_repos × 100`
- **Findings per repo**: median and P90
- **Pattern distribution**: count and percentage per category
- **Framework breakdown**: React vs. Vue vs. vanilla

---

## Phase 3: Standalone Static Detector

`src/step3-static-analysis/detector/dom-pattern-detector.ts` operates on any local JS/TS codebase.

### Detection Rules

| Rule | AST Signal | False-positive risk |
|------|-----------|-------------------|
| `forced_sync_layout` | `MemberExpression` reading a layout property (`offsetWidth`, `offsetHeight`, `clientWidth`, `clientHeight`, `clientTop`, `clientLeft`, `scrollTop`, `scrollLeft`, `scrollWidth`, `scrollHeight`, `getBoundingClientRect`) inside or immediately following a `MemberExpression` assignment to `style.*` or `innerHTML`, within a loop body | Medium — minified or framework-generated code |
| `innerhtml_in_loop` | Assignment to `.innerHTML` or `.outerHTML` inside a `ForStatement`, `WhileStatement`, `DoWhileStatement`, `ForInStatement`, `ForOfStatement`, or `CallExpression` callee `.forEach`/`.map`/`.reduce` | Low |
| `style_mutation_in_loop` | `MemberExpression` assignment where object is `.style` and property is any CSS property name, inside a loop | Low |
| `dom_query_in_loop` | `CallExpression` to `querySelector`, `querySelectorAll`, `getElementById`, `getElementsByClassName`, `getElementsByTagName` inside a loop | Low |
| `dom_write_read_interleave` | Alternating layout-property reads and DOM-write assignments within the same function body (outside loops) | High — many legitimate patterns |

### Limitations

- Cannot detect violations hidden behind framework virtual DOM (React JSX, Vue SFC template) since those compile to `createElement` calls, not direct DOM access. Findings are primarily in vanilla JS, event handlers, and framework escape hatches (`useEffect`, `onMounted`, directive hooks).
- `dom_write_read_interleave` rule outside loops has elevated false-positive rate; reported separately with `severity: low`.
- Minified or bundled output is excluded from scanning.

---

## Statistical Analysis

### Per-Benchmark

For each module and n:
- `mean`, `median`, `stddev`, `p5`, `p95` of `durationMs` over 25 accepted trials
- Welch's t-test: baseline vs. optimized
- Cohen's d: effect size
- **Speedup ratio**: `baseline_median / optimized_median`

### Corpus

- Prevalence rate with 95% Wilson score CI
- Pattern co-occurrence matrix (which patterns appear together)
- Framework prevalence breakdown

---

## Reproducibility

```bash
cd studies/08-dom-manipulation
npm install
npx playwright install chromium
npm run bench:all          # results/bench-<timestamp>.json
npm run realworld:scan     # results/findings-<timestamp>.json
```

All results are written to `results/` (git-ignored). The corpus list in `data/corpus.md` is the sole source of truth for repo selection.
