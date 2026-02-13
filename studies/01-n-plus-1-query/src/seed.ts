import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const DATASET_SIZES = {
  small: 100,
  medium: 1_000,
  large: 10_000,
  xlarge: 100_000,
};

async function clearDatabase() {
  console.log("Clearing existing data...");
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  console.log("Database cleared.");
}

async function seedUsers(count: number): Promise<number[]> {
  console.log(`Seeding ${count} users...`);
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      email: faker.internet.email({ provider: `test${i}.com` }),
      name: faker.person.fullName(),
    });
  }

  // Batch insert in chunks of 1000
  const chunkSize = 1000;
  for (let i = 0; i < users.length; i += chunkSize) {
    await prisma.user.createMany({ data: users.slice(i, i + chunkSize) });
  }

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  return allUsers.map((u) => u.id);
}

async function seedPosts(userIds: number[], postsPerUser: number): Promise<number[]> {
  const totalPosts = userIds.length * postsPerUser;
  console.log(`Seeding ${totalPosts} posts (${postsPerUser} per user)...`);

  const posts = [];
  for (const userId of userIds) {
    for (let i = 0; i < postsPerUser; i++) {
      posts.push({
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(2),
        published: faker.datatype.boolean(),
        userId,
      });
    }
  }

  const chunkSize = 1000;
  for (let i = 0; i < posts.length; i += chunkSize) {
    await prisma.post.createMany({ data: posts.slice(i, i + chunkSize) });
  }

  const allPosts = await prisma.post.findMany({ select: { id: true } });
  return allPosts.map((p) => p.id);
}

async function seedComments(postIds: number[], commentsPerPost: number) {
  const totalComments = postIds.length * commentsPerPost;
  console.log(`Seeding ${totalComments} comments (${commentsPerPost} per post)...`);

  const chunkSize = 1000;
  let buffer: { text: string; postId: number }[] = [];

  for (const postId of postIds) {
    for (let i = 0; i < commentsPerPost; i++) {
      buffer.push({
        text: faker.lorem.sentence(),
        postId,
      });
      if (buffer.length >= chunkSize) {
        await prisma.comment.createMany({ data: buffer });
        buffer = [];
      }
    }
  }
  if (buffer.length > 0) {
    await prisma.comment.createMany({ data: buffer });
  }
}

async function seedOrders(userIds: number[], ordersPerUser: number) {
  const totalOrders = userIds.length * ordersPerUser;
  console.log(`Seeding ${totalOrders} orders (${ordersPerUser} per user)...`);

  const statuses = ["active", "completed", "cancelled"];
  const orders = [];

  for (const userId of userIds) {
    for (let i = 0; i < ordersPerUser; i++) {
      orders.push({
        total: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        requiresUserData: Math.random() > 0.3,
        userId,
      });
    }
  }

  const chunkSize = 1000;
  for (let i = 0; i < orders.length; i += chunkSize) {
    await prisma.order.createMany({ data: orders.slice(i, i + chunkSize) });
  }
}

async function main() {
  const sizeArg = process.argv[2] || "small";
  const size = DATASET_SIZES[sizeArg as keyof typeof DATASET_SIZES];

  if (!size) {
    console.error(`Invalid size: ${sizeArg}. Use: small, medium, large, xlarge`);
    process.exit(1);
  }

  console.log(`\n=== Seeding database with ${size} users (${sizeArg}) ===\n`);
  const start = Date.now();

  await clearDatabase();

  const userIds = await seedUsers(size);
  const postIds = await seedPosts(userIds, 3);   // 3 posts per user
  await seedComments(postIds, 2);                 // 2 comments per post
  await seedOrders(userIds, 2);                   // 2 orders per user

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const counts = {
    users: await prisma.user.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    orders: await prisma.order.count(),
  };

  console.log(`\n=== Seeding complete in ${elapsed}s ===`);
  console.log(`Users:    ${counts.users}`);
  console.log(`Posts:    ${counts.posts}`);
  console.log(`Comments: ${counts.comments}`);
  console.log(`Orders:   ${counts.orders}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
