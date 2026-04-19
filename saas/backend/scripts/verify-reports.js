/**
 * Dev helper: print the latest Report row from Postgres (requires DATABASE_URL in .env).
 * Usage: npm run verify:reports
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  if (reports.length > 0) {
    console.log("\n\n✅ Latest report:\n" + reports[0].markdownBody);
  } else {
    console.log("❌ No reports found in Postgres yet");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
