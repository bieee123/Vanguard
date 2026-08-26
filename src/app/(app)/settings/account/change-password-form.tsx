"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setMsg(
      res.error
        ? { ok: false, text: res.error.message ?? "Failed" }
        : { ok: true, text: "Password changed" }
    );
    if (!res.error) {
      setCurrent("");
      setNew("");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      {msg && (
        <div className={`rounded-sm px-3 py-2 text-xs ${msg.ok ? "bg-teal-dim text-teal" : "bg-signal-dim text-signal"}`}>
          {msg.text}
        </div>
      )}
      <div>
        <label className="label" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="input"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
        />
      </div>
      <button disabled={busy} className="btn btn-primary">
        Change password
      </button>
    </form>
  );
}
