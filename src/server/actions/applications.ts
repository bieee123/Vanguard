"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function createApplication(fd: FormData) {
  const { user } = await requireUser();
  const name = str(fd, "name");
  if (!name) throw new Error("Name is required");

  const app = await prisma.application.create({
    data: {
      name,
      description: str(fd, "description"),
      repoUrl: str(fd, "repoUrl"),
      criticality: (str(fd, "criticality") ?? "medium") as never,
      owningTeam: str(fd, "owningTeam"),
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "application",
    resourceId: app.id,
    details: { name },
  });
  revalidatePath("/applications");
  redirect(`/applications/${app.id}`);
}

export async function updateApplication(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  const name = str(fd, "name");
  if (!name || !id) throw new Error("Missing fields");

  const before = await prisma.application.findUniqueOrThrow({ where: { id } });
  await prisma.application.update({
    where: { id },
    data: {
      name,
      description: str(fd, "description"),
      repoUrl: str(fd, "repoUrl"),
      criticality: (str(fd, "criticality") ?? "medium") as never,
      owningTeam: str(fd, "owningTeam"),
    },
  });
  await audit({
    userId: user.id,
    action: "update",
    resourceType: "application",
    resourceId: id,
    details: { before: { name: before.name }, after: { name } },
  });
  revalidatePath(`/applications/${id}`);
}

export async function deleteApplication(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");

  try {
    await prisma.application.delete({ where: { id } });
  } catch {
    // FK Restrict: application still has projects
    throw new Error("Cannot delete an application that still has engagements");
  }
  await audit({ userId: user.id, action: "delete", resourceType: "application", resourceId: id });
  revalidatePath("/applications");
  redirect("/applications");
}
