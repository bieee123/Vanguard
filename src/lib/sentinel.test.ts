import { describe, expect, it, vi } from "vitest";
import { correlate, sentinelConfigured, pushAction } from "./sentinel";
import { mockCorrelate } from "./mock-sentinel";

const env = {
  SENTINEL_BASE_URL: "https://sentinel.internal",
  SENTINEL_READ_KEY: "sk-read-test",
  SENTINEL_WRITE_KEY: "sk-write-test",
};

describe("sentinel client", () => {
  it("reports configured only when base URL set", () => {
    vi.stubEnv("SENTINEL_BASE_URL", "https://sentinel.internal");
    vi.stubEnv("SENTINEL_READ_KEY", "sk");
    vi.stubEnv("SENTINEL_WRITE_KEY", "sk");
    expect(sentinelConfigured()).toBe(true);
    vi.stubEnv("SENTINEL_BASE_URL", undefined);
    expect(sentinelConfigured()).toBe(false);
  });

  it("retries 5xx then succeeds, sends idempotency key on POST", async () => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(init!);
      if (calls.length < 3) return new Response(null, { status: 500 });
      return Response.json({ id: "a1b2", accepted: true }, { status: 201 });
    }));

    const res = await pushAction({
      engagementId: "e1",
      assetId: "a1",
      techniqueId: "T1059.001",
      timestamp: "2026-08-26T00:00:00Z",
      actionDescription: "exec",
      outcome: "success",
    });

    expect(calls.length).toBe(3);
    const headers = calls[2]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-write-test");
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(res).toEqual({ id: "a1b2", accepted: true });
  });

  it("correlate falls back to the mock when unconfigured", async () => {
    vi.stubEnv("SENTINEL_BASE_URL", undefined);
    const r = await correlate("T1003.001", new Date("2026-08-01T00:00:00Z"), {});
    expect(r).toEqual(mockCorrelate("T1003.001", new Date("2026-08-01T00:00:00Z")));
  });
});
