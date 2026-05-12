# Study 09: Benchmark Specifications

## Overview

Each benchmark module measures the performance impact of a large payload anti-pattern vs its optimized equivalent.

## Common Configuration

| Parameter | Value |
|-----------|-------|
| Node.js | v22+ |
| Trials | 30 |
| Warmup | 5 (discarded) |
| CV Threshold | 15% |
| Payload Sizes | 1KB, 10KB, 100KB, 1MB, 10MB |

## Benchmark Modules

### BM-01: JSON Parse Time by Size

**Purpose**: Measure JSON.parse() time across payload sizes.

| Variant | Description |
|---------|-------------|
| Baseline | Parse 10MB JSON blob |
| Optimized | Parse 100KB paginated chunk |

**Expected**: Parse time scales ~O(n) with payload size. 10MB should block event loop significantly.

### BM-02: Memory Consumption by Size

**Purpose**: Measure heap memory delta after parsing.

| Variant | Description |
|---------|-------------|
| Baseline | Parse and retain 10MB JSON |
| Optimized | Parse and retain 100KB chunk |

**Expected**: Memory scales linearly. 10MB JSON → ~20-30MB heap (object overhead).

### BM-03: Unbounded vs Paginated Query

**Purpose**: Simulate database query performance.

| Variant | Description |
|---------|-------------|
| Baseline | `findMany()` without limit (simulated) |
| Optimized | `findMany({ take: 100 })` |

**Expected**: Unbounded query time grows with dataset size. Paginated stays constant.

### BM-04: Deep Nested Include vs Flat

**Purpose**: Measure N+1-style payload inflation from nested includes.

| Variant | Description |
|---------|-------------|
| Baseline | 3-level nested include (user.posts.comments) |
| Optimized | Flat response with separate endpoints |

**Expected**: Deep nesting inflates payload 10-100× vs flat structure.

### BM-05: GraphQL Batching vs Pagination

**Purpose**: Compare GraphQL batch queries to paginated queries.

| Variant | Description |
|---------|-------------|
| Baseline | Single query fetching 1000 items |
| Optimized | Paginated query with cursor |

**Expected**: Batch query returns massive payload. Paginated returns controlled chunks.

## Metrics Collected

```typescript
interface BenchResult {
  payloadSize: number;      // bytes
  parseTimeMs: number;      // JSON.parse duration
  heapDeltaMb: number;      // memory before/after
  eventLoopBlockMs: number; // if any
}
```

## Output Format

Results written to `results/bench-YYYY-MM-DDTHH-mm-ss-sssZ.json`:

```json
[
  {
    "module": "BM-01",
    "description": "JSON Parse Time by Size",
    "payloadSizes": [1024, 10240, 102400, 1048576, 10485760],
    "baseline": [...],
    "optimized": [...],
    "speedupBySize": {
      "1024": 1.0,
      "10240": 1.2,
      ...
    },
    "timestamp": "2026-05-03T..."
  }
]
```

## Running Benchmarks

```bash
# All modules
npm run bench:all

# Individual module
npm run bench:bm01
```
