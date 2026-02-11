import { printResult, printComparison, BenchmarkResult } from "./utils";
import { runTC1 } from "./tc1-simple-one-to-many";
import { runTC2 } from "./tc2-nested-relationships";
import { runTC3 } from "./tc3-prisma-specific";
import { runTC4 } from "./tc4-conditional-loading";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   N+1 Query Empirical Study — Full Benchmark    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const allResults: { bad: BenchmarkResult; good: BenchmarkResult }[] = [];

  // TC1: Simple One-to-Many
  console.log("\n▶ Running TC1: Simple One-to-Many (Users → Posts)...");
  const tc1 = await runTC1();
  printResult(tc1.bad);
  printResult(tc1.good);
  printComparison(tc1.bad, tc1.good);
  allResults.push(tc1);

  // TC2: Nested Relationships
  console.log("\n▶ Running TC2: Nested Relationships (Users → Posts → Comments)...");
  const tc2 = await runTC2();
  printResult(tc2.bad);
  printResult(tc2.good);
  printComparison(tc2.bad, tc2.good);
  allResults.push(tc2);

  // TC3: Prisma-Specific
  console.log("\n▶ Running TC3: Prisma Orders → User...");
  const tc3 = await runTC3();
  printResult(tc3.bad);
  printResult(tc3.good);
  printComparison(tc3.bad, tc3.good);
  allResults.push(tc3);

  // TC4: Conditional Loading
  console.log("\n▶ Running TC4: Conditional Loading (Active Orders)...");
  const tc4 = await runTC4();
  printResult(tc4.bad);
  printResult(tc4.good);
  printComparison(tc4.bad, tc4.good);
  allResults.push(tc4);

  // Summary table
  console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                              SUMMARY TABLE                                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════════════╝");
  console.log(
    "Test Case".padEnd(30) +
    "Dataset".padEnd(10) +
    "Bad Queries".padEnd(14) +
    "Good Queries".padEnd(14) +
    "Reduction".padEnd(12) +
    "Bad Time".padEnd(12) +
    "Good Time".padEnd(12) +
    "Speedup"
  );
  console.log("-".repeat(104));

  for (const { bad, good } of allResults) {
    const queryReduction = ((bad.queryCount - good.queryCount) / bad.queryCount * 100).toFixed(1);
    const speedup = (bad.avgMs / good.avgMs).toFixed(1);
    console.log(
      bad.testCase.padEnd(30) +
      String(bad.datasetSize).padEnd(10) +
      String(bad.queryCount).padEnd(14) +
      String(good.queryCount).padEnd(14) +
      `${queryReduction}%`.padEnd(12) +
      `${bad.avgMs}ms`.padEnd(12) +
      `${good.avgMs}ms`.padEnd(12) +
      `${speedup}x`
    );
  }

  // Save results to JSON
  const resultsDir = path.join(__dirname, "../../results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsFile = path.join(resultsDir, `benchmark-${timestamp}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  console.log(`\nResults saved to: ${resultsFile}`);
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
