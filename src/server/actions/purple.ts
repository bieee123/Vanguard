"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { correlate, pollRuleStatus, sentinelConfigured, submitRetest, submitRuleRequest as sentinelSubmitRuleRequest } from "@/lib/sentinel";
import { sendMail } from "@/lib/mail";
import { canTransition, mapSentinelStatus, type RuleStatus } from "@/lib/rule-lifecycle";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v ? new Date(v) : null;
}

// â”€â”€ Timeline entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createTimelineEntry(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const actionDescription = str(fd, "actionDescription");
  if (!projectId || !actionDescription) flashErr("/timeline", "Engagement and action are required");

  const timestamp = date(fd, "timestamp") ?? new Date();
  const techniqueId = str(fd, "techniqueId");
  // ponytail: tactic derived from the technique's first three letters of the id order â€”
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

  // auto-correlate against Sentinel (M12) — falls back to the deterministic mock
  // until SENTINEL_BASE_URL is configured
  if (techniqueId) {
    const { verdict, alert } = await correlate(techniqueId, timestamp, {
      engagementId: projectId,
      assetId: str(fd, "assetId"),
      description: actionDescription,
    });
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
  flashOk("/timeline", "Entry logged");
}

export async function updateTimelineOutcome(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const outcome = str(fd, "outcome");
  if (!id || !outcome) flashErr("/timeline", "Missing fields");
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
  if (!id) flashErr("/timeline", "Missing id");
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

// â”€â”€ Verdict confirmation / override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function confirmVerdict(fd: FormData) {
  const { user } = await requireUser();
  const timelineEntryId = str(fd, "timelineEntryId");
  const override = str(fd, "verdict"); // optional operator correction
  if (!timelineEntryId) flashErr("/timeline", "Missing entry");

  const existing = await prisma.detectionVerdict.findUnique({ where: { timelineEntryId } });
  if (!existing) flashErr("/timeline", "No verdict to confirm");

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
    flashOk("/timeline", "Verdict confirmed");
  revalidatePath("/timeline");
  revalidatePath("/attack-matrix");
}

export async function recorrelateVerdict(fd: FormData) {
  await requireUser();
  const timelineEntryId = str(fd, "timelineEntryId");
  if (!timelineEntryId) flashErr("/timeline", "Missing entry");

  const entry = await prisma.timelineEntry.findUniqueOrThrow({ where: { id: timelineEntryId } });
  if (!entry.techniqueId) return;
  const { verdict, alert } = await correlate(entry.techniqueId, entry.timestamp, {
    engagementId: entry.projectId,
    assetId: entry.assetId,
  });
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

// â”€â”€ Rule requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if (!techniqueId) flashErr("/attack-matrix", "Technique is required");

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
  flashOk("/rule-requests", "Draft created in backlog");
}

async function transition(rrId: string, to: RuleStatus, extra?: { approvedBy?: string; rejectionReason?: string }) {
  const current = await prisma.ruleRequest.findUniqueOrThrow({ where: { id: rrId } });
  const via = canTransition(current.status as RuleStatus, to);
  if (!via) flashErr("/rule-requests", `Illegal transition ${current.status} -> ${to}`);

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
  if (!id) flashErr("/timeline", "Missing id");

  if (sentinelConfigured()) {
    const rr = await prisma.ruleRequest.findUniqueOrThrow({ where: { id } });
    try {
      const json = (await sentinelSubmitRuleRequest({
        engagementId: rr.projectId ?? "",
        findingId: rr.timelineEntryId ?? "",
        techniqueId: rr.techniqueId,
        ruleJson: { rule_xml: rr.draftRuleXml },
        rationale: rr.justification ?? "No justification provided.",
      })) as { id?: string; status?: string };
      await prisma.ruleRequest.update({
        where: { id },
        data: { sentinelRuleRequestId: json.id, requestedAt: new Date() },
      });
    } catch (err) {
      flashErr("/rule-requests", `Sentinel unreachable — ${err instanceof Error ? err.message : "push failed"}`);
      return;
    }
    await prisma.ruleRequest.update({ where: { id }, data: { status: "pending_review" } });
    await audit({
      userId: user.id,
      action: "rule_request:submit",
      resourceType: "rule_request",
      resourceId: id,
      details: { sentinel: true },
    });
    revalidatePath("/attack-matrix");
    flashOk("/rule-requests", "Submitted to Sentinel for review");
    return;
  }

  const via = await transition(id, "pending_review");
  await audit({ userId: user.id, action: `rule_request:${via}`, resourceType: "rule_request", resourceId: id });
  revalidatePath("/attack-matrix");
  flashOk("/rule-requests", "Submitted for review");
}

/** Sync a rule request's lifecycle from Sentinel (approve/deploy/reject land here). */
export async function refreshRuleStatus(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/rule-requests", "Missing id");
  const rr = await prisma.ruleRequest.findUniqueOrThrow({
    where: { id },
    include: { requestedBy: true },
  });
  if (!rr.sentinelRuleRequestId) {
    flashErr("/rule-requests", "Not pushed to Sentinel yet");
    return;
  }
  let json: { status?: string; approved_by?: string | null; rejection_reason?: string | null };
  try {
    json = (await pollRuleStatus(rr.sentinelRuleRequestId)) as typeof json;
  } catch (err) {
    flashErr("/rule-requests", `Sentinel unreachable — ${err instanceof Error ? err.message : "poll failed"}`);
    return;
  }
  const next = mapSentinelStatus(json.status ?? "pending_review");
  const now = new Date();
  const changed = next !== rr.status;
  await prisma.ruleRequest.update({
    where: { id },
    data: {
      status: next,
      approvedBy: next === "approved" || next === "deployed" ? (json.approved_by ?? rr.approvedBy) : rr.approvedBy,
      approvedAt: next === "approved" ? now : rr.approvedAt,
      deployedAt: next === "deployed" ? now : rr.deployedAt,
      rejectionReason: next === "rejected" ? (json.rejection_reason ?? rr.rejectionReason) : rr.rejectionReason,
    },
  });
  await audit({
    userId: user.id,
    action: `rule_request:sync`,
    resourceType: "rule_request",
    resourceId: id,
    details: { from: rr.status, to: next },
  });
  if (changed && rr.requestedBy?.email) {
    await sendMail(
      rr.requestedBy.email,
      `Rule request ${rr.techniqueId} → ${next.replace(/_/g, " ")}`,
      `Detection gap ${rr.techniqueId} moved to "${next.replace(/_/g, " ")}" in Sentinel.`
    ).catch(() => undefined);
  }
  revalidatePath("/attack-matrix");
  revalidatePath("/rule-requests");
  flashOk("/rule-requests", changed ? `Synced — status is now ${next.replace(/_/g, " ")}` : "No change");
}

/**
 * Simulated Sentinel-side transitions (approve/reject/deploy). Replaced by polling in M12 â€”
 * until then these buttons stand in for the SOC admin acting inside Sentinel.
 */
export async function sentinelSimulate(fd: FormData) {
  await requireUser(); // single Admin role; command is dev-only scaffolding
  const id = str(fd, "id");
  const to = str(fd, "to") as RuleStatus | null;
  const reason = str(fd, "rejectionReason");
  if (!id || !to) flashErr("/rule-requests", "Missing fields");
  const via = await transition(id, to, reason ? { rejectionReason: reason } : undefined);
  await audit({
    userId: null,
    action: `rule_request:${via}`,
    resourceType: "rule_request",
    resourceId: id,
    details: { simulated: true, to },
  });
  revalidatePath(`/rule-requests/${id}`);
  revalidatePath("/attack-matrix");
  flashOk("/rule-requests", `Sentinel simulation: ${to.replace(/_/g, " ")}`);
}

/** Operator action after a retest: verified when now detected, back to draft when still missed. */
export async function verifyRuleRequest(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const passed = fd.get("passed") === "true";
  if (!id) flashErr("/timeline", "Missing id");

  if (sentinelConfigured()) {
    const rr = await prisma.ruleRequest.findUniqueOrThrow({ where: { id } });
    if (rr.sentinelRuleRequestId) {
      try {
        await submitRetest(rr.sentinelRuleRequestId, {
          verdict: passed ? "verified" : "verify_failed",
          testDetails: `Operator retest after deploy: ${passed ? "detected" : "still missed"}`,
        });
      } catch (err) {
        flashErr("/rule-requests", `Sentinel unreachable — ${err instanceof Error ? err.message : "retest failed"}`);
        return;
      }
    }
    const via = await transition(id, passed ? "verified" : "draft");
    await audit({
      userId: user.id,
      action: `rule_request:${via}`,
      resourceType: "rule_request",
      resourceId: id,
      details: { passed, sentinel: true },
    });
    revalidatePath("/attack-matrix");
    flashOk(
      "/rule-requests",
      passed ? "Retest passed - rule verified" : "Still undetected - back to draft"
    );
    return;
  }

  const via = await transition(id, passed ? "verified" : "draft");
  await audit({
    userId: user.id,
    action: `rule_request:${via}`,
    resourceType: "rule_request",
    resourceId: id,
    details: { passed },
  });
  revalidatePath("/attack-matrix");
  flashOk(
    "/rule-requests",
    passed ? "Retest passed - rule verified" : "Still undetected - back to draft"
  );
}