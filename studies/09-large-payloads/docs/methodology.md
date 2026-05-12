# Study 09: Large Payload Anti-Patterns — Methodology

## Overview

This study quantifies the prevalence and performance impact of large payload anti-patterns in real-world REST and GraphQL APIs. I measure JSON parse time, memory consumption, and network transfer costs across varying payload sizes, then scan a 300-repository corpus for unbounded query patterns.

## Research Questions

1. **Prevalence**: How common are unbounded queries (missing pagination, SELECT *) in production APIs?
2. **Performance**: What is the parse time and memory overhead of large JSON payloads?
3. **Cost**: What are the real egress and mobile data costs of oversized responses?
4. **Patterns**: Which API types (REST vs GraphQL) exhibit more large payload issues?

## Three-Phase Approach

### Phase 1: Controlled Benchmarks

Measure JSON parsing performance and memory consumption across payload sizes.

**Environment:**
- Node.js v22+ (V8 JSON parser)
- 30 trials per payload size
- 5 warmup trials discarded
- CV threshold: 15% (GC jitter)

**Payload Sizes:**
- 1 KB (baseline)
- 10 KB
- 100 KB
- 1 MB
- 10 MB

**Metrics:**
- Parse time (ms)
- Memory delta (heapUsed before/after)
- Event loop blocking (if any)

### Phase 2: Real-World Corpus Scan

Scan 300 API repositories for unbounded query patterns.

**Detection Categories:**

| ID | Pattern | Severity | Description |
|----|---------|----------|-------------|
| `unbounded_find_all` | Unbounded findAll | High | `findAll()` or `find()` without limit/where |
| `select_star` | SELECT * | High | SQL `SELECT *` without column list |
| `missing_pagination` | Missing Pagination | High | Endpoint without limit/offset or cursor |
| `deep_nested_include` | Deep Nested Include | Medium | Prisma `include` with 3+ levels |
| `unbounded_graphql` | Unbounded GraphQL | High | GraphQL resolver without pagination |

**Corpus Domains:**
- SaaS / Business Applications (50 repos)
- Data / Analytics APIs (50 repos)
- Developer Tools / APIs (50 repos)
- E-commerce / Marketplace APIs (50 repos)
- Content / Media APIs (50 repos)
- Fintech / Banking APIs (50 repos)

### Phase 3: Static Analysis Detector

Build a standalone Babel AST detector for large payload patterns.

**Detection Targets:**
- Prisma: `findMany()`, `findAll()` without `take` or `where`
- TypeORM: `find()` without `take` or `where`
- Sequelize: `findAll()` without `limit`
- Mongoose: `find()` without `limit`
- SQL strings: `SELECT *` patterns
- GraphQL: Resolvers returning arrays without pagination

## Statistical Analysis

### Benchmark Metrics

- **Mean/Median**: Central tendency of parse time
- **StdDev/CV**: Variability measure
- **P5/P95**: Tail latency

### Comparison

- **Speedup Ratio**: `baseline_time / optimized_time`
- **Memory Ratio**: `baseline_memory / optimized_memory`

### Significance Testing

- **Welch's t-test**: Compare baseline vs optimized parse times
- **Cohen's d**: Effect size magnitude

## Expected Outcomes

1. **Quantified prevalence**: % of APIs with unbounded queries
2. **Performance benchmarks**: Parse time by payload size
3. **Cost projections**: Egress costs for typical API traffic
4. **Detection tool**: `payload-detector.ts` for codebase scanning

## Limitations

- Benchmarks use synthetic JSON, not real API responses
- Memory measurements are Node.js-specific (V8 heap)
- Network transfer simulated, not measured in real conditions
- Detector covers common ORMs, not all query builders

## References

- [JSON.parse() V8 implementation](https://v8.dev/blog/fast-json)
- [Prisma pagination best practices](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)
- [GraphQL pagination specification](https://graphql.org/learn/pagination/)
- [AWS egress pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer)
