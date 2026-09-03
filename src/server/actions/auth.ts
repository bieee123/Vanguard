"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Server-side sign out: revoke the session in DB, clear the cookie, land on /login. */
export async function logoutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // session may already be invalid — still clear the cookie below
  }
  const cs = await cookies();
  cs.delete("better-auth.session_token");
  redirect("/login");
}
