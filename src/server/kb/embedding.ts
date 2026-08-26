import { prisma } from "@/lib/db";
import { aiConfigured, embedTexts } from "@/lib/ai";

// ponytail: paragraph chunks (~1200 chars); smarter semantic chunking when RAG quality matters
function chunkBody(body: string): string[] {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > 1200 && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 50);
}

/**
 * Re-chunks a note and embeds it. Graceful without an AI provider:
 * chunks are stored (keyword search uses them), embeddings stay null.
 */
export async function embedNote(noteId: string): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note || note.excludeFromRag) {
    await prisma.noteChunk.deleteMany({ where: { noteId } });
    return;
  }

  const parts = chunkBody(note.bodyMarkdown || note.title);
  let vectors: number[][] | null = null;
  if (aiConfigured() && parts.length > 0) {
    try {
      vectors = await embedTexts(parts);
    } catch (err) {
      console.error(`[note-embed] provider failed for ${noteId}:`, err);
      // keep chunks without vectors — sources-only mode still works
    }
  }

  await prisma.$transaction([
    prisma.noteChunk.deleteMany({ where: { noteId } }),
    ...parts.map((chunkText, i) =>
      prisma.noteChunk.create({
        data: {
          noteId,
          chunkIndex: i,
          chunkText,
          embeddingJson: vectors ? JSON.stringify(vectors[i]) : null,
          excludeFromRag: note.excludeFromRag,
        },
      })
    ),
  ]);
}
