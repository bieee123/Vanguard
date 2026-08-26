import PgBoss from "pg-boss";

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL ?? "");
  boss.on("error", (err) => console.error("pg-boss error:", err));
  await boss.start();
  await boss.createQueue("report-generate");
  console.log("[worker] pg-boss ready");

  await boss.work<{ reportId: string }>("report-generate", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] generating report ${job.data.reportId}`);
      // lazy import so pg-boss starts even if playwright is missing at boot
      const { generateReportPdf } = await import("../src/server/reporting/generator");
      try {
        await generateReportPdf(job.data.reportId);
        console.log(`[worker] report ${job.data.reportId} done`);
      } catch (err) {
        console.error(`[worker] report ${job.data.reportId} failed:`, err);
        throw err; // let pg-boss retry per job options
      }
    }
  });

  await boss.work<{ noteId: string }>("note-embed", { batchSize: 5 }, async (jobs) => {
    const { embedNote } = await import("../src/server/kb/embedding");
    for (const job of jobs) {
      try {
        await embedNote(job.data.noteId);
      } catch (err) {
        console.error(`[worker] note-embed ${job.data.noteId} failed:`, err);
        throw err;
      }
    }
  });

  // keep process alive
  setInterval(() => {}, 1 << 30);
}

main();
