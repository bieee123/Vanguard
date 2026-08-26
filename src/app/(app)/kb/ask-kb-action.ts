"use server";

import { askKb } from "@/server/kb/rag";
import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/session";

export async function askKbAction(
  question: string
): Promise<{ answer: string | null; mode: string; sources: { noteId: string; title: string; snippet: string; score?: number }[] }> {
  await requireUser();
  const result = await askKb(question);
  return { answer: result.answer, mode: aiConfigured() ? result.mode : "sources-only", sources: result.sources };
}
