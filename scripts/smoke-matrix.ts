// Sprint 3 smoke: timeline entries → mock correlation → gap → full rule-request lifecycle.
// Usage: npx tsx --env-file=.env scripts/smoke-matrix.ts
import { PrismaClient } from "@prisma/client";
import { mockCorrelate } from "../src/lib/mock-sentinel";
import { canTransition, type RuleStatus } from "../src/lib/rule-lifecycle";

const db = new PrismaClient();

async function transition(db2: PrismaClient, id: string, to: RuleStatus) {
  const rr = await db2.ruleRequest.findUniqueOrThrow({ where: { id } });
  const via = canTransition(rr.status as RuleStatus, to);
  if (!via) throw new Error(`illegal ${rr.status} -> ${to}`);
  const now = new Date();
  await db2.ruleRequest.update({
    where: { id },
    data: {
      status: to,
      requestedAt: to === "pending_review" ? now : undefined,
      approvedBy: to === "approved" ? "sentinel-sim" : undefined,
      approvedAt: to === "approved" ? now : undefined,
      deployedAt: to === "deployed" ? now : undefined,
      verifiedAt: to === "verified" ? now : undefined,
    },
  });
  console.log(`  ${via}: → ${to}`);
}

async function main() {
  const project = await db.project.findFirst({ where: { code: "ENG-SMK" } });
  if (!project) {
    console.error("Run report fixtures first (ENG-SMK missing)");
    process.exit(1);
  }
  const user = await db.user.findFirstOrThrow();

  // pick techniques deterministically: two guaranteed gaps + one clean detection
  const candidates: { id: string; v: ReturnType<typeof mockCorrelate>["verdict"] }[] = [];
  for (let i = 1000; i < 1200 && candidates.filter((c) => c.v === "not_detected").length < 2; i++) {
    const id = `T${i}.001`;
    const { verdict } = mockCorrelate(id, new Date());
    if (verdict === "not_detected" || candidates.length === 0) candidates.push({ id, v: verdict });
  }
  let clean = "T9999";
  while (mockCorrelate(clean, new Date()).verdict !== "detected") clean = `T${Math.floor(Math.random() * 9999)}`;
  const techniques = [candidates[0].id, candidates[1]?.id ?? "T1999", clean];
  let created = 0;
  for (const techniqueId of techniques) {
    const exists = await db.timelineEntry.findFirst({ where: { projectId: project.id, techniqueId } });
    if (exists) continue;
    const ts = new Date();
    const entry = await db.timelineEntry.create({
      data: {
        projectId: project.id,
        techniqueId,
        tactic: "credential-access",
        timestamp: ts,
        actionDescription: `Smoke test of ${techniqueId}`,
        outcome: "success",
        operatorId: user.id,
        command: `smoke --technique ${techniqueId}`,
      },
    });
    const { verdict, alert } = mockCorrelate(techniqueId, ts);
    await db.detectionVerdict.create({
      data: {
        timelineEntryId: entry.id,
        verdict: verdict as never,
        matchedAlertId: alert?.alertId,
        detectionDelaySeconds: alert?.delaySeconds,
      },
    });
    created++;
    console.log(`entry ${techniqueId} → ${verdict}${alert ? ` (${alert.alertId})` : ""}`);
  }

  // gap computation mirrors /attack-matrix
  const entries = await db.timelineEntry.findMany({
    where: { projectId: project.id, outcome: "success", techniqueId: { not: null } },
    orderBy: { timestamp: "desc" },
    include: { verdict: true },
  });
  const latest = new Map<string, string>();
  for (const e of entries) if (!latest.has(e.techniqueId!)) latest.set(e.techniqueId!, e.verdict!.verdict);
  const gaps = [...latest.entries()].filter(([, v]) => ["not_detected", "partial"].includes(v));
  console.log(`gaps: ${gaps.map(([t]) => t).join(", ") || "none"}`);
  if (gaps.length === 0) {
    console.error("SMOKE FAILED — no gaps produced");
    process.exit(1);
  }

  // full lifecycle on first gap
  const [gapTechnique] = gaps[0];
  let rr = await db.ruleRequest.findFirst({ where: { techniqueId: gapTechnique, status: "draft" } });
  if (!rr) {
    rr = await db.ruleRequest.create({
      data: {
        projectId: project.id,
        techniqueId: gapTechnique,
        draftRuleXml: `<rule>smoke ${gapTechnique}</rule>`,
        justification: "Smoke gap closure",
        requestedById: user.id,
      },
    });
  }
  await transition(db, rr.id, "pending_review");
  await transition(db, rr.id, "approved");
  await transition(db, rr.id, "deployed");
  await transition(db, rr.id, "verified");

  const final = await db.ruleRequest.findUniqueOrThrow({ where: { id: rr.id } });
  if (final.status !== "verified") {
    console.error("SMOKE FAILED — lifecycle did not reach verified");
    process.exit(1);
  }
  console.log(`SMOKE OK — ${created} entries correlated, gap ${gapTechnique} closed end-to-end`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
