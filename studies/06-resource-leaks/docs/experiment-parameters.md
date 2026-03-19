# Experiment Parameter Configuration Guide (BM-01 through BM-06)

## Overview

The two-dimensional impact experiments (Phase 1b) use **hardcoded parameters** in each case file for reproducibility. This document explains where parameters are defined and how to modify them across all benchmark modules.

**Scope:**
- **BM-01:** 5 experiment cases (connection pool exhaustion)
- **BM-02:** 3 experiment cases (file descriptor exhaustion)
- **BM-03:** 3 experiment cases (stream leaks)
- **BM-04:** 3 experiment cases (HTTP socket leaks)
- **BM-05:** 3 experiment cases (timer leaks)
- **BM-06:** 3 experiment cases (event listener leaks)

**Total:** 20 experiment cases across 6 modules

See `docs/experiment-design-bm02-06.md` for detailed case definitions, research questions, and expected findings for BM02-BM06.

---

## Parameter Structure

Each experiment case has three parameter groups:

### 1. X/Y Axis Values
The discrete values for each dimension of the parameter grid.

### 2. Pool Configuration
```typescript
interface PoolConfig {
  maxConnections: number;      // Pool size limit
  acquireTimeoutMs: number;    // How long to wait for a connection before timing out
  queryTimeMs: number;         // Average query execution time
  queryTimeJitter: number;     // Random variance in query time (±jitter)
}
```

### 3. Workload Configuration
```typescript
interface WorkloadConfig {
  durationMs: number;          // Total simulation duration
  concurrency: number;         // Max concurrent requests
  arrivalIntervalMs: number;   // Time between request arrivals (steady mode)
  burstSize: number;           // Requests per burst (burst mode)
  burstIntervalMs: number;     // Time between bursts (burst mode)
  leakProbability: number;     // Probability a connection leaks (0.0-1.0)
  errorRate: number;           // Probability a query fails (0.0-1.0)
  leakOnError: boolean;        // Whether errors also leak connections
}
```

---

## Case 1: Leak Probability × Concurrency

**File:** `src/step1-benchmarks/experiments/case1-leak-prob-x-concurrency.ts`

### Parameter Location

```typescript
// Lines 7-8: Grid dimensions
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const concurrencies = [1, 5, 10, 20, 50, 100];

// Line 10: Pool config (fixed)
const basePool: PoolConfig = { 
  maxConnections: 20, 
  acquireTimeoutMs: 500, 
  queryTimeMs: 50, 
  queryTimeJitter: 10 
};

// Lines 11-13: Workload config (partial)
const baseWorkload: Omit<WorkloadConfig, 'leakProbability' | 'concurrency'> = {
  durationMs: 30_000,
  arrivalIntervalMs: 10,
  burstSize: 1,
  burstIntervalMs: 0,
  errorRate: 0,
  leakOnError: false,
};
```

### How Parameters Are Applied

For each `(concurrency, leakProbability)` pair:
- Pool: Uses `basePool` (fixed)
- Workload: Merges `baseWorkload` with current `leakProbability` and `concurrency`
- `arrivalIntervalMs` is dynamically adjusted: `Math.max(1, Math.round(50 / concurrency))`

### To Modify

**Add more leak probabilities:**
```typescript
const leakProbs = [0, 0.005, 0.01, 0.02, 0.05, 0.10, 0.15, 0.20];
```

**Change pool size:**
```typescript
const basePool: PoolConfig = { maxConnections: 50, ... };
```

**Increase simulation duration:**
```typescript
const baseWorkload = { durationMs: 60_000, ... };
```

---

## Case 2: Query Time × Pool Size

**File:** `src/step1-benchmarks/experiments/case2-query-time-x-pool-size.ts`

### Parameter Location

```typescript
// Lines 7-8: Grid dimensions
const queryTimes = [5, 20, 50, 100, 200, 500, 1000];
const poolSizes = [5, 10, 20, 50, 100];

// Lines 10-13: Workload config (fixed)
const baseWorkload: Omit<WorkloadConfig, 'concurrency'> & { concurrency: number } = {
  durationMs: 30_000,
  concurrency: 20,
  arrivalIntervalMs: 5,
  burstSize: 1,
  burstIntervalMs: 0,
  leakProbability: 0.05,
  errorRate: 0,
  leakOnError: false,
};
```

### How Parameters Are Applied

For each `(poolSize, queryTime)` pair:
- Pool: Creates new config with current `maxConnections` and `queryTimeMs`
- `queryTimeJitter` is set to 20% of `queryTimeMs`
- Workload: Uses `baseWorkload` (fixed concurrency 20, 5% leak probability)

### To Modify

**Add intermediate query times:**
```typescript
const queryTimes = [5, 10, 20, 50, 100, 200, 300, 500, 1000];
```

**Change leak probability:**
```typescript
const baseWorkload = { leakProbability: 0.10, ... };
```

---

## Case 3: Burst Size × Acquire Timeout

**File:** `src/step1-benchmarks/experiments/case3-burst-x-timeout.ts`

### Parameter Location

```typescript
// Lines 7-8: Grid dimensions
const burstSizes = [1, 5, 10, 20, 30, 50];
const acquireTimeouts = [50, 100, 500, 1000, 2000, 5000];

// Line 10: Pool config (partial)
const basePool: Omit<PoolConfig, 'acquireTimeoutMs'> = { 
  maxConnections: 20, 
  queryTimeMs: 50, 
  queryTimeJitter: 10 
};
```

### How Parameters Are Applied

For each `(acquireTimeout, burstSize)` pair:
- Pool: Merges `basePool` with current `acquireTimeoutMs`
- Workload: Sets `burstSize` and `burstIntervalMs: 200`
- Fixed: 5% leak probability, 20 concurrency

### To Modify

**Add larger bursts:**
```typescript
const burstSizes = [1, 10, 25, 50, 75, 100];
```

**Change burst interval:**
```typescript
const workload: WorkloadConfig = {
  ...
  burstIntervalMs: 500,  // Bursts every 500ms instead of 200ms
};
```

---

## Case 4: Error Rate × Leak-on-Error Behavior

**File:** `src/step1-benchmarks/experiments/case4-error-rate-x-leak-on-error.ts`

### Parameter Location

```typescript
// Line 7: Grid X dimension
const errorRates = [0, 0.01, 0.05, 0.10, 0.15, 0.20, 0.30];

// Lines 9-18: Grid Y dimension (8 behavior combinations)
interface LeakBehavior { leakOnError: boolean; baseLeakProb: number; label: string; }
const leakBehaviors: LeakBehavior[] = [
  { leakOnError: false, baseLeakProb: 0,    label: 'cleanup+0%leak' },
  { leakOnError: false, baseLeakProb: 0.02, label: 'cleanup+2%leak' },
  { leakOnError: false, baseLeakProb: 0.05, label: 'cleanup+5%leak' },
  { leakOnError: false, baseLeakProb: 0.10, label: 'cleanup+10%leak' },
  { leakOnError: true,  baseLeakProb: 0,    label: 'no-cleanup+0%leak' },
  { leakOnError: true,  baseLeakProb: 0.02, label: 'no-cleanup+2%leak' },
  { leakOnError: true,  baseLeakProb: 0.05, label: 'no-cleanup+5%leak' },
  { leakOnError: true,  baseLeakProb: 0.10, label: 'no-cleanup+10%leak' },
];

// Line 20: Pool config (fixed)
const basePool: PoolConfig = { 
  maxConnections: 20, 
  acquireTimeoutMs: 500, 
  queryTimeMs: 50, 
  queryTimeJitter: 10 
};
```

### How Parameters Are Applied

For each `(leakBehavior, errorRate)` pair:
- Pool: Uses `basePool` (fixed)
- Workload: Uses current `errorRate`, `leakOnError`, and `baseLeakProb`
- Fixed: 20 concurrency, steady arrivals

### To Modify

**Add higher error rates:**
```typescript
const errorRates = [0, 0.05, 0.10, 0.20, 0.30, 0.50, 0.75];
```

**Add more leak behavior combos:**
```typescript
const leakBehaviors: LeakBehavior[] = [
  ...existing,
  { leakOnError: true, baseLeakProb: 0.15, label: 'no-cleanup+15%leak' },
  { leakOnError: true, baseLeakProb: 0.20, label: 'no-cleanup+20%leak' },
];
```

---

## Case 5: Leak Probability × DB Max Connections

**File:** `src/step1-benchmarks/experiments/case5-leak-prob-x-max-conns.ts`

### Parameter Location

```typescript
// Lines 7-8: Grid dimensions
const leakProbs = [0, 0.01, 0.02, 0.05, 0.10, 0.20];
const maxConns = [5, 10, 20, 50, 100, 200];

// Lines 10-14: Workload config (fixed)
const baseWorkload: WorkloadConfig = {
  durationMs: 30_000,
  concurrency: 20,
  arrivalIntervalMs: 5,
  burstSize: 1,
  burstIntervalMs: 0,
  leakProbability: 0,
  errorRate: 0,
  leakOnError: false,
};
```

### How Parameters Are Applied

For each `(maxConnections, leakProbability)` pair:
- Pool: Creates new config with current `maxConnections`
- Workload: Merges `baseWorkload` with current `leakProbability`
- Fixed: Query time 50ms, acquire timeout 500ms

### To Modify

**Add cloud-scale connection limits:**
```typescript
const maxConns = [5, 10, 20, 50, 100, 200, 500, 1000];
```

**Change concurrency:**
```typescript
const baseWorkload = { concurrency: 50, ... };
```

---

## Global Defaults

All cases share these defaults unless overridden:

| Parameter | Default | Reasoning |
|-----------|---------|-----------|
| `durationMs` | 30,000 | 30 seconds — enough requests to show patterns |
| `queryTimeMs` | 50 | Typical fast query latency |
| `queryTimeJitter` | 10 or 20% | Realistic variance |
| `acquireTimeoutMs` | 500 | Common production timeout |
| `burstIntervalMs` | 0 or 200 | Steady vs bursty traffic |
| `arrivalIntervalMs` | 5-10 | High request rate |

---

## How to Add a New Case

1. **Create case file:** `src/step1-benchmarks/experiments/case6-custom.ts`

2. **Define parameters:**
```typescript
const xValues = [/* your X axis */];
const yValues = [/* your Y axis */];
const basePool: PoolConfig = { /* fixed pool config */ };
const baseWorkload: WorkloadConfig = { /* fixed workload config */ };
```

3. **Implement grid loop:**
```typescript
export function runCase6(): ExperimentResult {
  const grid: GridCell<number, number>[][] = [];
  for (const y of yValues) {
    const row: GridCell<number, number>[] = [];
    for (const x of xValues) {
      const pool: PoolConfig = { ...basePool, /* apply X */ };
      const workload: WorkloadConfig = { ...baseWorkload, /* apply Y */ };
      const result = runSimulation(pool, workload);
      row.push({ xParam: x, yParam: y, xLabel: `${x}`, yLabel: `${y}`, result });
    }
    grid.push(row);
  }
  return { caseId: 'case6', caseName: 'Custom Case', xAxisName: 'X', yAxisName: 'Y', xValues, yValues, grid, metric: 'failureRate', timestamp: new Date().toISOString() };
}
```

4. **Import in run-experiments.ts:**
```typescript
import { runCase6 } from './case6-custom';
// Add to main() function
```

5. **Add npm script to package.json:**
```json
"experiments:case6": "node -r ts-node/register src/step1-benchmarks/experiments/run-experiments.ts --case 6"
```

---

## Summary: All 20 Experiment Cases Across 6 Modules

### Quick Reference Table

| Module | Case | X-Axis | Y-Axis | Research Question | Key Metrics |
|--------|------|--------|--------|-------------------|-------------|
| **BM-01** | 1 | Leak Probability | Concurrency | How do small leak rates scale with parallelism? | Failure rate, time-to-exhaustion, throughput |
| **BM-01** | 2 | Query Time | Pool Size | When do long queries saturate the pool? | Throughput, failure rate, mean latency |
| **BM-01** | 3 | Burst Size | Acquire Timeout | Do bursts cause latency spikes or hard failures? | p95 latency, failure rate, throughput |
| **BM-01** | 4 | Error Rate | Leak-on-Error Behavior | Does missing cleanup amplify error impact? | Leaked connections, failure rate, throughput |
| **BM-01** | 5 | Leak Probability | DB Max Connections | Cross-service blast radius? | Time-to-exhaustion, failure rate |
| **BM-02** | 1 | Leak Probability | Concurrency | How do FD leaks scale with parallel file ops? | Failure rate, time-to-EMFILE, leaked FDs |
| **BM-02** | 2 | File Size | FD Limit (ulimit) | Large files: EMFILE or OOM first? | Time-to-EMFILE, time-to-OOM, memory/FD |
| **BM-02** | 3 | Error Rate | Leak-on-Error Behavior | Do file errors leak FDs without try/finally? | Leaked FDs, failure rate, throughput |
| **BM-03** | 1 | Leak Probability | Concurrency | How do stream leaks scale with parallelism? | Leaked FDs, leaked memory, failure rate |
| **BM-03** | 2 | File Size | Leak Probability | Do larger files amplify stream memory leaks? | Memory/stream, time-to-OOM, time-to-EMFILE |
| **BM-03** | 3 | Error Rate | Error Handling | Do stream errors leak without destroy()? | Leaked FDs, leaked memory, throughput |
| **BM-04** | 1 | Leak Probability | Concurrency | How do socket leaks scale with parallel requests? | Leaked sockets, failure rate, throughput |
| **BM-04** | 2 | Timeout Duration | Concurrency | Long timeouts: latency spike or throughput loss? | p95 latency, timeout count, throughput |
| **BM-04** | 3 | Error Rate | Error Handling | Do HTTP errors leak sockets? | Leaked sockets, failure rate, throughput |
| **BM-05** | 1 | Leak Probability | Concurrency | How do timer leaks scale with timer creation rate? | Active timers, heap growth, CPU proxy |
| **BM-05** | 2 | Closure Size | Leak Probability | How do large closures amplify timer memory leaks? | Heap growth rate, memory/timer, time-to-OOM |
| **BM-05** | 3 | Timer Interval | Concurrency | Do short intervals cause CPU saturation? | Timer fire count, event loop delay, throughput |
| **BM-06** | 1 | Leak Probability | Listener Count | When does MaxListenersExceeded trigger? | Listener count, heap growth, emit latency |
| **BM-06** | 2 | Closure Size | Leak Probability | How do listener closures impact memory? | Heap growth rate, memory/listener, time-to-OOM |
| **BM-06** | 3 | Event Frequency | Listener Count | Do high-frequency events cause CPU saturation? | Callback invocations, event loop delay, emit latency |

### Pattern Analysis

**Common Case 1 (7 modules):** Leak Probability × Concurrency
- BM-01, BM-02, BM-03, BM-04, BM-05, BM-06 (but BM-06 uses "Listener Count" instead of "Concurrency")
- Fundamental scaling relationship: how small leaks become catastrophic at high parallelism
- Most important case for understanding production failure modes

**Common Case 3 (4 modules):** Error Rate × Leak-on-Error Behavior
- BM-01, BM-02, BM-03, BM-04
- Demonstrates importance of cleanup in error paths (try/finally, error handlers)
- Shows error amplification when cleanup is missing

**Closure/Memory Cases (3 modules):** Closure Size × Leak Probability
- BM-05 (timers), BM-06 (listeners), BM-03 (file size as memory proxy)
- Memory impact of captured references
- Critical for understanding why "small" leaks become "large" memory problems

**Performance/Latency Cases (3 modules):** 
- BM-01 Case 3: Burst × Timeout (fail-fast vs wait)
- BM-04 Case 2: Timeout × Concurrency
- BM-05 Case 3: Timer Interval × Concurrency (CPU saturation)
- BM-06 Case 3: Event Frequency × Listener Count (emit performance)

### Implementation Status

**All modules implemented:**
- ✅ BM-01 (5 cases) — `pool-simulator.ts` + `case1`–`case5`, orchestrator: `run-experiments.ts`
- ✅ BM-02 (4 cases) — `fd-simulator.ts` + `bm02/case1`–`case4`, orchestrator: `run-experiments-bm02.ts`
- ✅ BM-03 (4 cases) — `stream-simulator.ts` + `bm03/case1`–`case4`, orchestrator: `run-experiments-bm03.ts`
- ✅ BM-04 (5 cases) — `socket-simulator.ts` + `bm04/case1`–`case5`, orchestrator: `run-experiments-bm04.ts`
- ✅ BM-05 (4 cases) — `timer-simulator.ts` + `bm05/case1`–`case4`, orchestrator: `run-experiments-bm05.ts`
- ✅ BM-06 (5 cases) — `listener-simulator.ts` + `bm06/case1`–`case5`, orchestrator: `run-experiments-bm06.ts`

**Total: 27 experiment cases across 6 modules**

**Approximate experiment grid cells:** ~1,400 parameter combinations (avg 6×6 grid × 27 cases)

**Total simulation time:** ~42,000 seconds simulated workload (30s × 1,400 cells)

---

## Next Steps for Implementation

1. **Create simulators** (one per module):
   - `fd-simulator.ts` (BM-02)
   - `stream-simulator.ts` (BM-03)
   - `socket-simulator.ts` (BM-04)
   - `timer-simulator.ts` (BM-05)
   - `listener-simulator.ts` (BM-06)

2. **Create case files** (3 per module, 15 total):
   - `src/step1-benchmarks/experiments/bm02/case1-leak-prob-x-concurrency.ts`
   - `src/step1-benchmarks/experiments/bm02/case2-file-size-x-fd-limit.ts`
   - `src/step1-benchmarks/experiments/bm02/case3-error-rate-x-leak-on-error.ts`
   - (Similar structure for BM-03 through BM-06)

3. **Add npm scripts** to `package.json`:
   ```json
   "experiments:bm02": "...",
   "experiments:bm02:case1": "...",
   // etc.
   ```

4. **Update orchestrator** (`run-experiments.ts` or create `run-experiments-bm02.ts`) to handle module-specific cases

5. **Generate blog articles** (Parts 2-6) following the same structure as Part 1 (BM-01)

---

## Summary: Where to Find Parameters

| Case | X Axis Location | Y Axis Location | Pool Config | Workload Config |
|------|----------------|-----------------|-------------|-----------------|
| 1 | Line 7 | Line 8 | Line 10 (fixed) | Lines 11-13 (varies by concurrency) |
| 2 | Line 7 | Line 8 | Computed (varies by pool size & query time) | Lines 10-13 (fixed) |
| 3 | Line 7 | Line 8 | Line 10 + computed timeout | Computed (varies by burst size) |
| 4 | Line 17 | Lines 19-28 | Line 31 (fixed) | Computed (varies by error rate & leak behavior) |
| 5 | Line 7 | Line 8 | Computed (varies by max conns) | Lines 10-14 (varies by leak prob) |

All parameters are **hardcoded constants** at the top of each case file for reproducibility. To change them, edit the source files directly.
