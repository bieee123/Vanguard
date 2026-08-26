import { prisma } from "@/lib/db";
import { aiConfigured, cosineSimilarity, embedTexts, chatComplete } from "@/lib/ai";

export interface KbSource {
  noteId: string;
  title: string;
  snippet: string;
  score?: number;
}

const SNIPPET_LEN = 220;

function snippetAround(text: string, needle: string): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_LEN);
  const start = Math.max(0, idx - SNIPPET_LEN / 3);
  return (start > 0 ? "…" : "") + text.slice(start, start + SNIPPET_LEN).trim() + "…";
}

/**
 * Ask the KB.
 * - Provider configured: embed question → cosine over chunks → top-K context → LLM answer + citations.
 * - Not configured (graceful mode per PRD M10): keyword sources only, no answer text.
 */
export async function askKb(
  question: string
): Promise<{ answer: string | null; sources: KbSource[]; mode: "llm" | "sources-only" }> {
  if (!aiConfigured()) {
    const words = question.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
    if (words.length === 0) return { answer: null, sources: [], mode: "sources-only" };
    const notes = await prisma.note.findMany({
      where: {
        excludeFromRag: false,
        OR: words.flatMap((w) => [{ title: { contains: w, mode: "insensitive" } }, { bodyMarkdown: { contains: w, mode: "insensitive" } }]),
      },
      take: 5,
    });
    // rank by number of matched words
    const scored = notes
      .map((n) => ({
        noteId: n.id,
        title: n.title,
        snippet: snippetAround(n.bodyMarkdown || n.title, words[0]),
        score: words.filter((w) =>
          `${n.title} ${n.bodyMarkdown}`.toLowerCase().includes(w.toLowerCase())
        ).length,
      }))
      .sort((a, b) => b.score - a.score);
    return { answer: null, sources: scored, mode: "sources-only" };
  }

  const chunks = await prisma.noteChunk.findMany({
    where: { excludeFromRag: false, embeddingJson: { not: null } },
    include: { note: { select: { id: true, title: true } } },
    take: 2000, // ponytail: brute-force cosine in JS; pgvector + raw SQL when the vault outgrows it
  });
  if (chunks.length === 0) {
    // fall back to keyword sources until the embedding job has run
    return { answer: null, sources: [], mode: "llm" };
  }

  const [qvec] = await embedTexts([question]);
  const ranked = chunks
    .map((c) => ({
      chunk: c,
      score: cosineSimilarity(qvec, JSON.parse(c.embeddingJson!) as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const sources: KbSource[] = ranked.map((r) => ({
    noteId: r.chunk.note.id,
    title: r.chunk.note.title,
    snippet: r.chunk.chunkText.slice(0, SNIPPET_LEN),
    score: Number(r.score.toFixed(3)),
  }));

  const context = ranked
    .map((r, i) => `[${i + 1}] (${r.chunk.note.title})\n${r.chunk.chunkText}`)
    .join("\n\n---\n\n");
  const answer = await chatComplete(
    "You are Vanguard's knowledge-base assistant for a red team. Answer strictly from the provided context. Cite sources as [1], [2]. If the context is insufficient, say so.",
    `Context:\n${context}\n\nQuestion: ${question}`
  );

  return { answer, sources, mode: "llm" };
}
