import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { KbGraph, type GraphEdge, type GraphNode } from "./kb-graph";

export default async function KbGraphPage() {
  const [notes, links] = await Promise.all([
    prisma.note.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 120 }),
    prisma.noteLink.findMany({ select: { sourceId: true, targetId: true, targetTitleRaw: true } }),
  ]);

  const ids = new Set(notes.map((n) => n.id));
  // broken links become edges to a virtual "missing" node per raw title
  const nodes: GraphNode[] = notes.map((n) => ({ id: n.id, title: n.title, type: "note" }));
  const edges: GraphEdge[] = [];
  for (const l of links) {
    if (ids.has(l.sourceId)) {
      if (l.targetId) edges.push({ source: l.sourceId, target: l.targetId, broken: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Knowledge Graph</h1>
        <Link href="/kb" className="btn btn-secondary">
          ← Notes
        </Link>
      </div>
      <Panel description={`${notes.length} notes · ${edges.length} links`}>
        <KbGraph nodes={nodes} edges={edges} />
        {/* broken-link virtual nodes: listed instead of drawn to keep the layout stable */}
        {links.some((l) => !l.targetId) && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-fg-muted">Broken links</summary>
            <ul className="mt-2 space-y-1 text-xs">
              {[...new Set(links.filter((l) => !l.targetId).map((l) => l.targetTitleRaw))].map((t) => (
                <li key={t}>
                  <span className="font-mono text-signal">{t}</span>{" "}
                  <Link href={`/kb/new?title=${encodeURIComponent(t)}`} className="text-blue hover:text-blue">
                    create →
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </div>
  );
}
