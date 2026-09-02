import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Global header search (Fase 2): one pass across engagements, findings, assets.
// ponytail: contains/insensitive, 6 per category, no fuzzy — add ES/pg_trgm if corpus grows.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({}, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({});

  const where = { contains: q, mode: "insensitive" as const };

  const [engagements, findings, assets] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ code: where }, { name: where }] },
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.finding.findMany({
      where: { title: where },
      select: { id: true, title: true, severity: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.asset.findMany({
      where: {
        OR: [
          { hostname: { contains: q, mode: "insensitive" } },
          { ipAddress: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, hostname: true, ipAddress: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  return Response.json({
    query: q,
    engagements: engagements.map((p) => ({ id: p.id, title: p.code, subtitle: p.name })),
    findings: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity })),
    assets: assets.map((a) => ({
      id: a.id,
      title: a.hostname ?? a.ipAddress ?? a.id,
      subtitle: a.ipAddress ?? a.hostname ?? undefined,
    })),
  });
}
