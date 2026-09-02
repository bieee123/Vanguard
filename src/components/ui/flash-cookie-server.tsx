import { cookies } from "next/headers";
import { CookieToast } from "@/components/ui/flash-cookie";

const OK_COOKIE = "vg_ok";
const ERR_COOKIE = "vg_err";

/** Reads cookie-set flash (soft, same-page actions), clears it, shows a toast. */
export async function FlashCookie() {
  const cs = await cookies();
  const ok = cs.get(OK_COOKIE)?.value;
  const err = cs.get(ERR_COOKIE)?.value;
  if (!ok && !err) return null;
  if (ok) cs.delete(OK_COOKIE);
  if (err) cs.delete(ERR_COOKIE);
  return <CookieToast message={err ?? ok!} err={Boolean(err)} />;
}
