import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

export async function audit(entry: {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    // outside request context (seed/scripts) — fine, IP optional
  }
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      details: entry.details,
      ipAddress: ip,
    },
  });
}
