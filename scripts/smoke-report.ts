// End-to-end report smoke: enqueue the pg-boss job, wait for the worker to render the PDF.
// Prereq: app fixtures created (scripts/report-fixtures.ts) AND `npm run worker` running.
// Usage: npx tsx scripts/smoke-report.ts
import { PrismaClient } from "@prisma/client";
import { getBoss } from "../src/server/reporting/producer";
import { readFile } from "../src/lib/storage";

const prisma = new PrismaClient();
const TIMEOUT_MS = 120_000;

async function main() {
  const report = await prisma.report.findFirst({ orderBy: { createdAt: "asc" }, include: { findings: true } });
  if (!report) {
    console.error("No report fixture — run scripts/report-fixtures.ts first");
    process.exit(1);
  }
  console.log(`report=${report.id} findings=${report.findings.length}`);

  const boss = await getBoss();
  await prisma.report.update({ where: { id: report.id }, data: { status: "queued" } });
  await boss.send("report-generate", { reportId: report.id }, { retryLimit: 1, retryDelay: 3 });
  console.log("queued — waiting for worker…");

  const start = Date.now();
  let status = report.status;
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 2000));
    const fresh = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    status = fresh.status;
    if (status === "generated" || status === "failed") break;
  }

  if (status !== "generated") {
    console.error(`SMOKE FAILED — final status: ${status}`);
    process.exit(1);
  }

  const fresh = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
  const pdf = fresh.filePath ? readFile(fresh.filePath) : null;
  if (!pdf || pdf.length < 1000) {
    console.error("SMOKE FAILED — PDF file missing or suspiciously small");
    process.exit(1);
  }
  console.log(`SMOKE OK — PDF ${pdf.length} bytes (${fresh.filePath})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
