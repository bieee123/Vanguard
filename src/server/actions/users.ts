"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${key} is required`);
  return s;
}

export async function adminCreateUser(fd: FormData) {
  const { user } = await requireUser();
  const created = await auth.api.createUser({
    body: {
      email: str(fd, "email"),
      password: str(fd, "password"),
      name: str(fd, "name"),
      // role defaults to admin via plugin config (PRD v2: single Admin role)
    },
    headers: await headers(),
  });
  // ponytail: username set via direct write — admin createUser endpoint doesn't take plugin fields
  const raw = fd.get("username");
  const username = typeof raw === "string" ? raw.trim() : "";
  if (created?.user && username) {
    await prisma.user.update({
      where: { id: created.user.id },
      data: { username: username.toLowerCase(), displayUsername: username },
    });
  }
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "user",
    resourceId: created?.user.id,
    details: { email: created?.user.email, username: username || null },
  });
  revalidatePath("/settings/users");
}

export async function adminResetPassword(fd: FormData) {
  const { user } = await requireUser();
  const userId = str(fd, "userId");
  await auth.api.setUserPassword({
    body: { userId, newPassword: str(fd, "newPassword") },
    headers: await headers(),
  });
  await audit({
    userId: user.id,
    action: "reset_password",
    resourceType: "user",
    resourceId: userId,
  });
  revalidatePath("/settings/users");
}

export async function adminRemoveUser(fd: FormData) {
  const current = await requireUser();
  const userId = str(fd, "userId");
  if (userId === current.user.id) throw new Error("You cannot remove your own account");

  await auth.api.removeUser({ body: { userId }, headers: await headers() });
  await audit({ userId: current.user.id, action: "delete", resourceType: "user", resourceId: userId });
  revalidatePath("/settings/users");
}

export async function updateProfile(fd: FormData) {
  const { user } = await requireUser();
  const name = str(fd, "name");
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  await audit({
    userId: user.id,
    action: "update",
    resourceType: "user",
    resourceId: user.id,
    details: { before: { name: user.name }, after: { name } },
  });
  revalidatePath("/settings/account");
}
