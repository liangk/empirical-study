# Study 03: Memory Leak Epidemic in React/Vue/Angular Apps

## Overview

This study quantifies the prevalence and impact of memory leaks caused by missing cleanup in modern frontend framework lifecycle hooks. It combines **static analysis** of 600 public repositories (300 React, 200 Vue, 100 Angular) with **dynamic memory profiling** benchmarks that measure heap growth, retained objects, and GC pressure over simulated user sessions.

### Research Questions

1. How prevalent are missing-cleanup memory leak patterns across React, Vue, and Angular codebases?
2. Which leak patterns are most common per framework?
3. What is the measurable memory growth rate from each pattern under sustained navigation?
4. How does impact differ between desktop and memory-constrained (mobile) environments?

---

## Methodology

### Step 1: Static Repo Scan

AST-based detection across three framework families:

| Framework | Patterns Detected |
|-----------|-------------------|
| **React** | `useEffect` without cleanup return, `addEventListener` without `removeEventListener`, `setInterval`/`setTimeout` without cleanup, `subscribe()` without `unsubscribe()`, stale closure captures over refs |
| **Vue** | `onMounted` without `onUnmounted` cleanup, `watch`/`watchEffect` without stop handle, manual `addEventListener` in setup/mounted without removal, global event bus listeners without `off()` |
| **Angular** | `.subscribe()` without `unsubscribe()` or `takeUntil`, missing `ngOnDestroy` in components with subscriptions, `Renderer2.listen()` without stored unlisten, `setInterval`/`setTimeout` without `clearInterval`/`clearTimeout` |

Context classification:

- **component_lifecycle** — inside a component body (hook, method, setup)
- **service_singleton** — in a service/provider that outlives components
- **store_subscription** — state management subscriptions (Redux, Pinia, NgRx)
- **event_binding** — DOM or custom event listeners
- **timer** — `setInterval`, `setTimeout`, `requestAnimationFrame`
- **unknown** — couldn't determine from static analysis alone

### Step 2: Dynamic Memory Profiling (Benchmarks)

Synthetic mini-apps per framework that deliberately leak (bad) vs properly clean up (good). Each is exercised with simulated mount/unmount cycles and measured for:

- Heap size growth over N cycles
- Retained DOM node count
- Detached event listener count
- GC reclaim efficiency

#### Interpreting results in a garbage-collected runtime

React/Vue/Angular apps run in garbage-collected runtimes (V8/JSCore/etc.). This does not make memory leak analysis redundant: GC only reclaims objects that are **unreachable**. Most frontend "memory leaks" are actually **unintended retention** where application/framework objects remain reachable via long-lived references (e.g., subscriptions, event listeners, timers, watchers, caches, singleton services). In these cases, GC is behaving correctly; the bug is that a reference chain still exists.

To make this distinction measurable and reduce variance from nondeterministic GC scheduling, the benchmark harness forces a GC before recording each snapshot (when running with `--expose-gc`). The expected signal is **retained heap growth after GC** in the BAD variant, while the GOOD variant remains comparatively stable.

---

## Project Structure

```
studies/03-memory-leaks/
├── data/
│   └── app-samples.md          # Curated repo list (300 React + 200 Vue + 100 Angular)
├── src/
│   ├── step1-repo-scan/
│   │   ├── detector/
│   │   │   ├── types.ts         # ScanIssue, ScanResult, AggregatedResults interfaces
│   │   │   ├── parser.ts        # Babel parser config (JSX, TSX, decorators)
│   │   │   ├── react-detector.ts    # React useEffect/addEventListener leak patterns
│   │   │   ├── vue-detector.ts      # Vue lifecycle/watch leak patterns
│   │   │   ├── angular-detector.ts  # Angular subscribe/ngOnDestroy leak patterns
│   │   │   └── framework-utils.ts   # Shared detection helpers
│   │   ├── scanner.ts           # Clone repos, run per-framework detectors
│   │   └── aggregate-results.ts # Summarize across all repos
│   └── step2-benchmarks/
│       ├── scenarios/           # Per-framework leak scenario apps
│       ├── run-react.ts
│       ├── run-vue.ts
│       ├── run-angular.ts
│       └── run-all.ts
├── results/                     # Scan and benchmark output JSON
├── content/                     # Article drafts
├── .repos/                      # Temp clone directory (gitignored)
├── .fixtures/                   # Benchmark fixture files (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18
- **Git** (for cloning sample repos)
- **npm** (for dependency installation)

## Setup

```bash
cd studies/03-memory-leaks
npm install
```

## Execution

### Step 1: Scan repositories

```bash
# Step 1 — repo scan (static analysis)
npm run scan -- --limit 5 --framework react

# Resume a previous run from checkpoint
npm run scan -- --resume

# Full scan (all 600 repos)
npm run scan

# Limit to first N repos for quick testing
npm run scan -- --limit 10

# Aggregate results from latest scan
npm run scan:aggregate
```

### Step 2: Run benchmarks

```bash
# All frameworks
npm run bench:all

# Individual frameworks
npm run bench:react
npm run bench:vue
npm run bench:angular
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run scan` | Clone and scan repos for memory leak patterns |
| `npm run scan:aggregate` | Aggregate raw scan results into summary |
| `npm run bench:all` | Run all framework benchmark scenarios |
| `npm run bench:react` | React-only leak vs clean benchmarks |
| `npm run bench:vue` | Vue-only leak vs clean benchmarks |
| `npm run bench:angular` | Angular-only leak vs clean benchmarks |
| `--limit <n>` | Limit number of repos to scan (useful for sampling) |
| `--framework <react|vue|angular>` | Only scan repos tagged with that framework |
| `--output <path>` | Override output path for scan JSON |
| `--checkpoint <path>` | Write or resume from a specific checkpoint file (defaults to `results/scan-checkpoint.json`) |
| `--resume` | Resume the last interrupted scan using the checkpoint file |

## Output Files

| File | Contents |
|------|----------|
| `results/scan-*.json` | Raw per-repo scan issues |
| `results/summary-*.json` | Aggregated breakdowns by framework, pattern, severity |
| `results/bench-*.json` | Memory profiling metrics per scenario |

## Troubleshooting

- **Clone failures:** Rerun `npm run scan`; transient network issues are common.
- **Large scan runtime:** Use `--limit N` for iterative development.
- **Parser errors:** The parser uses `errorRecovery: true` — parse failures are logged but don't halt the scan.
- **Memory benchmark variance:** Repeat runs and use median values.

## Articles

- **Published:** [stackinsight.dev/blog/memory-leak-empirical-study](https://stackinsight.dev/blog/memory-leak-empirical-study)

Draft versions in `content/`.
