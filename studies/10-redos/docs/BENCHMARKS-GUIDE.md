# ReDoS Benchmarks: Quick Guide

## Running the Benchmarks

### All Benchmarks (BM-01 to BM-06)
```bash
npm run bench:all
```

### Specific Benchmark
```bash
npm run bench:bm01  # Nested Quantifiers
npm run bench:bm02  # Overlapping Alternatives
npm run bench:bm03  # Large Repetition
npm run bench:bm04  # Complex Groups
npm run bench:bm05  # Email Validator (realistic)
npm run bench:bm06  # URL Path Parser (realistic)
```

### With Custom Input Sizes
Edit `src/step1-benchmarks/types.ts` to modify:
```typescript
export const INPUT_SIZES = [10, 20, 40, 60, 80, 100, 1000, 10000];
```

---

## Understanding Results

### Key Metrics

**Match Time (ms)**: How long the regex takes to process the input.
- Vulnerable patterns: Exponentially increase with input size
- Safe patterns: Linear or constant time

**Timeout**: Whether the match hit the 5-second timeout limit.
- `timeout=true` indicates catastrophic backtracking
- `timeout=false` means match completed

**Speedup**: Ratio of vulnerable time to safe time.
- High speedup (1000x+) indicates strong vulnerability
- Examples from recent run:
  - BM-01 Size 40: 75,000x speedup
  - BM-02 Size 60: 150,000x speedup
  - BM-03 Size 40: 75,000x speedup

### Interpreting Patterns

#### BM-01 & BM-04: Nested Quantifiers
```
Vulnerable at size 20-40 characters
Pattern: (a*)*, ((a+)+)+
Attack: Many valid characters → exponential partitioning
```

#### BM-02: Overlapping Alternatives
```
Vulnerable at size 30 characters
Pattern: (a|a)*
Attack: Each position can match either alternative → 2^n paths
```

#### BM-03: Bounded Repetition
```
Vulnerable at size 40+ characters
Pattern: (a{1,100})*b
Attack: Missing terminator forces all partition combinations
```

#### BM-05: Email Validation
```
Vulnerable at size ~50 characters
Input: 'test@test@test@...' (missing domain)
Real-world impact: Form validation DoS
```

#### BM-06: URL Parser
```
Vulnerable at size ~40 characters
Input: '/path/path/path/...' (invalid terminator)
Real-world impact: Request parsing DoS
```

---

## Sample Output Analysis

### Summary Report
```
BM-01: Nested Quantifiers: (a*)* vs a*
  Size 20: Vuln 249.50ms (0/30) vs Safe 0.00ms (0/30) (3710.0x speedup)
  Size 40: Vuln 5000.00ms (1/1) vs Safe 0.00ms (0/30) (75000.0x speedup) ← TIMEOUT
  Size 100: Vuln 5000.00ms (1/1) vs Safe 0.00ms (0/30) (30000.0x speedup) ← TIMEOUT
```

**What this means:**
- At 20 characters: Still completing, but 3,700x slower
- At 40+ characters: Immediate timeout
- Safe pattern: Always completes in <1ms
- **Conclusion:** This pattern is vulnerable to inputs >30 characters

---

## Creating Your Own Malicious Input

### For Any Vulnerable Pattern

1. **Identify what should fail the match**
   - Nested quantifier: Add a character that breaks the pattern (e.g., `!`)
   - Email validator: Omit required part (e.g., no domain)
   - URL parser: Invalid path terminator (e.g., `!`)

2. **Create valid prefix**
   - Use characters that match the vulnerable part
   - Extend to 40-100 characters
   - Examples: `'a'.repeat(50)`, `'test@'.repeat(10)`

3. **Add fail marker**
   - Single invalid character at the end
   - Forces engine to backtrack through all options
   - Example: `input = 'a'.repeat(50) + '!'`

4. **Test locally**
   ```javascript
   const vulnerable = /(a*)*$/;
   const malicious = 'a'.repeat(50) + '!';
   console.time('regex');
   vulnerable.test(malicious);
   console.timeEnd('regex');  // Should be slow!
   ```

---

## Interpreting Speedup Ratios

| Speedup | Interpretation | Severity |
|---------|----------------|----------|
| <10x | Measurable but not extreme | Low |
| 10x–100x | Noticeable performance hit | Medium |
| 100x–1000x | Significant vulnerability | High |
| 1000x+ | Catastrophic backtracking | Critical |

**All our benchmarks reach 1000x+ speedup**, indicating critical vulnerabilities.

---

## Comparing to Your Own Patterns

### Check if Your Pattern Matches Our Structures

```javascript
// Simplified versions to check
1. Does it have (...)*(...)*  or (...)+(...)+?  → BM-01/BM-04 like
2. Does it have (a|b|a) with overlaps?         → BM-02 like
3. Does it have (...{n,m})* with outer repeat? → BM-03 like
4. Does it have (...(...)+)+?                   → BM-04 like
```

### Test with Benchmark Strategy

If your pattern matches one of the above:

```javascript
// 1. Create valid prefix that matches early part
const validPrefix = createInputThatMatchesEarlyPart(pattern);

// 2. Extend it (don't add terminator)
const malicious = validPrefix.repeat(50);

// 3. Test it
const start = Date.now();
pattern.test(malicious);
const duration = Date.now() - start;
console.log(`Time: ${duration}ms`);
```

If duration > 100ms, your pattern is likely vulnerable.

---

## Resources

- **Full Documentation**: See [benchmark-patterns-explained.md](./benchmark-patterns-explained.md)
- **Methodology Details**: See [methodology.md](./methodology.md)
- **Results Data**: See `results/` directory for JSON benchmark results
- **Source Code**: See `src/step1-benchmarks/` for implementation

---

## References

### CVEs Mentioned
- CVE-2013-7345 — Apache Commons Validator email regex
- Cloudflare WAF ReDoS (2019)
- Nginx ReDoS in ngx_http_parse_uri

### Further Reading
- OWASP ReDoS Prevention Cheat Sheet
- Regular Expression Denial of Service (ReDoS) research papers
- "Catastrophic Backtracking" in regex engine design
