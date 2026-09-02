import { cookies } from "next/headers";
import { CookieToast } from "@/components/ui/flash-cookie";

const OK_COOKIE = "vg_ok";
const ERR_COOKIE = "vg_err";

/**
 * Reads cookie-set flash (soft, same-page actions) and shows a toast. Cookie
 * deletion happens client-side (CookieToast) — Server Components may only READ
 * cookies, never modify them.
 */
export async function FlashCookie() {
  const cs = await cookies();
  const ok = cs.get(OK_COOKIE)?.value;
  const err = cs.get(ERR_COOKIE)?.value;
  if (!ok && !err) return null;
  return <CookieToast message={err ?? ok!} err={Boolean(err)} />;
}
