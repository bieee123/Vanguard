import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const OK_COOKIE = "vg_ok";

function samePathname(referer: string | null, target: string): boolean {
  if (!referer) return false;
  try {
    const refPath = new URL(referer).pathname.replace(/\/+$/, "");
    const targetPath = target.split("?")[0].replace(/\/+$/, "");
    return refPath === targetPath;
  } catch {
    return false;
  }
}

async function currentReferer(): Promise<string | null> {
  try {
    return (await headers()).get("referer");
  } catch {
    return null;
  }
}

async function setFlash(cookie: string, message: string): Promise<void> {
  (await cookies()).set(cookie, message, { path: "/", maxAge: 5, sameSite: "lax" });
}

/**
 * Success feedback. When the caller is already on the target page we avoid
 * `redirect()` — a redirect from a plain server-action form causes a FULL page
 * reload (flash of blank + scroll to top). Instead we invalidate the page cache
 * (Next then soft-refreshes the current route in place) and surface a
 * cookie-based toast. Cross-page flows keep the redirect so the user lands on
 * the destination. Callers should `await flashOk(...)`.
 */
export async function flashOk(path: string, message: string): Promise<void> {
  if (samePathname(await currentReferer(), path)) {
    revalidatePath(path);
    await setFlash(OK_COOKIE, message);
    return;
  }
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

/**
 * Error feedback. Kept synchronous and throwing (redirect) so validation guards
 * can call it inside small sync helpers without awaiting — same semantics as the
 * original. Rare path, acceptable to navigate.
 */
export function flashErr(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(message)}`);
}
