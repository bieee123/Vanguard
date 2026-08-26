"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SecurityClient({ enabled }: { enabled: boolean }) {
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function fail(text: string) {
    setMsg({ ok: false, text });
    setBusy(false);
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.twoFactor.enable({ password, method: "otp" });
    if (res.error) return fail(res.error.message ?? "Failed to enable");
    const gen = await authClient.twoFactor.generateBackupCodes({ password });
    if (gen.error || !gen.data?.backupCodes) return fail("Enabled, but backup code generation failed");
    setCodes(gen.data.backupCodes);
    setMsg({ ok: true, text: "Email OTP enabled. Save your recovery codes now." });
    setPassword("");
    setBusy(false);
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.twoFactor.disable({ password });
    if (res.error) return fail(res.error.message ?? "Failed to disable");
    setMsg({ ok: false, text: "2FA disabled — re-enable immediately." });
    setPassword("");
    setBusy(false);
  }

  async function regenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const gen = await authClient.twoFactor.generateBackupCodes({ password });
    if (gen.error || !gen.data?.backupCodes) return fail("Wrong password");
    setCodes(gen.data.backupCodes);
    setPassword("");
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const sent = await authClient.twoFactor.sendOtp();
    setMsg(
      sent.error
        ? { ok: false, text: sent.error.message ?? "Send failed" }
        : { ok: true, text: "Code sent — check your inbox." }
    );
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-sm px-3 py-2 text-xs ${msg.ok ? "bg-teal-dim text-teal" : "bg-signal-dim text-signal"}`}>
          {msg.text}
        </div>
      )}

      {codes && (
        <div className="rounded-sm border border-line-default bg-raised p-3">
          <p className="label">Recovery codes (shown once)</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
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
          <form onSubmit={disable} className="flex gap-2 border-t border-line-subtle pt-4">
            <input
              type="password"
              required
              placeholder="Confirm password to disable"
              autoComplete="current-password"
              className="input max-w-xs"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button disabled={busy} className="btn btn-danger">
              Disable
            </button>
          </form>
          <form onSubmit={regenerate} className="flex gap-2 border-t border-line-subtle pt-4">
            <input
              type="password"
              required
              placeholder="Confirm password to regenerate recovery codes"
              autoComplete="current-password"
              className="input max-w-xs"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button disabled={busy} className="btn btn-secondary">
              Regenerate codes
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={enable} className="space-y-3">
          <p className="text-sm text-fg-secondary">
            Enable by confirming your password. A 6-digit code will be emailed at every sign-in.
          </p>
          <input
            type="password"
            required
            placeholder="Password"
            autoComplete="current-password"
            className="input max-w-xs"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy} className="btn btn-primary">
            Enable Email OTP
          </button>
        </form>
      )}
    </div>
  );
}
