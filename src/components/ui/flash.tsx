"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * CRUD feedback toast read from ?ok= / ?err= query params (server actions redirect with them).
 * Auto-dismisses and strips the params from the URL so refresh doesn't replay it.
 */
export function FlashMessage() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const err = params.get("err");
  const [visible, setVisible] = useState(Boolean(ok || err));

  useEffect(() => {
    if (!ok && !err) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 4000);
    // strip params so refresh/back doesn't replay the toast
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    url.searchParams.delete("err");
    window.history.replaceState({}, "", url.toString());
    return () => clearTimeout(hide);
  }, [ok, err]);

  if (!visible || (!ok && !err)) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded-sm px-3 py-2 text-xs font-medium shadow-lg ${
        err ? "bg-signal-dim text-signal border border-signal" : "bg-teal-dim text-teal border border-teal"
      }`}
    >
      {err ?? ok}
    </div>
  );
}
