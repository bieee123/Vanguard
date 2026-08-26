import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { readFile } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".log": "text/plain",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = await prisma.evidence.findUnique({ where: { id }, select: { filePath: true } });
  if (!row) return new Response("Not found", { status: 404 });

  const data = readFile(row.filePath);
  if (!data) return new Response("File missing from storage", { status: 410 });

  const ext = row.filePath.slice(row.filePath.lastIndexOf(".")).toLowerCase();
  const name = row.filePath.split("/").pop() ?? "evidence";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
