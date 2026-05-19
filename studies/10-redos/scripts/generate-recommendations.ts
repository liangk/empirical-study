// Generate recommendations for fixing vulnerable regex patterns
import * as fs from 'fs';
import * as path from 'path';

interface Recommendation {
  pattern: string;
  severity: string;
  problem: string;
  vulnerable: string;
  fixed: string;
  explanation: string;
  prevalence: number;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    pattern: 'overlapping_alternatives',
    severity: 'HIGH',
    problem: 'Overlapping alternatives in groups cause exponential backtracking',
    vulnerable: '(a|a)+ or (view|edit)? or (token|token)+',
    fixed: 'a+ or (view|edit)? (already good) or token+',
    explanation:
      'When alternatives overlap (e.g., (a|a)), the regex engine tries both branches, leading to 2^n complexity. Use character classes or simpler alternation when possible.',
    prevalence: 0,
  },
  {
    pattern: 'overlapping_alternatives_group',
    severity: 'HIGH',
    problem: 'Multiple alternatives with overlapping matches',
    vulnerable: '(a|aa)+$ // tries to match "aa" with "a" first, backtracks',
    fixed: 'aa*$ or a+$ // order alternatives by specificity',
    explanation:
      'When you have alternatives like (a|aa), put the longer/more specific one first: (aa|a). Better: use (a)+$ to capture repetition clearly.',
    prevalence: 0,
  },
  {
    pattern: 'nested_quantifiers',
    severity: 'CRITICAL',
    problem: 'Nested quantifiers cause catastrophic exponential backtracking',
    vulnerable: '(a+)+$ or (a*)*$ or ([a-z]+)+',
    fixed: 'a+$ or [a-z]+$ // remove inner quantifier',
    explanation:
      'Nested quantifiers like (a+)+ allow exponential combinations. The inner quantifier can match in multiple ways (1,2,...,n characters), and the outer quantifier repeats this, creating 2^n paths.',
    prevalence: 0,
  },
  {
    pattern: 'unbounded_quantifiers',
    severity: 'MEDIUM',
    problem: 'Multiple unbounded quantifiers create performance issues',
    vulnerable: '.+@.+\\..*+ or [^@]+@[^@]+\\.[^@]+',
    fixed: '[^@]+@[^@]+\\.[^@]+ // use character classes or be specific',
    explanation:
      'Multiple .+ or .* quantifiers can cause quadratic or worse complexity. Use character classes [^@] to be specific about what you want to match.',
    prevalence: 0,
  },
  {
    pattern: 'email_pattern',
    severity: 'MEDIUM',
    problem: 'Email validation patterns are notoriously vulnerable',
    vulnerable:
      '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$ // with (.+)+',
    fixed: 'Use email validation library or simple check: /^.+@.+\\..+$/',
    explanation:
      'Email regex is famously vulnerable. Real validation should use: 1) Libraries like email-validator, 2) Sending confirmation emails, 3) Simple regex like /^.+@.+\\..+$/',
    prevalence: 0,
  },
  {
    pattern: 'url_pattern',
    severity: 'MEDIUM',
    problem: 'URL validation patterns are complex and often vulnerable',
    vulnerable:
      '^(https?://)?[a-zA-Z0-9.-]+(:[0-9]+)?(/[a-zA-Z0-9._~:/?#@!$&\'()*+,;=-]*)*$',
    fixed: 'new URL(input) // use built-in URL parser',
    explanation:
      'Don\'t write URL regex. Use: new URL(input) for validation, or simple check /^https?:\\/\\// for protocol check.',
    prevalence: 0,
  },
];

interface ScanResult {
  repo: string;
  findings: Array<{
    pattern: string;
    severity: string;
    code: string;
  }>;
}

function generateRecommendations() {
  const resultsFile = path.join(
    __dirname,
    '..',
    'results',
    'scan-results.json'
  );

  if (!fs.existsSync(resultsFile)) {
    console.error(`Results file not found: ${resultsFile}`);
    process.exit(1);
  }

  console.log('Loading scan results...');
  const scanResults: ScanResult[] = JSON.parse(
    fs.readFileSync(resultsFile, 'utf8')
  );

  // Count prevalence
  const patternCounts: Record<string, number> = {};

  for (const repo of scanResults) {
    for (const finding of repo.findings) {
      patternCounts[finding.pattern] =
        (patternCounts[finding.pattern] || 0) + 1;
    }
  }

  // Update prevalence in recommendations
  RECOMMENDATIONS.forEach((rec) => {
    rec.prevalence = patternCounts[rec.pattern] || 0;
  });

  // Sort by prevalence
  RECOMMENDATIONS.sort((a, b) => b.prevalence - a.prevalence);

  // Generate markdown report
  let markdown = `# ReDoS Vulnerability Fixing Guide

This guide provides recommendations for fixing the most common ReDoS vulnerabilities found in the study.

## Summary
- Total vulnerabilities scanned: ${scanResults.reduce((sum, r) => sum + r.findings.length, 0)}
- Unique vulnerable patterns: ${Object.keys(patternCounts).length}

## Pattern Distribution
${Object.entries(patternCounts)
  .sort(([, a], [, b]) => b - a)
  .map(([pattern, count]) => `- **${pattern}**: ${count} occurrences`)
  .join('\n')}

---

## Vulnerability Fixes (Sorted by Prevalence)

`;

  RECOMMENDATIONS.forEach((rec, idx) => {
    markdown += `### ${idx + 1}. ${rec.pattern.toUpperCase()}
**Severity**: ${rec.severity}  
**Prevalence**: ${rec.prevalence} findings (${((rec.prevalence / (patternCounts[rec.pattern] || 1)) * 100).toFixed(1)}% of scanned code)

#### Problem
${rec.problem}

#### Vulnerable Pattern
\`\`\`javascript
${rec.vulnerable}
\`\`\`

#### Fixed Pattern
\`\`\`javascript
${rec.fixed}
\`\`\`

#### Explanation
${rec.explanation}

---

`;
  });

  markdown += `## General Recommendations

### 1. **Avoid Nested Quantifiers (Critical)**
- ❌ \`(a+)+\` \`(a*)*\` \`([a-z]+)+\`
- ✅ \`a+\` \`[a-z]+\`

### 2. **Order Alternatives by Specificity (High Priority)**
- ❌ \`(a|aa)\` - tries \`a\` first, backtracks on 'aa'
- ✅ \`(aa|a)\` - tries longer match first

### 3. **Use Character Classes Instead of Alternation (Medium Priority)**
- ❌ \`(0|1|2|3|4|5)\`
- ✅ \`[0-5]\`

### 4. **Be Specific About Non-Greedy Matching (Medium Priority)**
- ❌ \`.+@.+\` - both quantifiers are greedy
- ✅ \`[^@]+@[^@]+\` - character class is specific

### 5. **Use Built-in Validators for Complex Patterns (High Priority)**
- Email: Use \`email-validator\` library or confirm via email
- URL: Use \`new URL(input)\` instead of regex
- IP: Use \`ip-address\` library
- Phone: Use \`libphonenumber-js\` library

### 6. **Test with Malicious Input (Critical)**
Always test regex with:
- Input that doesn't match: \`'a'.repeat(50) + 'b'\`
- Monitor execution time for >100ms duration
- Consider timeout for user input validation

## Implementation Priority

### Phase 1 (Critical - Do First)
1. Fix nested quantifiers in critical paths
2. Add input validation and timeouts for user-facing regex
3. Update email/URL patterns to use libraries

### Phase 2 (High - Do Soon)
1. Reorder alternatives by specificity
2. Replace alternation with character classes
3. Add regex complexity checks in code review

### Phase 3 (Medium - Do Later)
1. Refactor complex patterns
2. Add automated testing for regex performance
3. Document regex patterns and complexity

## Tools & Resources

### Runtime Protection
\`\`\`javascript
// Add timeout wrapper for regex
function testWithTimeout(regex, input, timeoutMs = 100) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return regex.test(input);
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Regex timeout detected');
      return false;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
\`\`\`

### Static Analysis
- **ESLint**: \`eslint-plugin-security\` includes regex checks
- **npm audit**: Checks for vulnerable dependencies
- **regex101.com**: Test regex with performance indicators

### Testing Framework
\`\`\`javascript
describe('Regex Performance', () => {
  it('email pattern should not timeout on 50 chars', () => {
    const input = 'a'.repeat(50) + '@example.com';
    const start = Date.now();
    const result = /^[^@]+@[^@]+\\.[^@]+$/.test(input);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
\`\`\`

---

## References

1. **OWASP ReDoS**: https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service
2. **Regular Expressions & Performance**: https://www.regular-expressions.info/performance.html
3. **Catastrophic Backtracking**: https://www.rexegg.com/regex-catastrophic-backtracking.html
4. **Node.js Security Best Practices**: https://nodejs.org/en/docs/guides/security/

`;

  const reportFile = path.join(
    __dirname,
    '..',
    'results',
    'FIXING-RECOMMENDATIONS.md'
  );
  fs.writeFileSync(reportFile, markdown);

  // Also save as JSON for programmatic use
  const jsonFile = path.join(
    __dirname,
    '..',
    'results',
    'fixing-recommendations.json'
  );
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalVulnerabilities: scanResults.reduce(
            (sum, r) => sum + r.findings.length,
            0
          ),
          uniquePatterns: Object.keys(patternCounts).length,
          patternDistribution: patternCounts,
        },
        recommendations: RECOMMENDATIONS,
      },
      null,
      2
    )
  );

  console.log('\n=== RECOMMENDATIONS GENERATED ===\n');
  console.log(`✅ Markdown report: ${reportFile}`);
  console.log(`✅ JSON report: ${jsonFile}`);
  console.log(`\n📊 Pattern Distribution:`);
  Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} findings`);
    });
}

generateRecommendations();
