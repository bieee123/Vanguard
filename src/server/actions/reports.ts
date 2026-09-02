"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { enqueueReportGeneration } from "@/server/reporting/producer";
import { saveFile, deleteFile } from "@/lib/storage";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const EVIDENCE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".log"];
// ponytail: 25MB in-memory cap; streaming upload only if real evidence ever gets bigger
const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

export async function createReport(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const title = str(fd, "title");
  if (!projectId || !title) flashErr("/reports/new", "Project and title are required");

  const report = await prisma.report.create({
    data: {
      projectId,
      title,
      execSummary: str(fd, "execSummary"),
      conclusion: str(fd, "conclusion"),
      createdById: user.id,
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "report",
    resourceId: report.id,
    details: { projectId, title },
  });
  await flashOk(`/reports/${report.id}`, "Draft created");
}

export async function updateReport(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/reports", "Missing id");
  await prisma.report.update({
    where: { id },
    data: {
      title: str(fd, "title") ?? undefined,
      execSummary: str(fd, "execSummary"),
      conclusion: str(fd, "conclusion"),
    },
  });
  await audit({ userId: user.id, action: "update", resourceType: "report", resourceId: id });
  await flashOk(`/reports/${id}`, "Narrative saved");
}

export async function generateReport(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/reports", "Missing id");
  await prisma.report.update({ where: { id }, data: { status: "queued" } });
  await enqueueReportGeneration(id);
  await audit({ userId: user.id, action: "generate", resourceType: "report", resourceId: id });
  await flashOk(`/reports/${id}`, "Queued for generation");
  revalidatePath(`/reports/${id}`);
}

export async function archiveReport(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/reports", "Missing id");
  await prisma.report.update({
    where: { id },
    data: { archivedAt: new Date(), status: "generated" },
  });
  await audit({ userId: user.id, action: "archive", resourceType: "report", resourceId: id });
  revalidatePath("/reports");
  await flashOk(`/reports/${id}`, "Archived");
  revalidatePath(`/reports/${id}`);
}

export async function unarchiveReport(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/reports", "Missing id");
  await prisma.report.update({ where: { id }, data: { archivedAt: null } });
  await audit({ userId: user.id, action: "unarchive", resourceType: "report", resourceId: id });
  revalidatePath("/reports");
  await flashOk(`/reports/${id}`, "Restored");
  revalidatePath(`/reports/${id}`);
}

export async function deleteReport(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/reports", "Missing id");
  const report = await prisma.report.delete({ where: { id } });
  if (report.filePath) deleteFile(report.filePath);
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "report",
    resourceId: id,
    details: { title: report.title },
  });
  await flashOk("/reports", "Report deleted");
  redirect("/reports");
}

export async function cloneReport(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/reports", "Missing id");
  const source = await prisma.report.findUniqueOrThrow({
    where: { id },
    include: { findings: { orderBy: { position: "asc" } }, evidence: true },
  });

  // ponytail: max(version)+1 like engagement codes â€” fine for a single admin team
  const agg = await prisma.report.aggregate({
    _max: { version: true },
    where: { projectId: source.projectId },
  });

  const clone = await prisma.report.create({
    data: {
      projectId: source.projectId,
      title: `${source.title} (copy)`,
      version: (agg._max.version ?? source.version) + 1,
      execSummary: source.execSummary,
      conclusion: source.conclusion,
      createdById: user.id,
      clonedFromId: source.id,
      findings: {
        create: source.findings.map((f) => ({
          sourceId: f.sourceId,
          position: f.position,
          title: f.title,
          severity: f.severity,
          status: f.status,
          cve: f.cve,
          cwe: f.cwe,
          cvssScore: f.cvssScore,
          cvssVector: f.cvssVector,
          description: f.description,
          mitigation: f.mitigation,
          replication: f.replication,
          attackTechniques: [...f.attackTechniques],
        })),
      },
      evidence: {
        create: source.evidence.map((e) => ({
          filePath: e.filePath, // shared bytes; deleting either copy removes the file for both
          caption: e.caption,
          uploadedById: user.id,
        })),
      },
    },
  });
  await audit({
    userId: user.id,
    action: "clone",
    resourceType: "report",
    resourceId: clone.id,
    details: { from: source.id },
  });
  await flashOk(`/reports/${clone.id}`, "Cloned");
  revalidatePath("/reports");
  redirect(`/reports/${clone.id}`);
}

// â”€â”€ Builder: findings snapshot (v1 "link copy" pattern â€” immutable once added) â”€â”€

async function nextPosition(reportId: string): Promise<number> {
  const agg = await prisma.reportFinding.aggregate({ _max: { position: true }, where: { reportId } });
  return (agg._max.position ?? 0) + 1;
}

export async function addFindingToReport(fd: FormData) {
  const { user } = await requireUser();
  const reportId = str(fd, "reportId");
  const findingId = str(fd, "findingId");
  if (!reportId || !findingId) flashErr(`/reports/${reportId}`, "Missing fields");

  const source = await prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
  await prisma.reportFinding.create({
    data: {
      reportId,
      sourceId: source.id,
      position: await nextPosition(reportId),
      title: source.title,
      severity: source.severity,
      status: source.status,
      cve: source.cve,
      cwe: source.cwe,
      cvssScore: source.cvssScore,
      cvssVector: source.cvssVector,
      description: source.description,
      mitigation: source.mitigation,
      replication: source.replication,
      attackTechniques: [...source.attackTechniques],
    },
  });
  await audit({
    userId: user.id,
    action: "add_finding",
    resourceType: "report",
    resourceId: reportId,
    details: { findingId },
  });
  revalidatePath(`/reports/${reportId}`);
}

export async function removeReportFinding(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const reportId = str(fd, "reportId");
  if (!id || !reportId) flashErr(`/reports/${reportId}`, "Missing fields");
  await prisma.reportFinding.delete({ where: { id } });
  await audit({ userId: user.id, action: "remove_finding", resourceType: "report", resourceId: reportId });
  await flashOk(`/reports/${reportId}`, "Finding removed");
  revalidatePath(`/reports/${reportId}`);
}

export async function moveReportFinding(fd: FormData) {
  await requireUser();
  const id = str(fd, "id");
  const dir = str(fd, "dir"); // "up" | "down"
  const reportId = str(fd, "reportId");
  if (!id || !dir || !reportId) return;

  const all = await prisma.reportFinding.findMany({
    where: { reportId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const idx = all.findIndex((f) => f.id === id);
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= all.length) return;

  await prisma.$transaction([
    prisma.reportFinding.update({ where: { id: all[idx].id }, data: { position: all[swapWith].position } }),
    prisma.reportFinding.update({ where: { id: all[swapWith].id }, data: { position: all[idx].position } }),
  ]);
  revalidatePath(`/reports/${reportId}`);
}

// â”€â”€ Evidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function uploadEvidence(fd: FormData) {
  const { user } = await requireUser();
  const reportId = str(fd, "reportId");
  const file = fd.get("file") as File | null;
  if (!reportId || !file || file.size === 0) flashErr(`/reports/${reportId}`, "File is required");
  if (file.size > EVIDENCE_MAX_BYTES) flashErr(`/reports/${reportId}`, "File exceeds 25 MB");

  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (!EVIDENCE_EXT.includes(ext)) flashErr(`/reports/${reportId}`, `Allowed types: ${EVIDENCE_EXT.join(", ")}`);

  const key = `evidence/${crypto.randomUUID()}${ext}`;
  saveFile(key, Buffer.from(await file.arrayBuffer()));
  const row = await prisma.evidence.create({
    data: { reportId, filePath: key, caption: str(fd, "caption"), uploadedById: user.id },
  });
  await audit({
    userId: user.id,
    action: "upload_evidence",
    resourceType: "evidence",
    resourceId: row.id,
    details: { reportId, file: file.name },
  });
  await flashOk(`/reports/${reportId}`, "Evidence uploaded");
  revalidatePath(`/reports/${reportId}`);
}

export async function deleteEvidence(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/reports", "Missing id");
  const row = await prisma.evidence.delete({ where: { id } });
  deleteFile(row.filePath);
  await audit({ userId: user.id, action: "delete_evidence", resourceType: "evidence", resourceId: id });
  if (row.reportId) {
    revalidatePath(`/reports/${row.reportId}`);
    await flashOk(`/reports/${row.reportId}`, "Evidence deleted");
  }
}
