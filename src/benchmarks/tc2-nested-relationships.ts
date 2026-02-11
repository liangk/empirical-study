/**
 * TC2: Nested Relationships — Users -> Posts -> Comments
 *
 * BAD:  Nested loops fetching posts per user, then comments per post (N*M+N+1)
 * GOOD: Uses Prisma nested `include` for eager loading
 */
import { createTrackedPrisma, benchmark, BenchmarkResult } from "./utils";

// ---- BAD CODE: Nested N+1 ----
export async function tc2Bad(prisma: any): Promise<any[]> {
  const users = await prisma.user.findMany();
  for (const user of users) {
    user.posts = await prisma.post.findMany({
      where: { userId: user.id },
    });
    for (const post of user.posts) {
      post.comments = await prisma.comment.findMany({
        where: { postId: post.id },
      });
    }
  }
  return users;
}

// ---- GOOD CODE: Nested include ----
export async function tc2Good(prisma: any): Promise<any[]> {
  const users = await prisma.user.findMany({
    include: {
      posts: {
        include: { comments: true },
      },
    },
  });
  return users;
}

// ---- Runner ----
export async function runTC2(): Promise<{ bad: BenchmarkResult; good: BenchmarkResult }> {
  const tracked = createTrackedPrisma();

  const bad = await benchmark("TC2: Nested Relationships", "bad", () => tc2Bad(tracked.prisma), tracked);
  const good = await benchmark("TC2: Nested Relationships", "good", () => tc2Good(tracked.prisma), tracked);

  await tracked.prisma.$disconnect();
  return { bad, good };
}
