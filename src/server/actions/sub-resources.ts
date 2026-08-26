"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function req(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (!v) throw new Error(`${key} is required`);
  return v;
}

async function touch(projectId: string) {
  revalidatePath(`/engagements/${projectId}`);
}

// ── Objectives & subtasks ────────────────────────────────────────────

export async function addObjective(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const objective = await prisma.projectObjective.create({
    data: { projectId, title: req(fd, "title"), description: str(fd, "description") },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "objective",
    resourceId: objective.id,
    details: { projectId, title: objective.title },
  });
  await touch(projectId);
}

export async function updateObjectiveStatus(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  const status = req(fd, "status");
  await prisma.projectObjective.update({ where: { id }, data: { status: status as never } });
  await audit({
    userId: user.id,
    action: "update_status",
    resourceType: "objective",
    resourceId: id,
    details: { after: status },
  });
  await touch(req(fd, "projectId"));
}

export async function deleteObjective(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  const projectId = req(fd, "projectId");
  await prisma.projectObjective.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "objective", resourceId: id });
  await touch(projectId);
}

export async function addSubTask(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const subTask = await prisma.projectSubTask.create({
    data: { objectiveId: req(fd, "objectiveId"), title: req(fd, "title") },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "subtask",
    resourceId: subTask.id,
    details: { projectId, title: subTask.title },
  });
  await touch(projectId);
}

export async function toggleSubTask(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  const completed = fd.get("completed") === "true";
  await prisma.projectSubTask.update({ where: { id }, data: { completed } });
  await audit({
    userId: user.id,
    action: "update",
    resourceType: "subtask",
    resourceId: id,
    details: { completed },
  });
  await touch(req(fd, "projectId"));
}

export async function deleteSubTask(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.projectSubTask.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "subtask", resourceId: id });
  await touch(req(fd, "projectId"));
}

// ── Scope & targets ──────────────────────────────────────────────────

export async function addScopeItem(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const item = await prisma.projectScope.create({
    data: {
      projectId,
      direction: (req(fd, "direction") as "in_scope" | "out_of_scope") ?? "in_scope",
      value: req(fd, "value"),
      note: str(fd, "note"),
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "scope_item",
    resourceId: item.id,
    details: { projectId, value: item.value },
  });
  await touch(projectId);
}

export async function deleteScopeItem(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.projectScope.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "scope_item", resourceId: id });
  await touch(req(fd, "projectId"));
}

export async function addTarget(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const target = await prisma.projectTarget.create({
    data: {
      projectId,
      value: req(fd, "value"),
      kind: str(fd, "kind") ?? "domain",
      note: str(fd, "note"),
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "target",
    resourceId: target.id,
    details: { projectId, value: target.value },
  });
  await touch(projectId);
}

export async function deleteTarget(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.projectTarget.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "target", resourceId: id });
  await touch(req(fd, "projectId"));
}

// ── Notes / deconfliction / white cards / assignments ────────────────

export async function addProjectNote(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const note = await prisma.projectNote.create({
    data: { projectId, body: req(fd, "body"), authorId: user.id },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "project_note",
    resourceId: note.id,
    details: { projectId },
  });
  await touch(projectId);
}

export async function deleteProjectNote(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.projectNote.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "project_note", resourceId: id });
  await touch(req(fd, "projectId"));
}

export async function addDeconfliction(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const entry = await prisma.deconfliction.create({
    data: {
      projectId,
      summary: req(fd, "summary"),
      channel: str(fd, "channel"),
      occurredAt: str(fd, "occurredAt") ? new Date(req(fd, "occurredAt")) : new Date(),
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "deconfliction",
    resourceId: entry.id,
    details: { projectId },
  });
  await touch(projectId);
}

export async function resolveDeconfliction(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.deconfliction.update({ where: { id }, data: { resolved: true } });
  await audit({ userId: user.id, action: "update", resourceType: "deconfliction", resourceId: id });
  await touch(req(fd, "projectId"));
}

export async function addWhiteCard(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const card = await prisma.whiteCard.create({
    data: { projectId, description: req(fd, "description"), createdById: user.id },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "white_card",
    resourceId: card.id,
    details: { projectId },
  });
  await touch(projectId);
}

export async function assignUser(fd: FormData) {
  const { user } = await requireUser();
  const projectId = req(fd, "projectId");
  const userId = req(fd, "userId");
  const assignment = await prisma.projectAssignment.create({
    data: { projectId, userId, role: str(fd, "role") ?? "operator" },
  });
  await audit({
    userId: user.id,
    action: "assign",
    resourceType: "engagement_assignment",
    resourceId: assignment.id,
    details: { projectId, userId },
  });
  await touch(projectId);
}

export async function unassignUser(fd: FormData) {
  const { user } = await requireUser();
  const id = req(fd, "id");
  await prisma.projectAssignment.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "unassign",
    resourceType: "engagement_assignment",
    resourceId: id,
  });
  await touch(req(fd, "projectId"));
}
