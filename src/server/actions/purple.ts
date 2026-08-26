"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { mockCorrelate } from "@/lib/mock-sentinel";
import { canTransition, type RuleStatus } from "@/lib/rule-lifecycle";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v ? new Date(v) : null;
}

// ── Timeline entries ─────────────────────────────────────────────────

export async function createTimelineEntry(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const actionDescription = str(fd, "actionDescription");
  if (!projectId || !actionDescription) throw new Error("Engagement and action are required");

  const timestamp = date(fd, "timestamp") ?? new Date();
  const techniqueId = str(fd, "techniqueId");
  // ponytail: tactic derived from the technique's first three letters of the id order —
  // a real tactic map arrives with the DeTT&CT import (Sprint 4)
  const entry = await prisma.timelineEntry.create({
    data: {
      projectId,
      assetId: str(fd, "assetId"),
      techniqueId,
      tactic: str(fd, "tactic"),
      timestamp,
      actionDescription,
      outcome: (str(fd, "outcome") ?? "success") as never,
      operatorId: user.id,
      note: str(fd, "note"),
      command: str(fd, "command"),
      technicalNotes: str(fd, "technicalNotes"),
    },
  });

  // auto-correlate against the mocked Sentinel (M7); real client lands in M12
  if (techniqueId) {
    const { verdict, alert } = mockCorrelate(techniqueId, timestamp);
    await prisma.detectionVerdict.create({
      data: {
        timelineEntryId: entry.id,
        verdict: verdict as never,
        matchedAlertId: alert?.alertId,
        detectionDelaySeconds: alert?.delaySeconds,
      },
    });
  }

  await audit({
    userId: user.id,
    action: "create",
    resourceType: "timeline_entry",
    resourceId: entry.id,
    details: { projectId, techniqueId, outcome: entry.outcome },
  });
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
  revalidatePath(`/engagements/${projectId}`);
}

export async function updateTimelineOutcome(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const outcome = str(fd, "outcome");
  if (!id || !outcome) throw new Error("Missing fields");
  await prisma.timelineEntry.update({ where: { id }, data: { outcome: outcome as never } });
  await audit({
    userId: user.id,
    action: "update_outcome",
    resourceType: "timeline_entry",
    resourceId: id,
    details: { after: outcome },
  });
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
}

export async function deleteTimelineEntry(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");
  const entry = await prisma.timelineEntry.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "timeline_entry",
    resourceId: id,
    details: { projectId: entry.projectId },
  });
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
  revalidatePath(`/engagements/${entry.projectId}`);
}

// ── Verdict confirmation / override ──────────────────────────────────

export async function confirmVerdict(fd: FormData) {
  const { user } = await requireUser();
  const timelineEntryId = str(fd, "timelineEntryId");
  const override = str(fd, "verdict"); // optional operator correction
  if (!timelineEntryId) throw new Error("Missing entry");

  const existing = await prisma.detectionVerdict.findUnique({ where: { timelineEntryId } });
  if (!existing) throw new Error("No verdict to confirm");

  await prisma.detectionVerdict.update({
    where: { timelineEntryId },
    data: {
      verdict: (override ?? existing.verdict) as never,
      confirmedByOperator: true,
      confirmedById: user.id,
      confirmedAt: new Date(),
    },
  });
  await audit({
    userId: user.id,
    action: "confirm_verdict",
    resourceType: "detection_verdict",
    resourceId: existing.id,
    details: { timelineEntryId, verdict: override ?? existing.verdict },
  });
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
}

export async function recorrelateVerdict(fd: FormData) {
  await requireUser();
  const timelineEntryId = str(fd, "timelineEntryId");
  if (!timelineEntryId) throw new Error("Missing entry");

  const entry = await prisma.timelineEntry.findUniqueOrThrow({ where: { id: timelineEntryId } });
  if (!entry.techniqueId) return;
  const { verdict, alert } = mockCorrelate(entry.techniqueId, entry.timestamp);
  await prisma.detectionVerdict.upsert({
    where: { timelineEntryId },
    update: { verdict: verdict as never, matchedAlertId: alert?.alertId, detectionDelaySeconds: alert?.delaySeconds },
    create: {
      timelineEntryId,
      verdict: verdict as never,
      matchedAlertId: alert?.alertId,
      detectionDelaySeconds: alert?.delaySeconds,
    },
  });
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
}

// ── Rule requests ────────────────────────────────────────────────────

function defaultRuleXml(techniqueId: string): string {
  return `<group name="vanguard,redteam">
  <rule id="9${Math.abs([...techniqueId].reduce((a, c) => a + c.charCodeAt(0), 0)) % 900000}" level="10">
    <decoded_as>json</decoded_as>
    <field name="attack.technique">^${techniqueId.replace(".", "\\.")}(_\\d+)?$</field>
    <description>Suspicious activity matching ATT&amp;CK ${techniqueId}</description>
  </rule>
</group>`;
}

export async function createRuleRequest(fd: FormData) {
  const { user } = await requireUser();
  const techniqueId = str(fd, "techniqueId");
  if (!techniqueId) throw new Error("Technique is required");

  const rr = await prisma.ruleRequest.create({
    data: {
      projectId: str(fd, "projectId"),
      techniqueId,
      timelineEntryId: str(fd, "timelineEntryId"),
      draftRuleXml: str(fd, "draftRuleXml") ?? defaultRuleXml(techniqueId),
      testLogSamplePath: str(fd, "testLogSamplePath"),
      justification: str(fd, "justification"),
      requestedById: user.id,
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "rule_request",
    resourceId: rr.id,
    details: { techniqueId },
  });
  revalidatePath("/rule-requests");
  revalidatePath("/attack-matrix");
}

async function transition(rrId: string, to: RuleStatus, extra?: { approvedBy?: string; rejectionReason?: string }) {
  const current = await prisma.ruleRequest.findUniqueOrThrow({ where: { id: rrId } });
  const via = canTransition(current.status as RuleStatus, to);
  if (!via) throw new Error(`Illegal transition ${current.status} → ${to}`);

  const now = new Date();
  await prisma.ruleRequest.update({
    where: { id: rrId },
    data: {
      status: to,
      requestedAt: to === "pending_review" ? now : undefined,
      approvedBy: extra?.approvedBy ?? (to === "approved" ? "sentinel-sim" : undefined),
      approvedAt: to === "approved" ? now : undefined,
      deployedAt: to === "deployed" ? now : undefined,
      verifiedAt: to === "verified" ? now : undefined,
      rejectionReason: extra?.rejectionReason,
    },
  });
  return via;
}

/** Operator action: push the draft to Sentinel's review queue. */
export async function submitRuleRequest(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) throw new Error("Missing id");
  const via = await transition(id, "pending_review");
  await audit({ userId: user.id, action: `rule_request:${via}`, resourceType: "rule_request", resourceId: id });
  revalidatePath("/rule-requests");
  revalidatePath(`/rule-requests/${id}`);
  revalidatePath("/attack-matrix");
}

/**
 * Simulated Sentinel-side transitions (approve/reject/deploy). Replaced by polling in M12 —
 * until then these buttons stand in for the SOC admin acting inside Sentinel.
 */
export async function sentinelSimulate(fd: FormData) {
  await requireUser(); // single Admin role; command is dev-only scaffolding
  const id = str(fd, "id");
  const to = str(fd, "to") as RuleStatus | null;
  const reason = str(fd, "rejectionReason");
  if (!id || !to) throw new Error("Missing fields");
  const via = await transition(id, to, reason ? { rejectionReason: reason } : undefined);
  await audit({
    userId: null,
    action: `rule_request:${via}`,
    resourceType: "rule_request",
    resourceId: id,
    details: { simulated: true, to },
  });
  revalidatePath("/rule-requests");
  revalidatePath(`/rule-requests/${id}`);
  revalidatePath("/attack-matrix");
}

/** Operator action after a retest: verified when now detected, back to draft when still missed. */
export async function verifyRuleRequest(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const passed = fd.get("passed") === "true";
  if (!id) throw new Error("Missing id");
  const via = await transition(id, passed ? "verified" : "draft");
  await audit({
    userId: user.id,
    action: `rule_request:${via}`,
    resourceType: "rule_request",
    resourceId: id,
    details: { passed },
  });
  revalidatePath("/rule-requests");
  revalidatePath(`/rule-requests/${id}`);
  revalidatePath("/attack-matrix");
}
