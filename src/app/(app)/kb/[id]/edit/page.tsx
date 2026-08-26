import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { NoteEditor } from "../../note-editor";
import { updateNote } from "@/server/actions/kb";

export default async function NoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id }, include: { tags: true } });
  if (!note) notFound();
  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Edit — {note.title}</h1>
      <Panel>
        <form action={updateNote} className="space-y-3">
          <input type="hidden" name="id" value={note.id} />
          <div>
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input id="title" name="title" required className="input" defaultValue={note.title} />
          </div>
          <div>
            <label className="label" htmlFor="projectId">
              Engagement (optional)
            </label>
            <select id="projectId" name="projectId" className="input" defaultValue={note.projectId ?? ""}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.application.name}
                </option>
              ))}
            </select>
          </div>
          <NoteEditor initialBody={note.bodyMarkdown} />
          <div>
            <label className="label" htmlFor="tags">
              Tags (comma-separated)
            </label>
            <input id="tags" name="tags" className="input" defaultValue={note.tags.map((t) => t.tag).join(", ")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" name="excludeFromRag" defaultChecked={note.excludeFromRag} />
            Exclude from RAG (sensitive content)
          </label>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary">Save</button>
            <Link href={`/kb/${note.id}`} className="text-xs text-fg-muted hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
}
