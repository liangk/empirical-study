# ReDoS Benchmark Specifications

## Module BM-01: Nested Quantifiers Catastrophic Backtracking

### Vulnerable Pattern
```javascript
/(a*)*$/
```
- Input: `'a'.repeat(n) + '!'`
- Expected: Exponential backtracking on non-match

### Safe Pattern
```javascript
/a*$/
```
- Input: `'a'.repeat(n) + '!'`
- Expected: Linear time execution

### Performance Expectation
- Vulnerable: O(2^n) complexity
- Safe: O(n) complexity
- Speedup: 1000×+ for large inputs

## Module BM-02: Overlapping Alternatives

### Vulnerable Pattern
```javascript
/(a|a)*$/
```
- Input: `'a'.repeat(n) + 'b'`
- Expected: Quadratic backtracking

### Safe Pattern
```javascript
/a*$/
```
- Input: `'a'.repeat(n) + 'b'`
- Expected: Linear execution

### Performance Expectation
- Vulnerable: O(n²) complexity
- Safe: O(n) complexity
- Speedup: 100×+ for large inputs

## Module BM-03: Large Unbounded Repetition

### Vulnerable Pattern
```javascript
/a{100,}$/
```
- Input: `'a'.repeat(n)`
- Expected: Slow for n < 100, fast failure for n >= 100

### Safe Pattern
```javascript
/a{100,1000}$/
```
- Input: `'a'.repeat(Math.min(n, 1000))`
- Expected: Bounded execution time

### Performance Expectation
- Vulnerable: Unpredictable timing
- Safe: Consistent bounded time
- Speedup: Variable, up to 10×

## Module BM-04: Complex Nested Groups

### Vulnerable Pattern
```javascript
/((a+)+)+$/
```
- Input: `'a'.repeat(n) + '!'`
- Expected: Exponential backtracking on complex nesting

### Safe Pattern
```javascript
/a+$/
```
- Input: `'a'.repeat(n) + '!'`
- Expected: Simple linear match

### Performance Expectation
- Vulnerable: O(2^n) complexity
- Safe: O(n) complexity
- Speedup: 1000×+ for large inputs

## Input Size Progression

| Size | Characters | Expected Behavior |
|------|------------|-------------------|
| 10 | 10 | All patterns fast |
| 100 | 100 | Some vulnerable slow |
| 1000 | 1,000 | Most vulnerable timeout |
| 10000 | 10,000 | Critical vulnerable timeout |

## Timeout Configuration

- Match timeout: 5000ms (5 seconds)
- Total benchmark timeout: 300000ms (5 minutes)
- Memory limit: 1GB per process

## Statistical Measures

### Per Trial Metrics
- Execution time (ms)
- Timeout flag
- Memory delta (MB)
- Complexity score

### Aggregate Metrics
- Mean execution time
- Median execution time
- Standard deviation
- 5th percentile (fastest 5%)
- 95th percentile (slowest 5%)
- Coefficient of variation

### Comparative Metrics
- Speedup ratio (vulnerable/safe)
- Timeout rate (%)
- Complexity score delta

## Validation Checks

### Correctness
- Vulnerable patterns should timeout or be slow on malicious input
- Safe patterns should be fast on all inputs
- Non-malicious inputs should be fast for all patterns

### Consistency
- Results should be reproducible across runs
- Statistical distributions should be stable
- Outliers should be investigated

### Performance
- Benchmarks should complete within time limits
- Memory usage should remain bounded
- No system-wide performance impact