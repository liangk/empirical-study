import { createTrackedPrisma, benchmark, printResult } from "./utils";
import { tc1Good } from "./tc1-simple-one-to-many";
import { tc2Good } from "./tc2-nested-relationships";
import { tc3Good } from "./tc3-prisma-specific";
import { tc4Good } from "./tc4-conditional-loading";

async function main() {
  console.log("Running GOOD (optimized) code benchmarks only...\n");
  const tracked = createTrackedPrisma();

  const results = [
    await benchmark("TC1: Simple One-to-Many", "good", () => tc1Good(tracked.prisma), tracked),
    await benchmark("TC2: Nested Relationships", "good", () => tc2Good(tracked.prisma), tracked),
    await benchmark("TC3: Prisma Orders->User", "good", () => tc3Good(tracked.prisma), tracked),
    await benchmark("TC4: Conditional Loading", "good", () => tc4Good(tracked.prisma), tracked),
  ];

  results.forEach(printResult);
  await tracked.prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
