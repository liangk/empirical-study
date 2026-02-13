/**
 * TC4: Conditional Loading — Active orders with user data (only when needed)
 *
 * BAD:  Fetches active orders, then conditionally fetches user per order (N+1)
 * GOOD: Batch pre-fetches all needed users with a single query, then maps
 */
import { createTrackedPrisma, benchmark, BenchmarkResult } from "./utils";

// ---- BAD CODE: Conditional N+1 ----
export async function tc4Bad(prisma: any): Promise<any[]> {
  const orders = await prisma.order.findMany({
    where: { status: "active" },
  });
  for (const order of orders) {
    if (order.requiresUserData) {
      order.user = await prisma.user.findUnique({
        where: { id: order.userId },
      });
    }
  }
  return orders;
}

// ---- GOOD CODE: Batch query before loop ----
export async function tc4Good(prisma: any): Promise<any[]> {
  const orders = await prisma.order.findMany({
    where: { status: "active" },
  });

  // Collect unique user IDs that need user data
  const userIdsNeeded = [
    ...new Set(
      orders
        .filter((o: any) => o.requiresUserData)
        .map((o: any) => o.userId)
    ),
  ] as number[];

  // Single batch query for all needed users
  const users = await prisma.user.findMany({
    where: { id: { in: userIdsNeeded } },
  });
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  // Map users to orders
  for (const order of orders) {
    if (order.requiresUserData) {
      order.user = userMap.get(order.userId) || null;
    }
  }
  return orders;
}

// ---- Runner ----
export async function runTC4(): Promise<{ bad: BenchmarkResult; good: BenchmarkResult }> {
  const tracked = createTrackedPrisma();

  const bad = await benchmark("TC4: Conditional Loading", "bad", () => tc4Bad(tracked.prisma), tracked);
  const good = await benchmark("TC4: Conditional Loading", "good", () => tc4Good(tracked.prisma), tracked);

  await tracked.prisma.$disconnect();
  return { bad, good };
}
