// Regex benchmark runner for Study 10

import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import ret from 'ret';
import { BenchResult, TIMEOUT_MS } from './types';

export async function timeRegexMatch(
  regex: RegExp,
  input: string,
  timeoutMs: number = TIMEOUT_MS
): Promise<BenchResult> {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().rss;

  let matchTimeMs = 0;
  let timeoutHit = false;
  let backtracks = 0; // ret doesn't give backtracks, but complexity

  try {
    const { matchTimeMs: workerTime, timeout } = await runRegexInWorker(
      regex.source,
      regex.flags,
      input,
      timeoutMs
    );
    matchTimeMs = workerTime;
    timeoutHit = timeout;
  } catch (error) {
    matchTimeMs = performance.now() - startTime;
    timeoutHit = true;
  }

  const endMemory = process.memoryUsage().rss;
  const rssDeltaMb = (endMemory - startMemory) / (1024 * 1024);

  // Calculate complexity using ret
  let complexityScore = 0;
  try {
    const parsed = ret(regex.source);
    complexityScore = estimateComplexity(parsed);
  } catch (error) {
    // If parsing fails, score as 0
  }

  return {
    inputSize: input.length,
    matchTimeMs,
    complexityScore,
    backtracks, // Placeholder
    eventLoopBlockMs: 0, // TODO: measure event loop lag
    timeoutHit,
  };
}

function runRegexInWorker(
  pattern: string,
  flags: string,
  input: string,
  timeoutMs: number
): Promise<{ matchTimeMs: number; timeout: boolean }> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      parentPort.on('message', ({ pattern, flags, input }) => {
        const start = Date.now();
        let matchTimeMs = 0;
        let error = null;

        try {
          const regex = new RegExp(pattern, flags);
          regex.test(input);
          matchTimeMs = Date.now() - start;
        } catch (err) {
          matchTimeMs = Date.now() - start;
          error = err && err.message ? err.message : String(err);
        }

        parentPort.postMessage({ matchTimeMs, error });
      });
    `;

    const worker = new Worker(workerCode, { eval: true });
    const timeout = setTimeout(() => {
      worker.terminate().then(() => resolve({ matchTimeMs: timeoutMs, timeout: true }));
    }, timeoutMs);

    worker.on('message', (message: any) => {
      clearTimeout(timeout);
      worker.terminate().then(() => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve({ matchTimeMs: message.matchTimeMs, timeout: false });
        }
      });
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    worker.postMessage({ pattern, flags, input });
  });
}

function estimateComplexity(parsed: any): number {
  // Simple complexity estimation based on ret structure
  // This is a rough approximation
  let score = 0;

  function traverse(node: any): void {
    if (!node) return;

    if (node.type === 'quantifier') {
      score += node.min + node.max;
      if (node.min > 1 || node.max > 1) score *= 2; // Nested quantifiers
    }

    if (node.type === 'group') {
      score += 1;
    }

    if (node.options) {
      node.options.forEach(traverse);
    }

    if (node.value) {
      traverse(node.value);
    }

    if (Array.isArray(node)) {
      node.forEach(traverse);
    }
  }

  traverse(parsed);
  return score;
}