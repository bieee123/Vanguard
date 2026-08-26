import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { NoteEditor } from "../note-editor";
import { createNote } from "@/server/actions/kb";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const { title } = await searchParams;
  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Note</h1>
      <Panel>
        <form action={createNote} className="space-y-3">
          <div>
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input id="title" name="title" required className="input" defaultValue={title ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="projectId">
              Engagement (optional)
            </label>
            <select id="projectId" name="projectId" className="input" defaultValue="">
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.application.name}
                </option>
              ))}
            </select>
          </div>
          <NoteEditor initialBody="" />
          <div>
            <label className="label" htmlFor="tags">
              Tags (comma-separated)
            </label>
            <input id="tags" name="tags" className="input" placeholder="recon, windows" />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" name="excludeFromRag" />
            Exclude from RAG (sensitive content)
          </label>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary">Create note</button>
            <Link href="/kb" className="text-xs text-fg-muted hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
}
