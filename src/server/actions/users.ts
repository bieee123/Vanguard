"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";

const BACK = "/settings/users";

function str(fd: FormData, key: string, back = BACK): string {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) flashErr(back, `${key} is required`);
  return s;
}

export async function adminCreateUser(fd: FormData) {
  const { user } = await requireUser();
  let created: Awaited<ReturnType<typeof auth.api.createUser>>["user"] | undefined;
  try {
    created = (
      await auth.api.createUser({
        body: {
          email: str(fd, "email"),
          password: str(fd, "password"),
          name: str(fd, "name"),
        },
        headers: await headers(),
      })
    )?.user;
  } catch (e) {
    flashErr(BACK, e instanceof Error ? e.message : "Failed to create user");
  }
  // role defaults to admin via plugin config (PRD v2: single Admin role)
  const raw = fd.get("username");
  const username = typeof raw === "string" ? raw.trim() : "";
  if (created && username) {
    await prisma.user.update({
      where: { id: created.id },
      data: { username: username.toLowerCase(), displayUsername: username },
    });
  }
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "user",
    resourceId: created?.id ?? null,
    details: { email: created?.email, username: username || null },
  });
  await flashOk(BACK, `User ${created?.email ?? ""} created`);
}

export async function adminResetPassword(fd: FormData) {
  const { user } = await requireUser();
  const userId = str(fd, "userId");
  try {
    await auth.api.setUserPassword({
      body: { userId, newPassword: str(fd, "newPassword") },
      headers: await headers(),
    });
  } catch (e) {
    flashErr(BACK, e instanceof Error ? e.message : "Reset failed");
  }
  await audit({ userId: user.id, action: "reset_password", resourceType: "user", resourceId: userId });
  await flashOk(BACK, "Password reset");
}

export async function adminRemoveUser(fd: FormData) {
  const current = await requireUser();
  const userId = str(fd, "userId");
  if (userId === current.user.id) flashErr(BACK, "You cannot remove your own account");

  try {
    await auth.api.removeUser({ body: { userId }, headers: await headers() });
  } catch (e) {
    flashErr(BACK, e instanceof Error ? e.message : "Remove failed");
  }
  await audit({ userId: current.user.id, action: "delete", resourceType: "user", resourceId: userId });
  await flashOk(BACK, "User removed");
}

export async function updateProfile(fd: FormData) {
  const { user } = await requireUser();
  const name = str(fd, "name", "/settings/account");
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  await audit({
    userId: user.id,
    action: "update",
    resourceType: "user",
    resourceId: user.id,
    details: { before: { name: user.name }, after: { name } },
  });
  await flashOk("/settings/account", "Profile saved");
}
