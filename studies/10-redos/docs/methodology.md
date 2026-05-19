# ReDoS Vulnerabilities Study Methodology

## Overview

This study systematically analyzes Regular Expression Denial of Service (ReDoS) vulnerabilities across the Node.js ecosystem through four complementary phases.

## Phase 1: Controlled Benchmarks

### Objective
Measure the performance impact of different ReDoS patterns under controlled conditions.

### Methodology
- Generate malicious input strings of varying lengths (10-100,000 characters)
- Test vulnerable vs. safe regex implementations
- Measure match time, complexity score, and timeout behavior
- Run 30 trials per configuration with 5 warmup iterations

### Test Patterns

#### Synthetic Benchmarks (BM-01 to BM-04)
Simplified patterns that isolate specific vulnerability mechanisms:

1. **BM-01 Nested Quantifiers**: `(a*)*` vs `a*`
2. **BM-02 Overlapping Alternatives**: `(a|a)*` vs `a*`
3. **BM-03 Large Repetition**: `(a{1,100})*b` vs `a{1,100}b`
4. **BM-04 Complex Groups**: `((a+)+)+` vs `a+`

#### Realistic Benchmarks (BM-05 to BM-06)
Real-world pattern structures found in production code:

5. **BM-05 Email Validator**: `([a-zA-Z0-9_%+-]+)+@([a-zA-Z0-9.-]+)+\.[a-z]{2,}` (CVE-2013-7345 style)
6. **BM-06 URL Path Parser**: `(\/[a-zA-Z0-9_-]+)*\/?` (ReDoS in URL parsers)

### Synthetic vs Real-World Patterns

#### Why Synthetic Patterns?

While our primary benchmarks use simplified inputs (e.g., `'aaa...aaa'`), they serve important purposes:

**Principle Isolation**: Synthetic patterns isolate a single vulnerability mechanism, enabling precise reproducible measurement. Real patterns combine multiple semantic layers, making diagnosis difficult.

**Worst-Case Representation**: Simple inputs represent the optimal worst-case for triggering exponential backtracking. Real attackers craft semantically valid inputs that follow the same principle.

**Reproducibility**: Synthetic tests produce identical results across systems and time, critical for scientific rigor. Real-world scenarios vary by application, engine version, and input source.

**Scalability**: Testing 1000s of pattern combinations on simple inputs is fast. Real patterns require semantic parsing and would slow analysis significantly.

#### Mapping Synthetic to Real-World

The same backtracking mechanisms apply in both contexts:

| Synthetic Example | Real-World Equivalent | CVE/Issue |
|-------------------|----------------------|-----------|
| `(a\|a)*` on `'aaa...aaa!'` | Email validator with overlapping alternatives | CVE-2013-7345 |
| `((a+)+)+` on `'aaa...aaa!'` | HTML/URL parser with nested groups | Cloudflare WAF ReDoS |
| `(a{1,100})*b` on `'aaa...aaa'` | Hex decoder with repeated chunks | Nginx ngx_http_parse_uri |
| `(a*)*` on `'aaa...aaa!'` | Form validator with nested quantifiers | Apache Commons |

Detailed mappings and real-world context are provided in [benchmark-patterns-explained.md](./benchmark-patterns-explained.md).

#### Realistic Benchmarks (BM-05, BM-06)

To bridge the gap, we include realistic benchmarks with actual semantic structures (email, URL) while maintaining the same attack principles as synthetic tests. These serve as validation that the vulnerability mechanisms generalize beyond simple patterns.

## Phase 2: Real-World Corpus Analysis

### Objective
Quantify prevalence of ReDoS vulnerabilities in production Node.js codebases.

### Methodology
- Sample 500 popular Node.js repositories across 5 domains
- Clone repositories and scan for regex literals
- Use AST analysis to identify vulnerable patterns
- Calculate complexity scores for all regexes found

### Repository Categories
- Web frameworks and libraries (100 repos)
- API servers and microservices (100 repos)
- CLI tools and utilities (100 repos)
- Data processing and ETL (100 repos)
- Security and authentication (100 repos)

## Phase 3: Static Analysis Detector

### Objective
Create automated tool for detecting ReDoS vulnerabilities in codebases.

### Methodology
- Parse JavaScript/TypeScript files using Babel AST
- Extract regex literals and `new RegExp()` calls
- Analyze patterns using ret.js library for complexity scoring
- Flag patterns exceeding complexity thresholds

### Detection Rules
- Nested quantifiers with complexity > 10
- Overlapping alternatives in groups
- Unbounded repetitions > 100
- Complex nested groups (depth > 3)

## Phase 4: Exploit Simulation

### Objective
Demonstrate real-world exploit scenarios and mitigation effectiveness.

### Methodology
- Generate malicious inputs for each vulnerability pattern
- Test with and without timeout protections
- Measure event loop blocking duration
- Validate mitigation strategies (timeouts, safe patterns)

### Exploit Scenarios
- Email validation bypass
- URL parsing attacks
- User input sanitization failures
- Log parsing vulnerabilities

## Data Collection

### Metrics Collected
- Regex match execution time
- Complexity scores (ret.js)
- Timeout occurrences
- Memory usage deltas
- Event loop blocking time

### Statistical Analysis
- Mean, median, standard deviation
- 5th and 95th percentiles
- Coefficient of variation
- Speedup ratios (vulnerable vs. safe)

## Validation

### Reproducibility
- All code and data publicly available
- Deterministic random input generation
- Version-pinned dependencies

### Accuracy
- Manual review of 10% sample
- Cross-validation with multiple regex engines
- Expert review of findings

## Limitations

### Scope Limitations
- Focus on JavaScript regex syntax
- Limited to literal regexes (not dynamic construction)
- Node.js V8 regex engine specific

### Performance Considerations
- Timeout set to 5 seconds for safety
- Limited input sizes to prevent system hangs
- Parallel execution with resource limits

## Ethical Considerations

### Responsible Disclosure
- Only analyze public repositories
- No exploitation of live systems
- Findings reported to maintainers when appropriate

### Data Privacy
- No collection of sensitive information
- Analysis limited to code patterns
- Aggregated results only