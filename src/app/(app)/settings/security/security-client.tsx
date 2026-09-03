"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Email-OTP only. better-auth provisions backup/recovery codes only for the TOTP
 * (authenticator) flow — with method "otp" the twoFactor row is never created, so
 * generateBackupCodes always fails. Recovery codes therefore aren't offered here.
 */
export function SecurityClient({ enabled }: { enabled: boolean }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function done(ok: boolean, text: string) {
    setMsg({ ok, text });
    setBusy(false);
    setPassword("");
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.twoFactor.enable({ password, method: "otp" });
    if (res.error) return done(false, res.error.message ?? "Failed to enable");
    done(true, "Email OTP enabled — a 6-digit code will be emailed at every sign-in.");
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.twoFactor.disable({ password });
    if (res.error) return done(false, res.error.message ?? "Failed to disable");
    done(false, "2FA disabled — re-enable immediately.");
  }

  async function sendTest() {
    setBusy(true);
    const sent = await authClient.twoFactor.sendOtp();
    if (sent.error) return done(false, sent.error.message ?? "Send failed");
    done(true, "Code sent — check your inbox.");
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-sm px-3 py-2 text-xs ${msg.ok ? "bg-teal-dim text-teal" : "bg-signal-dim text-signal"}`}>
          {msg.text}
        </div>
      )}

      {enabled ? (
        <>
          <p className="text-sm text-fg-secondary">Status: email OTP active.</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={sendTest} className="btn btn-secondary">
              Send test code
            </button>
          </div>
          <form onSubmit={disable} className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
            <input
              type="password"
              required
              placeholder="Confirm password to disable"
              autoComplete="current-password"
              className="input w-full min-w-[16rem] flex-1 sm:w-auto"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button disabled={busy} className="btn btn-danger">
              Disable
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={enable} className="space-y-3">
          <p className="text-sm text-fg-secondary">
            Enable by confirming your password. A 6-digit code will be emailed at every sign-in.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              required
              placeholder="Password"
              autoComplete="current-password"
              className="input w-full min-w-[16rem] flex-1 sm:w-auto"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button disabled={busy} className="btn btn-primary">
              Enable Email OTP
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
