"use client";

import { useEffect, useState } from "react";

const OK_COOKIE = "vg_ok";
const ERR_COOKIE = "vg_err";

/** Toast rendered from flash cookies; clears the cookie after showing. */
export function CookieToast({ message, err }: { message: string; err?: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Server Components can't delete cookies, so clear here client-side.
    document.cookie = `${OK_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${ERR_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded-sm px-3 py-2 text-xs font-medium shadow-lg ${
        err ? "bg-signal-dim text-signal border border-signal" : "bg-teal-dim text-teal border border-teal"
      }`}
    >
      {message}
    </div>
  );
}
