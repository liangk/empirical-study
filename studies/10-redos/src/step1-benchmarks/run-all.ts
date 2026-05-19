// Study 10: ReDoS Vulnerabilities - Benchmark Runner
// Measures regex match time, complexity, and backtracking

import * as path from 'path';
import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { BenchResult, ModuleResult, INPUT_SIZES, TRIALS, WARMUP } from './types';
import { stats } from './stats';
import { timeRegexMatch } from './runner';

// --- Benchmark Modules ---

const MODULES = [
  {
    id: 'BM-01',
    description: 'Nested Quantifiers: (a*)* vs a*',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      const regex = /(a*)*$/; // Vulnerable nested quantifiers
      const input = 'a'.repeat(size) + '!'; // Malicious input
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      const regex = /a*$/; // Safe simple quantifier
      const input = 'a'.repeat(size) + '!';
      return timeRegexMatch(regex, input);
    },
  },
  {
    id: 'BM-02',
    description: 'Overlapping Alternatives: (a|a)* vs a*',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      const regex = /(a|a)*$/; // Vulnerable overlapping
      const input = 'a'.repeat(size) + '!';
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      const regex = /a*$/; // Safe simple pattern
      const input = 'a'.repeat(size) + '!';
      return timeRegexMatch(regex, input);
    },
  },
  {
    id: 'BM-03',
    description: 'Large Repetition: (a{1,100})*b vs bounded',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      const regex = /(a{1,100})*b/; // Vulnerable large repetition with backtracking
      const input = 'a'.repeat(size);
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      const regex = /a{1,100}b/; // Safe bounded
      const input = 'a'.repeat(Math.min(size, 100)) + 'b';
      return timeRegexMatch(regex, input);
    },
  },
  {
    id: 'BM-04',
    description: 'Complex Groups: ((a+)+)+ vs simplified',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      const regex = /((a+)+)+$/; // Vulnerable nested groups
      const input = 'a'.repeat(size) + '!';
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      const regex = /a+$/; // Safe simplified
      const input = 'a'.repeat(size) + '!';
      return timeRegexMatch(regex, input);
    },
  },
  {
    id: 'BM-05',
    description: 'Email Validator: ([a-z]+)+@([a-z]+)+ vs simple',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      // Real-world email pattern with nested quantifiers (CVE-2013-7345 style)
      const regex = /^([a-zA-Z0-9_%+-]+)+@([a-zA-Z0-9.-]+)+\.[a-zA-Z]{2,}$/;
      // Malicious input: valid chars in local part, triggers backtracking on missing domain
      const input = 'test'.repeat(Math.floor(size / 4)) + '@';
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      // Safe version: simple quantifier without nesting
      const regex = /^[a-zA-Z0-9_%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const input = 'test@example.com';
      return timeRegexMatch(regex, input);
    },
  },
  {
    id: 'BM-06',
    description: 'Cookie Parser: (token|token)+ vs simple',
    runVulnerable: async (size: number): Promise<BenchResult> => {
      // Real-world cookie/header parser with overlapping alternatives (similar to BM-02)
      // Multiple ways to match the same token cause exponential backtracking
      const regex = /^(token|token)+end$/;
      // Malicious input: repeated "token" strings without "end" terminator
      const input = 'token'.repeat(Math.floor(size / 5)) + 'x';
      return timeRegexMatch(regex, input);
    },
    runSafe: async (size: number): Promise<BenchResult> => {
      // Safe version: single alternative
      const regex = /^token+end$/;
      const input = 'tokentokenend';
      return timeRegexMatch(regex, input);
    },
  },
];

// --- Runner Logic ---

async function runTrials(
  fn: () => Promise<BenchResult>,
  count: number,
  label: string
): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await fn();
  }

  // Actual trials
  for (let i = 0; i < count; i++) {
    const trialNumber = i + 1;
    process.stdout.write(`      ${label} trial ${trialNumber}/${count}... `);
    const result = await fn();
    results.push(result);
    console.log(`${result.matchTimeMs.toFixed(1)}ms timeout=${result.timeoutHit}`);

    if (result.timeoutHit) {
      console.log(`      ${label} hit timeout at trial ${trialNumber}; stopping remaining trials for this size.`);
      break;
    }
  }

  return results;
}

async function runModule(module: any): Promise<ModuleResult> {
  console.log(`Running module ${module.id}: ${module.description}`);

  const vulnerable: any[] = [];
  const safe: any[] = [];

  for (const inputSize of INPUT_SIZES) {
    console.log(`  Input size: ${inputSize}`);

    // Vulnerable variant
    const vulnTrials = await runTrials(
      () => module.runVulnerable(inputSize),
      TRIALS,
      `${module.id} vuln ${inputSize}`
    );
    const vulnStats = stats(vulnTrials.map(r => r.matchTimeMs));
    const vulnTimeoutCount = vulnTrials.filter(r => r.timeoutHit).length;
    vulnerable.push({
      module: module.id,
      variant: 'vulnerable',
      inputSize,
      trials: vulnTrials,
      ...vulnStats,
      timeoutCount: vulnTimeoutCount,
      timeoutRate: vulnTrials.length > 0 ? vulnTimeoutCount / vulnTrials.length : 0,
    });

    // Safe variant
    const safeTrials = await runTrials(
      () => module.runSafe(inputSize),
      TRIALS,
      `${module.id} safe ${inputSize}`
    );
    const safeStats = stats(safeTrials.map(r => r.matchTimeMs));
    const safeTimeoutCount = safeTrials.filter(r => r.timeoutHit).length;
    safe.push({
      module: module.id,
      variant: 'safe',
      inputSize,
      trials: safeTrials,
      ...safeStats,
      timeoutCount: safeTimeoutCount,
      timeoutRate: safeTrials.length > 0 ? safeTimeoutCount / safeTrials.length : 0,
    });
  }

  // Calculate speedups
  const speedupBySize: Record<number, number> = {};
  for (const size of INPUT_SIZES) {
    const vuln = vulnerable.find(v => v.inputSize === size);
    const saf = safe.find(s => s.inputSize === size);
    if (vuln && saf && saf.mean > 0) {
      speedupBySize[size] = vuln.mean / saf.mean;
    }
  }

  return {
    module: module.id,
    description: module.description,
    inputSizes: INPUT_SIZES,
    vulnerable,
    safe,
    speedupBySize,
    timestamp: new Date().toISOString(),
  };
}

async function runAllModules(): Promise<ModuleResult[]> {
  const results: ModuleResult[] = [];

  for (const module of MODULES) {
    const result = await runModule(module);
    results.push(result);
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  let moduleFilter: string | undefined;
  
  // Handle both --module=BM-01 and --module BM-01 formats
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--module=')) {
      moduleFilter = args[i].split('=')[1];
      break;
    } else if (args[i] === '--module' && i + 1 < args.length) {
      moduleFilter = args[i + 1];
      break;
    }
  }

  console.log('Starting ReDoS benchmark suite...');

  const results = moduleFilter
    ? [await runModule(MODULES.find(m => m.id === moduleFilter)!)]
    : await runAllModules();

  // Save results
  const outputDir = path.join(__dirname, '..', '..', 'results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `bench-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${filepath} (${results.length} modules)`);

  // Print summary
  console.log('\nBenchmark Summary:');
  for (const result of results) {
    console.log(`\n${result.module}: ${result.description}`);
    for (const size of result.inputSizes) {
      const vuln = result.vulnerable.find(v => v.inputSize === size);
      const saf = result.safe.find(s => s.inputSize === size);
      const speedup = result.speedupBySize[size];
      const vulnLabel = vuln ? `${vuln.median.toFixed(2)}ms (timeouts ${vuln.timeoutCount}/${vuln.trials.length})` : 'n/a';
      const safeLabel = saf ? `${saf.median.toFixed(2)}ms (timeouts ${saf.timeoutCount}/${saf.trials.length})` : 'n/a';
      console.log(`  Size ${size}: Vuln ${vulnLabel} vs Safe ${safeLabel}${speedup ? ` (${speedup.toFixed(1)}x speedup)` : ''}`);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}