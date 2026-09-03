"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { askKbAction } from "./ask-kb-action";

interface Source {
  noteId: string;
  title: string;
  snippet: string;
  score?: number;
}

export function AskKbPanel({ modelLabel }: { modelLabel?: string | null }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ answer: string | null; mode: string; sources: Source[] } | null>(null);
  const [busy, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    startTransition(async () => {
      const res = await askKbAction(question.trim());
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <Panel title="AI Ask" description="Ask the knowledge base">
        {/* design §6.7: Model label always visible when a provider is configured */}
        {modelLabel && <p className="mb-2 text-[11px] text-fg-muted">Model: {modelLabel}</p>}
        <form onSubmit={submit} className="space-y-2">
          <textarea
            rows={3}
            className="input"
            placeholder="How did we bypass EDR on the last engagement?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button disabled={busy || !question.trim()} className="btn btn-primary w-full justify-center">
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>
        {result && (
          <p className="mt-2 text-[11px] text-fg-muted">
            Mode: {result.mode === "llm" && result.answer ? "LLM answer" : "sources only (no AI provider configured)"}
          </p>
        )}
        {result?.answer && (
          <div className="mt-2 whitespace-pre-wrap rounded-sm bg-raised p-3 text-sm text-fg-secondary">
            {result.answer}
          </div>
        )}
        {result && result.sources.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="label !mb-0">Sources</p>
            {result.sources.map((s) => (
              <Link
                key={s.noteId}
                href={`/kb/${s.noteId}`}
                className="block rounded-sm border border-line-subtle px-2 py-1.5 text-xs hover:bg-hover"
              >
                <span className="font-medium text-fg-primary">{s.title}</span>
                {s.score !== undefined && <span className="ml-2 font-mono text-fg-muted">{s.score}</span>}
                <span className="line-clamp-1 block text-fg-muted">{s.snippet}</span>
              </Link>
            ))}
          </div>
        )}
        {result && result.sources.length === 0 && !result.answer && (
          <p className="mt-2 text-xs text-fg-muted">No matching notes.</p>
        )}
      </Panel>
    </div>
  );
}
