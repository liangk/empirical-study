import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LeakBenchmarkModule } from '../../harness/types';

/**
 * BM-02: File Descriptor Exhaustion (EMFILE)
 *
 * Opens file handles via fs.promises.open() without closing them.
 * Leaky pattern: accumulate open FDs until EMFILE.
 * Proper pattern: close each handle in a finally block.
 */

const TEST_FILE = path.join(os.tmpdir(), 'bm02-test-file.bin');
const openHandles: fs.promises.FileHandle[] = [];

export const bm02: LeakBenchmarkModule = {
  id: 'BM-02',
  name: 'File Descriptor Exhaustion (EMFILE)',
  nValues: [10, 50, 100, 500, 1000],

  async setup(): Promise<void> {
    // Create a small test file
    fs.writeFileSync(TEST_FILE, Buffer.alloc(1024, 0x42));
  },

  async teardown(): Promise<void> {
    await this.reset();
    try { fs.unlinkSync(TEST_FILE); } catch { /* ok */ }
  },

  async runLeaky(_iteration: number): Promise<number> {
    // Open file, read a byte, do NOT close
    const fh = await fs.promises.open(TEST_FILE, 'r');
    const buf = Buffer.alloc(1);
    await fh.read(buf, 0, 1, 0);
    openHandles.push(fh);
    // Missing: await fh.close()
    return openHandles.length;
  },

  async runProper(_iteration: number): Promise<number> {
    // Open file, read a byte, close in finally
    const fh = await fs.promises.open(TEST_FILE, 'r');
    try {
      const buf = Buffer.alloc(1);
      await fh.read(buf, 0, 1, 0);
    } finally {
      await fh.close();
    }
    return 0; // No leaked handles
  },

  async reset(): Promise<void> {
    for (const fh of openHandles) {
      try { await fh.close(); } catch { /* already closed */ }
    }
    openHandles.length = 0;
  },
};
