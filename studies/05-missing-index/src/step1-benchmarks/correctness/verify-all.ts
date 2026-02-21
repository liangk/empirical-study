import { bm01 } from '../modules/bm01-lookup/baseline';
import { bm02 } from '../modules/bm02-sort/baseline';
import { bm03 } from '../modules/bm03-fk-scan/baseline';
import { bm04 } from '../modules/bm04-composite/baseline';
import { bm05 } from '../modules/bm05-covering/baseline';
import { disconnect } from '../harness/db';
import { BenchmarkModule } from '../harness/types';

const VERIFY_N = 1_000;
const MODULES: BenchmarkModule[] = [bm01, bm02, bm03, bm04, bm05];

async function verifyAll(): Promise<void> {
  console.log('=== Correctness Gate: Study 05 ===\n');
  let allPassed = true;

  for (const mod of MODULES) {
    process.stdout.write(`Verifying ${mod.id} (${mod.name})... `);
    try {
      // Set up baseline state if required
      if (mod.setupBaseline) await mod.setupBaseline();

      const ok = await mod.verify(VERIFY_N);
      if (ok) {
        console.log('PASS');
      } else {
        console.log('FAIL — baseline and optimized returned different rows');
        allPassed = false;
      }
    } catch (err) {
      console.log(`ERROR — ${(err as Error).message}`);
      allPassed = false;
    }
  }

  console.log(`\n${allPassed ? '✓ All modules passed' : '✗ Some modules failed — fix before benchmarking'}`);
  await disconnect();
  process.exit(allPassed ? 0 : 1);
}

verifyAll().catch(err => { console.error(err); process.exit(1); });
