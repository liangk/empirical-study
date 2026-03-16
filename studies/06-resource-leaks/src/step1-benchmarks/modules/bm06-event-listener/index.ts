import { EventEmitter } from 'events';
import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-06: Event Listener Accumulation
 *
 * Adds event listeners with 4KB closures to a shared EventEmitter without removing them.
 * Leaky pattern: emitter.on('data', handler) — never removeListener.
 * Proper pattern: emitter.off('data', handler) after use.
 *
 * Triggers MaxListenersExceededWarning at 11 listeners (default), grows heap linearly.
 */

let emitter: EventEmitter;

function processBuffer(_buf: Buffer): void {
  void _buf[0];
}

export const bm06: LeakBenchmarkModule = {
  id: 'BM-06',
  name: 'Event Listener Accumulation',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> {
    emitter = new EventEmitter();
    // Suppress MaxListenersExceededWarning for controlled measurement
    emitter.setMaxListeners(0);
  },

  async teardown(): Promise<void> {
    await this.reset();
  },

  async runLeaky(_iteration: number): Promise<number> {
    const buffer = Buffer.alloc(4096, 0x42); // 4KB closure
    emitter.on('data', () => {
      processBuffer(buffer);
    });
    // Missing: emitter.off('data', handler)
    return emitter.listenerCount('data');
  },

  async runProper(_iteration: number): Promise<number> {
    const buffer = Buffer.alloc(4096, 0x42);
    const handler = () => { processBuffer(buffer); };
    emitter.on('data', handler);
    // Proper cleanup
    emitter.off('data', handler);
    return emitter.listenerCount('data');
  },

  async reset(): Promise<void> {
    if (emitter) emitter.removeAllListeners('data');
  },
};
