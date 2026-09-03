import Link from "next/link";
import { PanelRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Drawer } from "@/components/ui/drawer";
import { AskKbPanel } from "./ask-kb-panel";
import { aiConfigured } from "@/lib/ai";

export default async function KbIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const model = process.env.AI_CHAT_MODEL ?? null;
  const hasProvider = aiConfigured();
  const notes = await prisma.note.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { bodyMarkdown: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        tag ? { tags: { some: { tag } } } : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { linksOut: true, linksIn: true } },
      tags: true,
      linksIn: { where: { targetId: { not: null } } },
    },
  });
  const allTags = await prisma.noteTag.groupBy({ by: ["tag"], _count: true, orderBy: { _count: { tag: "desc" } }, take: 15 });

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Knowledge Base</h1>
          <div className="flex items-center gap-2">
            <Drawer
              title="AI Ask"
              widthClass="max-w-2xl"
              triggerClass="btn btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px]"
              label={
                <>
                  <PanelRight size={15} strokeWidth={1.75} />
                  Ask AI
                </>
              }
            >
              <AskKbPanel modelLabel={hasProvider ? model : null} />
            </Drawer>
            <Link href="/kb/graph" className="btn btn-secondary">
              Graph view
            </Link>
            <Link href="/kb/new" className="btn btn-primary">
              New Note
            </Link>
          </div>
        </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[12rem_1fr]">
        {/* left pane: tag tree (Explore-style filter) */}
        <aside className="space-y-2 self-start rounded-md border border-line-subtle bg-panel p-3">
          <p className="label !mb-1">Tags</p>
          <Link
            href="/kb"
            className={`block rounded-sm px-2 py-0.5 text-xs hover:bg-hover ${!tag ? "text-fg-primary" : "text-fg-secondary"}`}
          >
            all notes
          </Link>
          {allTags.map((t) => (
            <Link
              key={t.tag}
              href={`/kb?tag=${encodeURIComponent(t.tag)}`}
              className={`flex items-center justify-between rounded-sm px-2 py-0.5 text-xs hover:bg-hover ${
                tag === t.tag ? "bg-hover text-fg-primary" : "text-fg-secondary"
              }`}
            >
              <span className="truncate">#{t.tag}</span>
              <span className="font-mono text-fg-muted">{t._count}</span>
            </Link>
          ))}
          {allTags.length === 0 && <p className="px-2 text-xs text-fg-muted">no tags yet</p>}
        </aside>

        <div className="space-y-4">
          <form className="flex flex-wrap gap-2" action="/kb">
            <input name="q" placeholder="Search notes…" defaultValue={q} className="input max-w-xs" />
            <button className="btn btn-secondary">Filter</button>
          </form>

          <Panel title={`Notes (${notes.length})`}>
            <ul className="divide-y divide-line-subtle">
              {notes.map((n) => (
                <li key={n.id} className="py-2">
                  <Link href={`/kb/${n.id}`} className="font-medium text-fg-primary hover:text-fg-primary">
                    {n.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-fg-muted">
                    <span>updated {n.updatedAt.toISOString().slice(0, 10)}</span>
                    <span>{n._count.linksOut} links · {n.linksIn.length} backlinks</span>
                    {n.tags.map((t) => (
                      <Link key={t.tag} href={`/kb?tag=${encodeURIComponent(t.tag)}`} className="text-blue hover:text-blue">
                        #{t.tag}
                      </Link>
                    ))}
                    {n.excludeFromRag && <span className="text-signal">excluded from RAG</span>}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="py-2 text-sm text-fg-muted">No notes match.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
