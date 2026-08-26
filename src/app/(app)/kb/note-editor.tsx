"use client";

import { useRef, useState } from "react";

interface Suggestion {
  id: string;
  title: string;
}

/** Markdown textarea with [[wiki-link]] autocomplete. */
export function NoteEditor({ initialBody }: { initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [queryStart, setQueryStart] = useState<number | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setBody(value);
    const pos = areaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const openIdx = before.lastIndexOf("[[");
    if (openIdx !== -1 && !before.slice(openIdx + 2).includes("]]")) {
      const q = before.slice(openIdx + 2);
      setQueryStart(openIdx + 2);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (!q.trim()) return setSuggestions([]);
        const res = await fetch(`/api/kb/autocomplete?q=${encodeURIComponent(q.trim())}`);
        setSuggestions(res.ok ? ((await res.json()) as Suggestion[]) : []);
      }, 150);
    } else {
      setSuggestions([]);
      setQueryStart(null);
    }
  }

  function pick(s: Suggestion) {
    if (queryStart === null) return;
    const pos = areaRef.current?.selectionStart ?? body.length;
    // replace the partial query with the full "[[Title]]"
    const before = body.slice(0, queryStart);
    const after = body.slice(pos);
    setBody(`${before}${s.title}]]${after}`);
    setSuggestions([]);
    setQueryStart(null);
  }

  return (
    <div className="relative">
      <label className="label" htmlFor="bodyMarkdown">
        Body (markdown, [[wiki-links]] supported)
      </label>
      <textarea
        ref={areaRef}
        id="bodyMarkdown"
        name="bodyMarkdown"
        rows={14}
        required
        className="input font-mono text-xs"
        value={body}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-sm border border-line-default bg-raised shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-hover"
                onClick={() => pick(s)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
