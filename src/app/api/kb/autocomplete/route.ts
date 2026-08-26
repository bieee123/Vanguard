import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json([], { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return Response.json([]);

  const notes = await prisma.note.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return Response.json(notes);
}
