"use server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { nextEngagementCode } from "@/lib/engagement-code";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v ? new Date(v) : null;
}

export async function createEngagement(fd: FormData) {
  const { user } = await requireUser();
  const name = str(fd, "name");
  const applicationId = str(fd, "applicationId");
  if (!name || !applicationId) flashErr("/engagements/new", "Name and application are required");

  // ponytail: code from row count â€” fine for a single admin team; switch to a sequence if codes must stay gapless under concurrency
  const count = await prisma.project.count();
  const project = await prisma.project.create({
    data: {
      code: nextEngagementCode(count + 1),
      name,
      type: (str(fd, "type") ?? "internal_pentest") as never,
      description: str(fd, "description"),
      startDate: date(fd, "startDate"),
      endDate: date(fd, "endDate"),
      applicationId,
      ownerId: user.id,
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "engagement",
    resourceId: project.id,
    details: { code: project.code, name },
  });
  await flashOk(`/engagements/${project.id}`, "Engagement created");
}

export async function updateEngagement(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");

  const before = await prisma.project.findUniqueOrThrow({ where: { id } });
  const status = str(fd, "status") ?? before.status;
  const phase = str(fd, "phase") ?? before.phase;

  await prisma.project.update({
    where: { id },
    data: {
      name: str(fd, "name") ?? before.name,
      type: (str(fd, "type") ?? before.type) as never,
      status: status as never,
      phase: phase as never,
      description: str(fd, "description"),
      startDate: date(fd, "startDate"),
      endDate: date(fd, "endDate"),
    },
  });

  if (status !== before.status) {
    await audit({
      userId: user.id,
      action: "update_status",
      resourceType: "engagement",
      resourceId: id,
      details: { before: before.status, after: status },
    });
  }
  if (phase !== before.phase) {
    await audit({
      userId: user.id,
      action: "update_phase",
      resourceType: "engagement",
      resourceId: id,
      details: { before: before.phase, after: phase },
    });
  }
  await flashOk(`/engagements/${id}`, "Saved");
}

export async function deleteEngagement(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");

  const project = await prisma.project.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "engagement",
    resourceId: id,
    details: { code: project.code },
  });
  await flashOk("/engagements", "Engagement deleted");
}
