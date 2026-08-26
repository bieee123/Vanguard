"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { enqueueNoteEmbedding } from "@/server/reporting/producer";
import { extractWikiLinks } from "@/lib/wiki";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function syncLinksAndTags(
  noteId: string,
  bodyMarkdown: string,
  tagsInput: string[]
): Promise<void> {
  const titles = extractWikiLinks(bodyMarkdown);
  const targets = titles.length
    ? await prisma.note.findMany({
        where: { title: { in: titles, mode: "insensitive" } },
        select: { id: true, title: true },
      })
    : [];

  await prisma.$transaction([
    prisma.noteLink.deleteMany({ where: { sourceId: noteId } }),
    ...titles.map((raw) => {
      const target = targets.find((t) => t.title.toLowerCase() === raw.toLowerCase());
      return prisma.noteLink.create({
        data: { sourceId: noteId, targetId: target?.id ?? null, targetTitleRaw: raw },
      });
    }),
    prisma.noteTag.deleteMany({ where: { noteId } }),
    ...[...new Set(tagsInput.map((t) => t.trim().toLowerCase()).filter(Boolean))].map((tag) =>
      prisma.noteTag.create({ data: { noteId, tag } })
    ),
  ]);
}

export async function createNote(fd: FormData) {
  const { user } = await requireUser();
  const title = str(fd, "title");
  if (!title) flashErr("/kb/new", "Title is required");

  const note = await prisma.note.create({
    data: {
      title,
      bodyMarkdown: fd.get("bodyMarkdown") as string | null ?? "",
      projectId: str(fd, "projectId"),
      excludeFromRag: fd.get("excludeFromRag") === "on",
      createdById: user.id,
    },
  });
  await syncLinksAndTags(note.id, note.bodyMarkdown, listTags(fd));
  await enqueueNoteEmbedding(note.id);
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "note",
    resourceId: note.id,
    details: { title },
  });
  flashOk(`/kb/${note.id}`, "Note created");
}

function listTags(fd: FormData): string[] {
  const raw = fd.get("tags");
  return typeof raw === "string" && raw.trim() ? raw.split(",") : [];
}

export async function updateNote(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/kb", "Missing id");

  const bodyMarkdown = (fd.get("bodyMarkdown") as string | null) ?? "";
  await prisma.note.update({
    where: { id },
    data: {
      title: str(fd, "title") ?? undefined,
      bodyMarkdown,
      projectId: str(fd, "projectId"),
      excludeFromRag: fd.get("excludeFromRag") === "on",
    },
  });
  await syncLinksAndTags(id, bodyMarkdown, listTags(fd));
  await enqueueNoteEmbedding(id);
  await audit({ userId: user.id, action: "update", resourceType: "note", resourceId: id });
  flashOk(`/kb/${id}`, "Note saved");
  revalidatePath("/kb");
}

export async function deleteNote(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/kb", "Missing id");
  const note = await prisma.note.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    resourceType: "note",
    resourceId: id,
    details: { title: note.title },
  });
  revalidatePath("/kb");
  redirect("/kb");
}

/** Rendered markdown helper lives in src/server/kb/render.ts (not an action). */
