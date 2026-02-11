import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
  ],
});

export default prisma;
