"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v === null ? null : Number(v);
}
function list(fd: FormData, keys: string[]): string[] {
  return keys
    .map((k) => str(fd, k))
    .filter((v): v is string => v !== null)
    .flatMap((v) => v.split(/[,\n]/))
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveTags(names: string[]): Promise<string[]> {
  const ids = await Promise.all(
    names.map((name) =>
      prisma.tag.upsert({ where: { name }, update: {}, create: { name } }).then((t) => t.id)
    )
  );
  return [...new Set(ids)];
}

export async function createFinding(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const title = str(fd, "title");
  if (!projectId || !title) flashErr("/findings/new?project="+projectId, "Project and title are required");

  const finding = await prisma.finding.create({
    data: {
      projectId,
      title,
      typeId: str(fd, "typeId"),
      severity: (str(fd, "severity") ?? "medium") as never,
      status: (str(fd, "status") ?? "open") as never,
      cve: str(fd, "cve"),
      cwe: str(fd, "cwe"),
      cvssScore: num(fd, "cvssScore"),
      cvssVector: str(fd, "cvssVector"),
      description: str(fd, "description"),
      mitigation: str(fd, "mitigation"),
      replication: str(fd, "replication"),
      attackTechniques: list(fd, ["attackTechniques"]),
      references: list(fd, ["references"]),
      createdById: user.id,
      tags: { create: (await resolveTags(list(fd, ["tags"]))).map((tagId) => ({ tagId })) },
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "finding",
    resourceId: finding.id,
    details: { projectId, title, severity: finding.severity },
  });
  await flashOk(`/findings/${finding.id}`, "Finding created");
}

export async function updateFinding(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/findings", "Missing id");

  const before = await prisma.finding.findUniqueOrThrow({ where: { id } });
  const tagNames = list(fd, ["tags"]);

  await prisma.$transaction([
    prisma.findingTag.deleteMany({ where: { findingId: id } }),
    prisma.finding.update({
      where: { id },
      data: {
        title: str(fd, "title") ?? before.title,
        typeId: str(fd, "typeId"),
        severity: (str(fd, "severity") ?? before.severity) as never,
        status: (str(fd, "status") ?? before.status) as never,
        cve: str(fd, "cve"),
        cwe: str(fd, "cwe"),
        cvssScore: num(fd, "cvssScore"),
        cvssVector: str(fd, "cvssVector"),
        description: str(fd, "description"),
        mitigation: str(fd, "mitigation"),
        replication: str(fd, "replication"),
        attackTechniques: list(fd, ["attackTechniques"]),
        references: list(fd, ["references"]),
        tags: { create: (await resolveTags(tagNames)).map((tagId) => ({ tagId })) },
      },
    }),
  ]);
  await audit({
    userId: user.id,
    action: "update",
    resourceType: "finding",
    resourceId: id,
    details: { before: { severity: before.severity, status: before.status } },
  });
  await flashOk(/findings/+id, "Saved");
}

export async function setFindingStatus(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status) flashErr("/findings", "Missing fields");
  await prisma.finding.update({ where: { id }, data: { status: status as never } });
  await audit({
    userId: user.id,
    action: "update_status",
    resourceType: "finding",
    resourceId: id,
    details: { after: status },
  });
  await flashOk(/findings/+id, "Status updated");
}

export async function deleteFinding(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/findings", "Missing id");
  const finding = await prisma.finding.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "finding",
    resourceId: id,
    details: { projectId: finding.projectId, title: finding.title },
  });
  revalidatePath("/findings");
  revalidatePath(`/engagements/${finding.projectId}`);
  await flashOk("/findings", "Finding deleted");
}

// â”€â”€ Finding â†” asset links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function linkFindingAsset(fd: FormData) {
  const { user } = await requireUser();
  const findingId = str(fd, "findingId");
  const assetId = str(fd, "assetId");
  if (!findingId || !assetId) flashErr("/findings", "Missing fields");
  await prisma.findingAsset.create({ data: { findingId, assetId } }).catch(() => {});
  await audit({
    userId: user.id,
    action: "link_asset",
    resourceType: "finding",
    resourceId: findingId,
    details: { assetId },
  });
  await flashOk(`/findings/${findingId}`, "Asset linked");
}

export async function unlinkFindingAsset(fd: FormData) {
  const { user } = await requireUser();
  const findingId = str(fd, "findingId");
  const assetId = str(fd, "assetId");
  if (!findingId || !assetId) flashErr("/findings", "Missing fields");
  await prisma.findingAsset.delete({
    where: { findingId_assetId: { findingId, assetId } },
  });
  await audit({
    userId: user.id,
    action: "unlink_asset",
    resourceType: "finding",
    resourceId: findingId,
    details: { assetId },
  });
  await flashOk(`/findings/${findingId}`, "Asset unlinked");
}

// â”€â”€ Observations (per project, non-actionable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createObservation(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const title = str(fd, "title");
  if (!projectId || !title) flashErr("/engagements", "Project and title are required");
  const obs = await prisma.observation.create({
    data: {
      projectId,
      title,
      body: str(fd, "body"),
      severity: (str(fd, "severity") ?? "info") as never,
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "observation",
    resourceId: obs.id,
    details: { projectId, title },
  });
  await flashOk(`/engagements/${projectId}`, "Observation added");
}

export async function deleteObservation(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/findings", "Missing id");
  const obs = await prisma.observation.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "observation", resourceId: id });
  await flashOk(`/engagements/${obs.projectId}`, "Observation deleted");
}

// â”€â”€ Finding types management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function addFindingType(fd: FormData) {
  const { user } = await requireUser();
  const name = str(fd, "name");
  if (!name) flashErr("/settings/findings", "Name is required");
  const type = await prisma.findingType.create({ data: { name } }).catch(() => null);
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "finding_type",
    resourceId: type?.id ?? null,
    details: { name },
  });
  revalidatePath("/settings/findings");
  await flashOk("/settings/findings", "Saved");
}

export async function deleteFindingType(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  if (!id) flashErr("/findings", "Missing id");
  await prisma.findingType.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "finding_type", resourceId: id });
  revalidatePath("/settings/findings");
  await flashOk("/settings/findings", "Saved");
}
