import PgBoss from "pg-boss";

let producer: PgBoss | null = null;

/** App-side pg-boss connection (send-only). The worker owns consumption. */
export async function getBoss(): Promise<PgBoss> {
  if (!producer) {
    producer = new PgBoss(process.env.DATABASE_URL ?? "");
    await producer.start();
    // pg-boss v10: queues are explicit
    await producer.createQueue("report-generate");
    await producer.createQueue("note-embed");
  }
  return producer;
}

export async function enqueueReportGeneration(reportId: string): Promise<string> {
  const boss = await getBoss();
  const jobId = await boss.send("report-generate", { reportId }, { retryLimit: 2, retryDelay: 5 });
  if (!jobId) throw new Error("Failed to enqueue report generation");
  return jobId;
}

export async function enqueueNoteEmbedding(noteId: string): Promise<void> {
  const boss = await getBoss();
  // coalesce rapid edits: replace any pending job for the same note
  await boss.send("note-embed", { noteId }, { retryLimit: 2, retryDelay: 5, singletonKey: noteId });
}
