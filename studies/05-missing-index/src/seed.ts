import { getClient, disconnect } from './step1-benchmarks/harness/db';
import { generateUsers, generateOrders } from './step1-benchmarks/harness/data-gen';

const BATCH_SIZE = 10_000;

async function seed(targetN: number): Promise<void> {
  const db = getClient();
  const userCount = Math.ceil(targetN / 10); // ~10 orders per user

  console.log(`Seeding ${targetN.toLocaleString()} orders + ${userCount.toLocaleString()} users...`);
  console.log(`Batch size: ${BATCH_SIZE.toLocaleString()}`);

  // Clear existing data
  console.log('Truncating tables...');
  await db.$executeRawUnsafe('TRUNCATE bench_orders RESTART IDENTITY CASCADE');
  await db.$executeRawUnsafe('TRUNCATE bench_users RESTART IDENTITY CASCADE');

  // Drop any stale indexes from previous benchmark runs
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT indexname FROM pg_indexes WHERE tablename IN ('bench_users','bench_orders') AND indexname LIKE 'idx_bm%'
      LOOP EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname; END LOOP;
    END $$;
  `);

  // Seed users in batches
  console.log('Inserting users...');
  const users = generateUsers(userCount);
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await db.benchUser.createMany({ data: batch });
    process.stdout.write(`  users: ${Math.min(i + BATCH_SIZE, users.length).toLocaleString()}/${userCount.toLocaleString()}\r`);
  }
  console.log(`\n  Done: ${userCount.toLocaleString()} users inserted.`);

  // Seed orders in batches
  console.log('Inserting orders...');
  const orders = generateOrders(targetN, userCount);
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    await db.benchOrder.createMany({ data: batch });
    process.stdout.write(`  orders: ${Math.min(i + BATCH_SIZE, orders.length).toLocaleString()}/${targetN.toLocaleString()}\r`);
  }
  console.log(`\n  Done: ${targetN.toLocaleString()} orders inserted.`);

  // Update PostgreSQL statistics
  console.log('Running VACUUM ANALYZE...');
  await db.$executeRawUnsafe('VACUUM ANALYZE bench_users, bench_orders');
  console.log('Done.');
}

// Parse --n flag or default to 1,000,000
const args = process.argv.slice(2);
const nFlagIdx = args.indexOf('--n');
const targetN = nFlagIdx >= 0 ? parseInt(args[nFlagIdx + 1], 10) : 1_000_000;

if (isNaN(targetN) || targetN < 1) {
  console.error('Usage: npm run seed:n <number>  (e.g. npm run seed:n 100000)');
  process.exit(1);
}

seed(targetN)
  .then(() => disconnect())
  .catch(err => { console.error(err); process.exit(1); });
