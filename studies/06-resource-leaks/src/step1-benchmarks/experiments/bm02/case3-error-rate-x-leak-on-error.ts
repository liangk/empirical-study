/**
 * BM-02 Case 3: Error Rate × Leak-on-Error Behavior
 *
 * Shows how file operation errors (permission denied, file not found, etc.)
 * leak FDs when the error path is missing try/finally { fh.close() }.
 * X-axis: error rate (0% to 30%)
 * Y-axis: cleanup behavior + base leak probability (8 combinations)
 * Metrics: leaked FDs, failure rate, time-to-EMFILE, throughput
 */
import { ExperimentResult, GridCell } from '../types';
import { FDConfig, FDWorkloadConfig, runFDSimulation } from '../fd-simulator';

const CASE_ID = 'bm02-case3';
const CASE_NAME = 'Error Rate × Leak-on-Error Behavior';

const errorRates = [0, 0.01, 0.05, 0.10, 0.15, 0.20, 0.30];

interface CleanupBehavior { leakOnError: boolean; baseLeakProb: number; label: string; }
const behaviors: CleanupBehavior[] = [
  { leakOnError: false, baseLeakProb: 0,    label: 'cleanup+0%leak' },
  { leakOnError: false, baseLeakProb: 0.02, label: 'cleanup+2%leak' },
  { leakOnError: false, baseLeakProb: 0.05, label: 'cleanup+5%leak' },
  { leakOnError: false, baseLeakProb: 0.10, label: 'cleanup+10%leak' },
  { leakOnError: true,  baseLeakProb: 0,    label: 'no-cleanup+0%leak' },
  { leakOnError: true,  baseLeakProb: 0.02, label: 'no-cleanup+2%leak' },
  { leakOnError: true,  baseLeakProb: 0.05, label: 'no-cleanup+5%leak' },
  { leakOnError: true,  baseLeakProb: 0.10, label: 'no-cleanup+10%leak' },
];

const baseConfig: FDConfig = { fdLimit: 1024, openTimeMs: 5, openTimeJitter: 1, fileSize: 1024 };

export function runBm02Case3(): ExperimentResult<number, string> {
  const grid: GridCell<number, string>[][] = [];

  for (const b of behaviors) {
    const row: GridCell<number, string>[] = [];
    for (const er of errorRates) {
      const workload: FDWorkloadConfig = {
        durationMs: 30_000, concurrency: 20, arrivalIntervalMs: 5,
        leakProbability: b.baseLeakProb, errorRate: er, leakOnError: b.leakOnError,
      };
      row.push({
        xParam: er, yParam: b.label,
        xLabel: `${(er * 100).toFixed(0)}%`, yLabel: b.label,
        result: runFDSimulation(baseConfig, workload),
      });
    }
    grid.push(row);
  }

  return {
    caseId: CASE_ID, caseName: CASE_NAME,
    xAxisName: 'Error Rate', yAxisName: 'Cleanup Behavior',
    xValues: errorRates, yValues: behaviors.map(b => b.label),
    grid, metric: 'leakedConnections', timestamp: new Date().toISOString(),
  };
}
