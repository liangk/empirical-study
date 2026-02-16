/**
 * Study 03 — Array Size Calibration Experiment
 *
 * Tests different component data sizes to determine appropriate values for:
 * 1. Signal clarity (BAD vs GOOD separation)
 * 2. Rate measurement stability (MB/min)
 * 3. Budget framing (time-to-threshold under constrained environments)
 *
 * Usage:
 *   ts-node src/step2-benchmarks/calibrate-sizes.ts
 *
 * Outputs calibration report with recommended sizes for formal runs.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

interface CalibrationSnapshot {
  cycle: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface CalibrationResult {
  arraySize: number;
  variant: 'bad' | 'good';
  cycles: number;
  snapshots: CalibrationSnapshot[];
  totalHeapGrowth: number;
  avgHeapGrowthPerCycle: number;
  peakHeapUsed: number;
  growthRateMBPerMin: number;
  durationMs: number;
  signalToNoiseRatio?: number; // Only for BAD variant after comparison
}

interface CalibrationReport {
  timestamp: string;
  testedSizes: number[];
  results: CalibrationResult[];
  recommendations: {
    minimal: { size: number; reason: string };
    moderate: { size: number; reason: string };
    aggressive: { size: number; reason: string };
  };
  analysisNotes: string[];
}

// Test sizes: small to large
const TEST_SIZES = [500, 1000, 2500, 5000, 10000];
const CALIBRATION_CYCLES = 50; // Shorter than formal runs

// Simulate leaking component by retaining payload buffers between mounts
class CalibrationComponent {
  private payload: number[];
  private secondaryPayload: number[];
  private scratchBuffers: Buffer[] = [];

  constructor(arraySize: number) {
    this.payload = new Array(arraySize).fill(0).map(() => Math.random());
    const secondarySize = Math.max(100, Math.floor(arraySize / 4));
    this.secondaryPayload = new Array(secondarySize).fill(0).map(() => Math.random());
  }

  private churn(iterations: number) {
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < this.payload.length; j += 16) {
        this.payload[j] = (this.payload[j] + Math.random() * 0.0001) % 1;
      }
      const buf = Buffer.alloc(1024, i % 256);
      this.scratchBuffers.push(buf);
      if (this.scratchBuffers.length > 8) {
        this.scratchBuffers.shift();
      }
    }
  }

  mountBad() {
    this.churn(4);
  }

  unmountBad() {
    // BAD variant intentionally keeps payload references alive
  }

  mountGood() {
    this.churn(4);
  }

  unmountGood() {
    // GOOD variant clears payload immediately
    this.releasePayload();
  }

  forceCleanup() {
    this.releasePayload();
  }

  private releasePayload() {
    this.payload = [];
    this.secondaryPayload = [];
    this.scratchBuffers = [];
  }
}

function takeSnapshot(cycle: number, forceGC: boolean = false): CalibrationSnapshot {
  if (forceGC && global.gc) global.gc();
  const mem = process.memoryUsage();
  return {
    cycle,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

async function runCalibration(
  arraySize: number,
  variant: 'bad' | 'good',
  cycles: number
): Promise<CalibrationResult> {
  const snapshots: CalibrationSnapshot[] = [];
  const leakedComponents: CalibrationComponent[] = [];
  
  snapshots.push(takeSnapshot(0, true));
  const startTime = Date.now();

  for (let i = 1; i <= cycles; i++) {
    const component = new CalibrationComponent(arraySize);
    
    if (variant === 'bad') {
      component.mountBad();
      await new Promise(resolve => setImmediate(resolve));
      component.unmountBad();
    } else {
      component.mountGood();
      await new Promise(resolve => setImmediate(resolve));
      component.unmountGood();
    }
    
    if (variant === 'bad') {
      // Keep reference alive so leak accumulates
      leakedComponents.push(component);
    }

    if (i % 5 === 0) {
      snapshots.push(takeSnapshot(i, true));
    }
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // Cleanup
  for (const comp of leakedComponents) {
    comp.forceCleanup();
  }

  // Calculate metrics
  const first = snapshots[0].heapUsed;
  const last = snapshots[snapshots.length - 1].heapUsed;
  const totalHeapGrowth = last - first;
  const avgHeapGrowthPerCycle = totalHeapGrowth / cycles;
  const peakHeapUsed = Math.max(...snapshots.map(s => s.heapUsed));
  
  // Growth rate in MB/min
  const durationMin = durationMs / 60000;
  const growthMB = totalHeapGrowth / (1024 * 1024);
  const growthRateMBPerMin = durationMin > 0 ? growthMB / durationMin : 0;

  return {
    arraySize,
    variant,
    cycles,
    snapshots,
    totalHeapGrowth,
    avgHeapGrowthPerCycle,
    peakHeapUsed,
    growthRateMBPerMin,
    durationMs,
  };
}

function analyzeResults(results: CalibrationResult[]): CalibrationReport {
  const badResults = results.filter(r => r.variant === 'bad');
  const goodResults = results.filter(r => r.variant === 'good');

  // Calculate signal-to-noise ratio for each size
  for (const bad of badResults) {
    const good = goodResults.find(g => g.arraySize === bad.arraySize);
    if (good) {
      // SNR = |BAD growth - GOOD growth| / GOOD growth
      // Higher is better (clearer separation)
      const diff = Math.abs(bad.totalHeapGrowth - good.totalHeapGrowth);
      const snr = good.totalHeapGrowth !== 0 
        ? diff / Math.abs(good.totalHeapGrowth)
        : diff > 0 ? Infinity : 0;
      bad.signalToNoiseRatio = snr;
    }
  }

  // Find optimal sizes
  const sortedBySNR = [...badResults].sort((a, b) => 
    (b.signalToNoiseRatio || 0) - (a.signalToNoiseRatio || 0)
  );

  const analysisNotes: string[] = [];
  
  // Minimal: smallest size with SNR > 2
  const minimal = sortedBySNR.find(r => (r.signalToNoiseRatio || 0) > 2);
  
  // Moderate: mid-range with good SNR and reasonable growth rate
  const moderate = sortedBySNR.find(r => 
    (r.signalToNoiseRatio || 0) > 3 && 
    r.growthRateMBPerMin > 0.5 && 
    r.growthRateMBPerMin < 5
  );
  
  // Aggressive: highest SNR
  const aggressive = sortedBySNR[0];

  analysisNotes.push(`Tested ${TEST_SIZES.length} array sizes with ${CALIBRATION_CYCLES} cycles each`);
  analysisNotes.push(`Signal-to-Noise ratios range from ${Math.min(...badResults.map(r => r.signalToNoiseRatio || 0)).toFixed(2)} to ${Math.max(...badResults.map(r => r.signalToNoiseRatio || 0)).toFixed(2)}`);
  analysisNotes.push(`Growth rates range from ${Math.min(...badResults.map(r => r.growthRateMBPerMin)).toFixed(3)} to ${Math.max(...badResults.map(r => r.growthRateMBPerMin)).toFixed(3)} MB/min`);

  return {
    timestamp: new Date().toISOString(),
    testedSizes: TEST_SIZES,
    results,
    recommendations: {
      minimal: minimal 
        ? { size: minimal.arraySize, reason: `Lowest size with SNR > 2 (${minimal.signalToNoiseRatio?.toFixed(2)}), suitable for quick tests` }
        : { size: TEST_SIZES[0], reason: 'Fallback: smallest tested size' },
      moderate: moderate
        ? { size: moderate.arraySize, reason: `Balanced SNR (${moderate.signalToNoiseRatio?.toFixed(2)}) and growth rate (${moderate.growthRateMBPerMin.toFixed(2)} MB/min)` }
        : { size: TEST_SIZES[Math.floor(TEST_SIZES.length / 2)], reason: 'Fallback: mid-range size' },
      aggressive: aggressive
        ? { size: aggressive.arraySize, reason: `Highest SNR (${aggressive.signalToNoiseRatio?.toFixed(2)}), clearest signal for formal studies` }
        : { size: TEST_SIZES[TEST_SIZES.length - 1], reason: 'Fallback: largest tested size' },
    },
    analysisNotes,
  };
}

async function main() {
  console.log('\n=== Memory Leak Array Size Calibration ===');
  console.log(`Testing sizes: ${TEST_SIZES.join(', ')}`);
  console.log(`Cycles per test: ${CALIBRATION_CYCLES}`);
  console.log('');

  const results: CalibrationResult[] = [];

  for (const size of TEST_SIZES) {
    console.log(`Testing array size ${size}...`);
    
    console.log(`  Running BAD variant...`);
    const bad = await runCalibration(size, 'bad', CALIBRATION_CYCLES);
    results.push(bad);
    
    console.log(`  Running GOOD variant...`);
    const good = await runCalibration(size, 'good', CALIBRATION_CYCLES);
    results.push(good);
    
    console.log(`  BAD:  ${(bad.totalHeapGrowth / 1024).toFixed(1)} KB growth, ${bad.growthRateMBPerMin.toFixed(3)} MB/min`);
    console.log(`  GOOD: ${(good.totalHeapGrowth / 1024).toFixed(1)} KB growth, ${good.growthRateMBPerMin.toFixed(3)} MB/min`);
    console.log('');
  }

  // Analyze and generate report
  const report = analyzeResults(results);

  console.log('=== Calibration Results ===');
  console.log(`\nRecommendations:`);
  console.log(`  Minimal:   ${report.recommendations.minimal.size} - ${report.recommendations.minimal.reason}`);
  console.log(`  Moderate:  ${report.recommendations.moderate.size} - ${report.recommendations.moderate.reason}`);
  console.log(`  Aggressive: ${report.recommendations.aggressive.size} - ${report.recommendations.aggressive.reason}`);
  
  console.log(`\nAnalysis Notes:`);
  for (const note of report.analysisNotes) {
    console.log(`  - ${note}`);
  }

  // Save detailed report
  const outputPath = join(__dirname, '..', '..', 'results', `calibration-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${outputPath}`);
  console.log('\nUse recommended sizes in formal benchmark scenarios for optimal signal clarity.');
}

main().catch(err => {
  console.error('Calibration failed:', err);
  process.exit(1);
});
