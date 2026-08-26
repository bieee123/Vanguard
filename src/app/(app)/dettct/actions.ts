"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

export async function deleteRun(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");
  await prisma.dettctRun.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "dettct_run", resourceId: id });
  revalidatePath("/dettct");
}
