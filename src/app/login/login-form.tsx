"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp" | "recovery">("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function fail(msg?: string | null) {
    setError(msg ?? "Authentication failed");
    setBusy(false);
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const id = identifier.trim();
    // usernames never contain "@", emails always do — route to the matching endpoint
    const res = id.includes("@")
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password });
    if (res.error) return fail(res.error.message || res.error.statusText);
    if ((res.data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
      const sent = await authClient.twoFactor.sendOtp();
      if (sent.error) return fail(sent.error.message || sent.error.statusText);
      setStep("otp");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      step === "recovery"
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyOtp({ code });
    if (res.error) return fail(res.error.message);
    router.push("/");
    router.refresh();
  }

  async function resend() {
    setBusy(true);
    const sent = await authClient.twoFactor.sendOtp();
    if (!sent.error) setError(null);
    setBusy(false);
  }

  return (
    <div className="w-full max-w-sm rounded-md border border-line-subtle bg-panel p-6">
      <h1 className="font-display text-lg font-bold tracking-widest">VANGUARD</h1>
      <p className="mb-5 mt-1 text-xs text-fg-muted">
        {step === "credentials"
          ? "Sign in to continue"
          : step === "otp"
            ? `Enter the 6-digit code sent to ${identifier}`
            : "Enter a recovery code"}
      </p>

      {error && (
        <div className="mb-3 rounded-sm bg-signal-dim px-3 py-2 text-xs text-signal">{error}</div>
      )}

      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="space-y-3">
          <div>
            <label className="label" htmlFor="email">
              Email or username
            </label>
            <input
              id="email"
              required
              autoComplete="username"
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button disabled={busy} className="btn btn-primary w-full justify-center">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="space-y-3">
          <input
            autoFocus
            required
            inputMode={step === "otp" ? "numeric" : undefined}
            placeholder={step === "otp" ? "000000" : "xxxxx-xxxxx"}
            className="input font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button disabled={busy} className="btn btn-primary w-full justify-center">
            {busy ? "Verifying…" : "Verify"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              className="text-blue hover:underline"
              onClick={() =>
                setStep((s) => (s === "otp" ? "recovery" : "otp"))
              }
            >
              {step === "otp" ? "Use recovery code" : "Use email code"}
            </button>
            {step === "otp" && (
              <button type="button" className="text-fg-muted hover:underline" onClick={resend}>
                Resend code
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
