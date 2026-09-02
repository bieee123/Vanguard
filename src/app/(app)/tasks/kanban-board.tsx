"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveTask } from "@/server/actions/tasks";

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  taskType: string | null;
  assigneeName?: string | null;
  dueDate: Date | null;
}

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
] as const;

/** Kanban with native HTML5 drag & drop — zero dependencies. */
export function KanbanBoard({ tasks }: { tasks: Record<string, BoardTask[]> }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const dropOn = async (colKey: string) => {
    setHoverCol(null);
    if (!dragging) return;
    const fd = new FormData();
    fd.set("id", dragging);
    fd.set("status", colKey);
    setDragging(null);
    // server action + router.refresh so the board re-renders from the DB
    await moveTask(fd);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault();
            setHoverCol(col.key);
          }}
          onDragLeave={() => setHoverCol((h) => (h === col.key ? null : h))}
          onDrop={(e) => {
            e.preventDefault();
            void dropOn(col.key);
          }}
          className={`min-h-[24rem] rounded-md border p-2 ${
            hoverCol === col.key ? "border-blue bg-blue-dim/30" : "border-line-subtle bg-panel"
          }`}
        >
          <p className="label sticky top-0">
            {col.label}{" "}
            <span className="font-mono text-fg-muted">{tasks[col.key]?.length ?? 0}</span>
          </p>
          <div className="mt-2 space-y-2">
            {(tasks[col.key] ?? []).map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragging(t.id)}
                onDragEnd={() => setDragging(null)}
                className={`group cursor-grab rounded-sm border border-line-subtle bg-raised p-2.5 text-sm active:cursor-grabbing ${
                  dragging === t.id ? "opacity-40" : ""
                }`}
              >
                <p className="font-medium text-fg-primary">{t.title}</p>
                {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{t.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
                  {t.taskType && <span>{t.taskType.replace(/_/g, " ")}</span>}
                  {t.assigneeName && <span>@{t.assigneeName}</span>}
                  {t.dueDate && (
                    <span className={t.dueDate.getTime() < Date.now() && t.status !== "done" ? "text-signal" : ""}>
                      due {t.dueDate.toISOString().slice(5, 10)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(tasks[col.key] ?? []).length === 0 && (
              <p className="pt-6 text-center text-xs text-fg-disabled">drop here</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
