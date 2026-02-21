import { faker } from '@faker-js/faker';

export interface UserRow {
  email: string;
  name: string;
  status: string;
  createdAt: Date;
}

export interface OrderRow {
  userId: number;
  amount: number;
  status: string;
  category: string;
  createdAt: Date;
}

const USER_STATUSES = ['active', 'active', 'active', 'active', 'active', 'active', 'inactive', 'inactive', 'inactive', 'suspended'];
const ORDER_STATUSES = ['pending', 'active', 'completed', 'cancelled'];
const CATEGORIES = ['electronics', 'clothing', 'food', 'books', 'tools'];

const EPOCH_START = new Date('2023-01-01').getTime();
const EPOCH_END = new Date('2025-01-01').getTime();

function randomDate(seed: number): Date {
  const range = EPOCH_END - EPOCH_START;
  const offset = ((seed * 2654435761) >>> 0) % range;
  return new Date(EPOCH_START + offset);
}

/**
 * Generate n unique UserRow objects.
 * Fixed seed for reproducibility.
 */
export function generateUsers(n: number, seed = 0xBEEF01): UserRow[] {
  faker.seed(seed);
  return Array.from({ length: n }, (_, i) => ({
    email: `user${i + 1}@benchmark.test`,
    name: faker.person.fullName(),
    status: USER_STATUSES[i % USER_STATUSES.length],
    createdAt: randomDate(seed + i),
  }));
}

/**
 * Generate n OrderRow objects where userId is drawn from 1..(userCount).
 * Each user gets approximately n/userCount orders on average.
 */
export function generateOrders(n: number, userCount: number, seed = 0xBEEF03): OrderRow[] {
  faker.seed(seed);
  return Array.from({ length: n }, (_, i) => ({
    userId: (i % userCount) + 1,
    amount: Math.round(faker.number.float({ min: 1, max: 9999 }) * 100) / 100,
    status: ORDER_STATUSES[i % ORDER_STATUSES.length],
    category: CATEGORIES[i % CATEGORIES.length],
    createdAt: randomDate(seed + i),
  }));
}

/**
 * Pick a query target email from the middle of a seeded user set.
 * "Middle" ensures worst-case for sequential scan (avoids early exit).
 */
export function pickTargetEmail(n: number): string {
  return `user${Math.floor(n / 2)}@benchmark.test`;
}

/**
 * Pick a userId that exists and has orders (always returns userCount/2).
 */
export function pickTargetUserId(userCount: number): number {
  return Math.floor(userCount / 2);
}

/**
 * The createdAt cutoff used for BM-02 and BM-04 range queries.
 * Returns a date 90 days before the epoch end — captures ~12% of the 2-year window.
 */
export function rangeQueryCutoff(): Date {
  return new Date(EPOCH_END - 90 * 24 * 60 * 60 * 1000);
}
