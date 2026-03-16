import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-05: Timer/Interval Leak
 *
 * Creates setInterval timers with 4KB closure buffers without clearing them.
 * Leaky pattern: never clearInterval — timer + buffer never GC'd.
 * Proper pattern: clearInterval after use.
 */

const leakedTimers: NodeJS.Timeout[] = [];

function processBuffer(_buf: Buffer): void {
  // Simulate work — prevents dead-code elimination
  void _buf[0];
}

export const bm05: LeakBenchmarkModule = {
  id: 'BM-05',
  name: 'Timer/Interval Leak',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> { /* no-op */ },

  async teardown(): Promise<void> {
    await this.reset();
  },

  async runLeaky(_iteration: number): Promise<number> {
    const buffer = Buffer.alloc(4096, 0x42); // 4KB captured in closure
    const id = setInterval(() => {
      processBuffer(buffer);
    }, 60_000); // Long interval — won't fire during benchmark, but timer + closure retained
    leakedTimers.push(id);
    // Missing: clearInterval(id)
    return leakedTimers.length;
  },

  async runProper(_iteration: number): Promise<number> {
    const buffer = Buffer.alloc(4096, 0x42);
    const id = setInterval(() => {
      processBuffer(buffer);
    }, 60_000);
    // Proper cleanup
    clearInterval(id);
    return 0;
  },

  async reset(): Promise<void> {
    for (const id of leakedTimers) {
      clearInterval(id);
    }
    leakedTimers.length = 0;
  },
};
