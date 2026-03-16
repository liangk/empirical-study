import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-03: Stream Leak on Error Path
 *
 * Creates a ReadStream without destroying it on error/end.
 * Leaky pattern: no error handler, no destroy — FD + memory leak.
 * Proper pattern: stream.on('error', () => stream.destroy()).
 */

const TEST_FILE = path.join(os.tmpdir(), 'bm03-stream-test.bin');
const leakedStreams: fs.ReadStream[] = [];

export const bm03: LeakBenchmarkModule = {
  id: 'BM-03',
  name: 'Stream Leak on Error Path',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> {
    // Create a 64KB test file
    fs.writeFileSync(TEST_FILE, Buffer.alloc(65536, 0x41));
  },

  async teardown(): Promise<void> {
    await this.reset();
    try { fs.unlinkSync(TEST_FILE); } catch { /* ok */ }
  },

  async runLeaky(_iteration: number): Promise<number> {
    return new Promise((resolve) => {
      const stream = fs.createReadStream(TEST_FILE);
      leakedStreams.push(stream);
      let bytes = 0;
      stream.on('data', (chunk: Buffer | string) => { bytes += chunk.length; });
      // Missing: stream.on('error', ...) and stream.on('end', () => stream.destroy())
      // Stream stays open, FD leaked
      stream.on('end', () => {
        // Do NOT call stream.destroy() — intentional leak
        resolve(leakedStreams.length);
      });
    });
  },

  async runProper(_iteration: number): Promise<number> {
    return new Promise((resolve) => {
      const stream = fs.createReadStream(TEST_FILE);
      let bytes = 0;
      stream.on('data', (chunk: Buffer | string) => { bytes += chunk.length; });
      stream.on('error', () => stream.destroy());
      stream.on('end', () => {
        stream.destroy();
        resolve(0);
      });
    });
  },

  async reset(): Promise<void> {
    for (const s of leakedStreams) {
      try { s.destroy(); } catch { /* ok */ }
    }
    leakedStreams.length = 0;
  },
};
