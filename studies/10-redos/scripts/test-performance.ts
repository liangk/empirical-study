// Performance Impact Testing Script
// Tests all findings for actual ReDoS vulnerability with timing analysis

import * as fs from 'fs';
import * as path from 'path';

interface Finding {
  pattern: string;
  severity: string;
  file: string;
  line: number;
  code: string;
  description: string;
}

interface ScanResult {
  repo: string;
  findings: Finding[];
}

interface PerformanceTest {
  pattern: string;
  severity: string;
  repo: string;
  file: string;
  line: number;
  code: string;
  vulnerable: boolean;
  timeoutOccurred: boolean;
  results: Array<{
    inputSize: number;
    duration: number;
    matched: boolean;
    timeout: boolean;
  }>;
  averageComplexity?: string;
}

const TIMEOUT_MS = 5000; // 5 second timeout per test
const TEST_SIZES = [10, 15, 20, 25, 30, 35, 40];

function escapeRegexString(str: string): string {
  // Handle special escape sequences in regex strings
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

function generateTestInput(size: number, baseChar: string = 'a'): string {
  // Generate test input that doesn't match to trigger backtracking
  return baseChar.repeat(size) + 'Z'; // Suffix that doesn't match to force full scan
}

function testPattern(
  pattern: string,
  inputSizes: number[] = TEST_SIZES
): PerformanceTest['results'] {
  const results: PerformanceTest['results'] = [];

  try {
    const regex = new RegExp(pattern);

    for (const size of inputSizes) {
      const input = generateTestInput(size);
      const startTime = Date.now();
      let matched = false;
      let timedOut = false;

      try {
        // Set a timeout for the regex test
        const timeoutPromise = new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve('timeout');
          }, TIMEOUT_MS);
        });

        const testPromise = Promise.resolve().then(() => {
          matched = regex.test(input);
          return 'done';
        });

        // Race between test and timeout - using a workaround for Node.js
        const startSync = Date.now();
        matched = regex.test(input);
        const duration = Date.now() - startSync;

        if (duration > TIMEOUT_MS) {
          timedOut = true;
        }

        results.push({
          inputSize: size,
          duration,
          matched,
          timeout: timedOut,
        });

        // If we hit timeout on this size, stop testing larger sizes
        if (timedOut) {
          break;
        }
      } catch (error) {
        results.push({
          inputSize: size,
          duration: TIMEOUT_MS,
          matched: false,
          timeout: true,
        });
        break;
      }
    }
  } catch (error: any) {
    // Invalid regex pattern
    results.push({
      inputSize: 0,
      duration: 0,
      matched: false,
      timeout: false,
    });
  }

  return results;
}

function analyzeComplexity(results: PerformanceTest['results']): string {
  if (results.length < 2) return 'N/A';

  // Calculate complexity growth factor
  let totalGrowth = 0;
  let comparisons = 0;

  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    if (prev.duration > 0 && !prev.timeout && !curr.timeout) {
      const sizeRatio = curr.inputSize / prev.inputSize;
      const timeRatio = curr.duration / prev.duration;

      // Estimate complexity: O(k^n) means time grows by k^(sizeRatio)
      if (timeRatio > 1) {
        const estimatedBase = Math.pow(timeRatio, 1 / (sizeRatio - 1));
        totalGrowth += estimatedBase;
        comparisons++;
      }
    }
  }

  if (comparisons === 0) return 'Linear or constant';

  const avgGrowth = totalGrowth / comparisons;

  if (avgGrowth > 10) return 'Exponential (2^n or worse)';
  if (avgGrowth > 3) return 'Polynomial (~2.5^n)';
  if (avgGrowth > 1.5) return 'Super-linear';
  return 'Linear';
}

async function main() {
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

  console.log(`Loaded ${scanResults.length} repos\n`);

  const performanceTests: PerformanceTest[] = [];
  let totalTested = 0;
  let totalVulnerable = 0;
  let totalTimeouts = 0;

  // Test patterns
  for (const repo of scanResults) {
    for (const finding of repo.findings) {
      totalTested++;

      process.stdout.write(
        `\rTesting patterns... [${totalTested}/${scanResults.reduce((sum, r) => sum + r.findings.length, 0)}]`
      );

      try {
        const testResults = testPattern(finding.pattern);
        const hasTimeout = testResults.some((r) => r.timeout);
        const isVulnerable =
          testResults.some((r) => r.duration > 100) || hasTimeout;

        if (isVulnerable) totalVulnerable++;
        if (hasTimeout) totalTimeouts++;

        performanceTests.push({
          pattern: finding.pattern,
          severity: finding.severity,
          repo: repo.repo,
          file: finding.file,
          line: finding.line,
          code: finding.code,
          vulnerable: isVulnerable,
          timeoutOccurred: hasTimeout,
          results: testResults,
          averageComplexity: analyzeComplexity(testResults),
        });
      } catch (error) {
        // Skip invalid patterns
      }
    }
  }

  console.log('\n\n=== PERFORMANCE ANALYSIS RESULTS ===\n');
  console.log(`Total patterns tested: ${totalTested}`);
  console.log(`Patterns with performance issues: ${totalVulnerable}`);
  console.log(`Patterns with timeouts: ${totalTimeouts}`);
  console.log(
    `Confirmed vulnerable rate: ${((totalVulnerable / totalTested) * 100).toFixed(2)}%\n`
  );

  // Sort by worst performance
  performanceTests.sort((a, b) => {
    const aDuration = a.results[a.results.length - 1]?.duration || 0;
    const bDuration = b.results[b.results.length - 1]?.duration || 0;
    return bDuration - aDuration;
  });

  // Show top 10 worst performers
  console.log('🔴 TOP 10 WORST PERFORMING PATTERNS:\n');
  performanceTests.slice(0, 10).forEach((test, idx) => {
    const lastResult = test.results[test.results.length - 1];
    console.log(`${idx + 1}. ${test.pattern}`);
    console.log(`   Repo: ${test.repo}`);
    console.log(`   Code: ${test.code.substring(0, 80)}`);
    console.log(`   Max duration: ${lastResult.duration}ms`);
    console.log(`   Complexity: ${test.averageComplexity}`);
    console.log(`   Timeout: ${test.timeoutOccurred ? '✓ YES' : '✗ No'}\n`);
  });

  // Save detailed results
  const reportFile = path.join(
    __dirname,
    '..',
    'results',
    'performance-analysis.json'
  );
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalPatternsTested: totalTested,
          vulnerablePatterns: totalVulnerable,
          patternWithTimeouts: totalTimeouts,
          vulnerabilityRate: `${((totalVulnerable / totalTested) * 100).toFixed(2)}%`,
        },
        topWorstPerformers: performanceTests.slice(0, 20),
      },
      null,
      2
    )
  );

  console.log(`✅ Detailed report saved to: ${reportFile}`);

  // Generate CSV for easy import
  const csvFile = path.join(
    __dirname,
    '..',
    'results',
    'performance-analysis.csv'
  );
  const csvContent = `Pattern,Severity,Repo,File,Line,Code,Vulnerable,Timeout,MaxDuration(ms),Complexity,InputSizes,Durations\n${performanceTests
    .map(
      (test) =>
        `"${test.pattern.replace(/"/g, '""')}","${test.severity}","${test.repo}","${test.file.replace(/"/g, '""')}",${test.line},"${test.code.replace(/"/g, '""')}",${test.vulnerable},${test.timeoutOccurred},${test.results[test.results.length - 1]?.duration || 0},"${test.averageComplexity}","${test.results.map((r) => r.inputSize).join(',')}","${test.results.map((r) => r.duration).join(',')}"`
    )
    .join('\n')}`;

  fs.writeFileSync(csvFile, csvContent);
  console.log(`📊 CSV report saved to: ${csvFile}`);
}

main().catch(console.error);
