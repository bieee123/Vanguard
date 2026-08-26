// OpenAI-compatible AI client (M10/M12 share the same provider shape).
// Everything degrades gracefully when unconfigured — callers must check aiConfigured().

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  embedModel: string;
  chatModel: string;
}

export function aiConfig(): AiConfig | null {
  const baseUrl = process.env.AI_API_URL;
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: process.env.AI_API_KEY ?? "",
    embedModel: process.env.AI_EMBED_MODEL ?? "text-embedding-3-small",
    chatModel: process.env.AI_CHAT_MODEL ?? "gpt-4o-mini",
  };
}

export function aiConfigured(): boolean {
  return aiConfig() !== null;
}

/** Embed texts; returns float arrays. Throws on provider errors — callers decide fallback. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const cfg = aiConfig();
  if (!cfg) throw new Error("AI provider not configured");
  const res = await fetch(`${cfg.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.embedModel, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function chatComplete(
  system: string,
  user: string
): Promise<string> {
  const cfg = aiConfig();
  if (!cfg) throw new Error("AI provider not configured");
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.chatModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

// ── vector math (JSON-array embeddings; swap for pgvector when the corpus grows) ──

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
