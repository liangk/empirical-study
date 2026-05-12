// Benchmark runner utilities for Study 09

import { BenchResult, TrialSet, BenchmarkModule, PAYLOAD_SIZES, TRIALS, WARMUP, CV_THRESHOLD } from './types';
import { stats } from './stats';

export async function runVariant(
  runFn: (payloadSize: number) => Promise<BenchResult>,
  payloadSize: number,
  moduleId: string,
  variant: 'baseline' | 'optimized'
): Promise<TrialSet> {
  const allTrials: BenchResult[] = [];

  for (let trial = 0; trial < TRIALS; trial++) {
    const result = await runFn(payloadSize);
    allTrials.push(result);
  }

  const accepted = allTrials.slice(WARMUP);
  const parseTimes = accepted.map(t => t.parseTimeMs);
  const s = stats(parseTimes);

  if (s.cv > CV_THRESHOLD) {
    console.warn(`    ⚠ CV=${(s.cv * 100).toFixed(1)}% > ${CV_THRESHOLD * 100}% for ${moduleId} ${variant} size=${payloadSize}`);
  }

  return {
    module: moduleId,
    variant,
    payloadSize,
    trials: accepted,
    ...s,
  };
}

export function generateJsonPayload(sizeBytes: number, nested: boolean = false): string {
  // Generate a JSON payload of approximately the target size
  const itemSize = nested ? 200 : 100; // bytes per item
  const itemCount = Math.max(1, Math.floor(sizeBytes / itemSize));

  if (nested) {
    // Nested structure: { users: [{ id, name, posts: [{ id, title, comments: [...] }] }] }
    const users = [];
    for (let i = 0; i < Math.min(itemCount, 100); i++) {
      users.push({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        posts: Array.from({ length: 10 }, (_, j) => ({
          id: i * 10 + j,
          title: `Post ${i}-${j}`,
          body: 'x'.repeat(50),
          comments: Array.from({ length: 5 }, (_, k) => ({
            id: i * 100 + j * 10 + k,
            text: 'Comment text '.repeat(5),
            author: `Commenter ${k}`,
          })),
        })),
      });
    }
    return JSON.stringify({ users, total: itemCount, page: 1 });
  } else {
    // Flat structure: { items: [{ id, name, value }] }
    const items = [];
    for (let i = 0; i < itemCount; i++) {
      items.push({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
        description: 'x'.repeat(50),
        tags: ['tag1', 'tag2', 'tag3'],
        createdAt: new Date().toISOString(),
      });
    }
    return JSON.stringify({ items, total: itemCount, page: 1, pageSize: itemCount });
  }
}

export function measureParseTime(jsonString: string): { parseTimeMs: number; rssDeltaMb: number } {
  const beforeRss = process.memoryUsage().rss;
  const start = performance.now();

  JSON.parse(jsonString);

  const end = performance.now();
  const afterRss = process.memoryUsage().rss;

  return {
    parseTimeMs: end - start,
    rssDeltaMb: (afterRss - beforeRss) / (1024 * 1024),
  };
}
