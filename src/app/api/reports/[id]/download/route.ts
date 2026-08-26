import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { readFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id }, select: { filePath: true, title: true } });
  if (!report?.filePath) return new Response("Not found", { status: 404 });

  const data = readFile(report.filePath);
  if (!data) return new Response("File missing from storage", { status: 410 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(report.title)}.pdf"`,
    },
  });
}
