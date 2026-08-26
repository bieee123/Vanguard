import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { renderNoteBody } from "@/server/kb/render";
import { deleteNote } from "@/server/actions/kb";

export default async function NoteViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      project: true,
      tags: true,
      linksOut: { include: { target: { select: { id: true, title: true } } } },
      linksIn: { where: { targetId: { not: null } }, include: { source: { select: { id: true, title: true } } } },
    },
  });
  if (!note) notFound();

  const html = await renderNoteBody(note.bodyMarkdown);
  const broken = note.linksOut.filter((l) => l.targetId === null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-semibold">{note.title}</h1>
        {note.excludeFromRag && <Badge color="signal">excluded from RAG</Badge>}
        <div className="ml-auto flex gap-2">
          <Link href={`/kb/${note.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <form action={deleteNote}>
            <input type="hidden" name="id" value={note.id} />
            <button className="btn btn-danger">Delete</button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-fg-muted">
        {note.project && (
          <Link href={`/engagements/${note.project.id}`} className="font-mono hover:underline">
            {note.project.code}
          </Link>
        )}
        {note.tags.map((t) => (
          <Link key={t.tag} href={`/kb?tag=${encodeURIComponent(t.tag)}`} className="text-blue hover:underline">
            #{t.tag}
          </Link>
        ))}
        <span>updated {note.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
      </div>

      <div className="grid grid-cols-[1fr_18rem] gap-4">
        <Panel>
          {/* ponytail: markdown comes from our own trusted renderer (marked) — internal tool, single role */}
          <article
            className="prose-invert max-w-none space-y-3 text-sm leading-relaxed text-fg-secondary [&_a.wiki-broken]:text-signal [&_a]:text-blue [&_a:hover]:underline [&_code]:rounded-sm [&_code]:bg-raised [&_code]:px-1 [&_h1]:font-display [&_h1]:text-lg [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-raised [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Panel>

        <div className="space-y-4">
          <Panel title={`Backlinks (${note.linksIn.length})`}>
            <ul className="space-y-1 text-sm">
              {note.linksIn.map(({ source }) => (
                <li key={source.id}>
                  <Link href={`/kb/${source.id}`} className="text-blue hover:underline">
                    {source.title}
                  </Link>
                </li>
              ))}
              {note.linksIn.length === 0 && <li className="text-fg-muted">None yet.</li>}
            </ul>
          </Panel>

          <Panel title={`Outgoing links (${note.linksOut.length})`}>
            <ul className="space-y-1 text-sm">
              {note.linksOut.map((l) => (
                <li key={l.id}>
                  {l.target ? (
                    <Link href={`/kb/${l.target.id}`} className="text-blue hover:underline">
                      {l.targetTitleRaw}
                    </Link>
                  ) : (
                    <Link href={`/kb/new?title=${encodeURIComponent(l.targetTitleRaw)}`} className="text-signal hover:underline" title="broken link — click to create">
                      {l.targetTitleRaw} ✗
                    </Link>
                  )}
                </li>
              ))}
              {broken.length > 0 && (
                <li className="pt-1 text-[11px] text-fg-muted">{broken.length} broken link(s).</li>
              )}
              {note.linksOut.length === 0 && <li className="text-fg-muted">No wiki-links.</li>}
            </ul>
          </Panel>
        </div>
      </div>

      <Link href="/kb" className="text-xs text-fg-muted hover:underline">
        ← Back to knowledge base
      </Link>
    </div>
  );
}
