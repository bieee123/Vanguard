import { prisma } from "@/lib/db";
import { marked } from "marked";
import { renderMarkdownWithWikiLinks } from "@/lib/wiki";

/** Markdown → HTML with [[wiki-links]] resolved against existing note titles. */
export async function renderNoteBody(bodyMarkdown: string): Promise<string> {
  const html = marked.parse(bodyMarkdown, { async: false }) as string;
  const notes = await prisma.note.findMany({ select: { id: true, title: true } });
  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));
  return renderMarkdownWithWikiLinks(html, (t) => byTitle.get(t.toLowerCase()) ?? null);
}
