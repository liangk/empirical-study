import { createTrackedPrisma, benchmark, printResult } from "./utils";
import { tc1Bad } from "./tc1-simple-one-to-many";
import { tc2Bad } from "./tc2-nested-relationships";
import { tc3Bad } from "./tc3-prisma-specific";
import { tc4Bad } from "./tc4-conditional-loading";

async function main() {
  console.log("Running BAD (N+1) code benchmarks only...\n");
  const tracked = createTrackedPrisma();

  const results = [
    await benchmark("TC1: Simple One-to-Many", "bad", () => tc1Bad(tracked.prisma), tracked),
    await benchmark("TC2: Nested Relationships", "bad", () => tc2Bad(tracked.prisma), tracked),
    await benchmark("TC3: Prisma Orders->User", "bad", () => tc3Bad(tracked.prisma), tracked),
    await benchmark("TC4: Conditional Loading", "bad", () => tc4Bad(tracked.prisma), tracked),
  ];

  results.forEach(printResult);
  await tracked.prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
