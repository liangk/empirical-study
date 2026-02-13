/**
 * TC1: Simple One-to-Many — Users with Posts
 *
 * BAD:  Fetches all users, then loops to fetch each user's posts (N+1)
 * GOOD: Uses Prisma `include` for eager loading (1 query)
 */
import { createTrackedPrisma, benchmark, BenchmarkResult } from "./utils";

// ---- BAD CODE: N+1 pattern ----
export async function tc1Bad(prisma: any): Promise<any[]> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    user.posts = await prisma.post.findMany({
      where: { userId: user.id },
    });
  }
  return users;
}

// ---- GOOD CODE: Eager loading with include ----
export async function tc1Good(prisma: any): Promise<any[]> {
  const users = await prisma.user.findMany({
    include: { posts: true },
  });
  return users;
}

// ---- Runner ----
export async function runTC1(): Promise<{ bad: BenchmarkResult; good: BenchmarkResult }> {
  const tracked = createTrackedPrisma();

  const bad = await benchmark("TC1: Simple One-to-Many", "bad", () => tc1Bad(tracked.prisma), tracked);
  const good = await benchmark("TC1: Simple One-to-Many", "good", () => tc1Good(tracked.prisma), tracked);

  await tracked.prisma.$disconnect();
  return { bad, good };
}
