"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const STATUSES = ["todo", "in_progress", "blocked", "done"] as const;

export async function createTask(fd: FormData) {
  const { user } = await requireUser();
  const projectId = str(fd, "projectId");
  const title = str(fd, "title");
  if (!projectId || !title) throw new Error("Engagement and title are required");

  const agg = await prisma.task.aggregate({ _max: { order: true }, where: { projectId } });
  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description: str(fd, "description"),
      status: (str(fd, "status") ?? "todo") as never,
      taskType: str(fd, "taskType"),
      assigneeId: str(fd, "assigneeId"),
      dueDate: (() => {
        const d = str(fd, "dueDate");
        return d ? new Date(d) : null;
      })(),
      // ponytail: new cards always append to their column — fine-grain reorder only if it annoys
      order: (agg._max.order ?? 0) + 1,
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "task",
    resourceId: task.id,
    details: { projectId, title },
  });
  revalidatePath("/tasks");
  revalidatePath(`/engagements/${projectId}`);
}

export async function moveTask(fd: FormData) {
  const { user } = await requireUser();
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status || !STATUSES.includes(status as never)) throw new Error("Missing fields");

  const before = await prisma.task.findUniqueOrThrow({ where: { id } });
  if (before.status !== status) {
    const agg = await prisma.task.aggregate({
      _max: { order: true },
      where: { projectId: before.projectId, status: status as never },
    });
    await prisma.task.update({
      where: { id },
      data: { status: status as never, order: (agg._max.order ?? 0) + 1 },
    });
    await audit({
      userId: user.id,
      action: "move_task",
      resourceType: "task",
      resourceId: id,
      details: { before: before.status, after: status },
    });
  }
  revalidatePath("/tasks");
}

export async function deleteTask(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");
  const task = await prisma.task.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "task",
    resourceId: id,
    details: { title: task.title, projectId: task.projectId },
  });
  revalidatePath("/tasks");
}
