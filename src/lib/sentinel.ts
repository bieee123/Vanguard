// Sentinel SOC middleware client (Sprint 5). Reads env like ai.ts; every call
// degrades to the deterministic mock when unconfigured so dev/demos keep working.

import { mockCorrelate, type MockAlert, type MockVerdict } from "@/lib/mock-sentinel";

export interface SentinelConfig {
  baseUrl: string;
  readKey: string;
  writeKey: string;
}

export function sentinelConfig(): SentinelConfig | null {
  const baseUrl = process.env.SENTINEL_BASE_URL;
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    readKey: process.env.SENTINEL_READ_KEY ?? "",
    writeKey: process.env.SENTINEL_WRITE_KEY ?? "",
  };
}

export function sentinelConfigured(): boolean {
  return sentinelConfig() !== null;
}

// ponytail: fixed 3 attempts, no jitter — enough for transient 429/5xx blips.
// Add jitter + retry-after honor if Sentinel proves flaky in production.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown = new Error("Sentinel unreachable");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status < 500) return res;
      lastErr = new Error(`Sentinel ${res.status} on ${init.method} ${url}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Sentinel unreachable");
}

async function request(
  method: string,
  path: string,
  opts: { key: string; body?: unknown }
): Promise<{ status: number; json: unknown }> {
  const cfg = sentinelConfig();
  if (!cfg) throw new Error("Sentinel not configured");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.key}`,
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Idempotency-Key"] = crypto.randomUUID();
    body = JSON.stringify(opts.body);
  }
  const res = await fetchWithRetry(`${cfg.baseUrl}${path}`, { method, headers, body });
  const json: unknown = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function healthProbe(): Promise<{ ok: boolean; message: string }> {
  const cfg = sentinelConfig();
  if (!cfg) return { ok: false, message: "Not configured — set SENTINEL_BASE_URL" };
  const res = await fetchWithRetry(`${cfg.baseUrl}/api/v1/health`, { method: "GET" });
  const json = (await res.json().catch(() => null)) as { status?: string; service?: string } | null;
  if (res.ok && json?.status === "ok") return { ok: true, message: `${json.service ?? "Sentinel"} reachable` };
  return { ok: false, message: `health ${res.status}: ${JSON.stringify(json)}` };
}

export async function pollAlerts(params: {
  asset: string;
  from: string;
  to?: string;
  techniqueId?: string;
}): Promise<unknown[]> {
  const q = new URLSearchParams({ asset: params.asset, from: params.from });
  if (params.to) q.set("to", params.to);
  if (params.techniqueId) q.set("technique_id", params.techniqueId);
  const { status, json } = await request("GET", `/api/v1/soc/alerts?${q}`, { key: configKey("read") });
  if (status >= 400) throw new Error(`alerts ${status}`);
  return ((json as { alerts?: unknown[] })?.alerts) ?? [];
}

export async function pushAction(payload: {
  engagementId: string;
  assetId: string;
  techniqueId: string;
  timestamp: string;
  actionDescription: string;
  outcome: string;
}): Promise<unknown> {
  const { status, json } = await request("POST", "/api/v1/redteam/actions", {
    key: configKey("write"),
    body: {
      engagement_id: payload.engagementId,
      asset_id: payload.assetId,
      technique_id: payload.techniqueId,
      timestamp: payload.timestamp,
      action_description: payload.actionDescription,
      outcome: payload.outcome,
    },
  });
  if (status >= 400) throw new Error(`pushAction ${status}`);
  return json;
}

export async function pushFinding(payload: {
  engagementId: string;
  assetId: string;
  severity: string;
  title: string;
  description?: string;
  techniqueIds?: string[];
}): Promise<unknown> {
  const { status, json } = await request("POST", "/api/v1/redteam/findings", {
    key: configKey("write"),
    body: {
      engagement_id: payload.engagementId,
      asset_id: payload.assetId,
      severity: payload.severity,
      title: payload.title,
      description: payload.description,
      technique_ids: payload.techniqueIds,
    },
  });
  if (status >= 400) throw new Error(`pushFinding ${status}`);
  return json;
}

export async function submitRuleRequest(payload: {
  engagementId: string;
  findingId: string;
  techniqueId: string;
  ruleJson: unknown;
  rationale: string;
  priority?: string;
}): Promise<unknown> {
  const { status, json } = await request("POST", "/api/v1/redteam/rule-requests", {
    key: configKey("write"),
    body: {
      engagement_id: payload.engagementId,
      finding_id: payload.findingId,
      technique_id: payload.techniqueId,
      rule_json: payload.ruleJson,
      rationale: payload.rationale,
      priority: payload.priority,
    },
  });
  if (status >= 400) throw new Error(`submitRuleRequest ${status}`);
  return json;
}

export async function pollRuleStatus(id: string): Promise<unknown> {
  const { status, json } = await request("GET", `/api/v1/soc/rule-requests/${id}/status`, {
    key: configKey("read"),
  });
  if (status >= 400) throw new Error(`rule status ${status}`);
  return json;
}

export async function submitRetest(id: string, payload: { verdict: string; testDetails: string }): Promise<unknown> {
  const { status, json } = await request("POST", `/api/v1/redteam/rule-requests/${id}/retest`, {
    key: configKey("write"),
    body: { verdict: payload.verdict, test_details: payload.testDetails, tested_at: new Date().toISOString() },
  });
  if (status >= 400) throw new Error(`retest ${status}`);
  return json;
}

function configKey(scope: "read" | "write"): string {
  const cfg = sentinelConfig();
  if (!cfg) throw new Error("Sentinel not configured");
  return scope === "read" ? cfg.readKey : cfg.writeKey;
}

/**
 * Correlate a timeline entry against Sentinel when configured; otherwise fall
 * back to the deterministic mock. Verdict shape matches mockCorrelate so callers
 * are unchanged.
 */
export async function correlate(
  techniqueId: string,
  entryTimestamp: Date,
  opts: { engagementId?: string | null; assetId?: string | null; description?: string }
): Promise<{ verdict: MockVerdict; alert: MockAlert | null }> {
  if (!sentinelConfigured()) return mockCorrelate(techniqueId, entryTimestamp);

  if (opts.engagementId && opts.assetId) {
    await pushAction({
      engagementId: opts.engagementId,
      assetId: opts.assetId,
      techniqueId,
      timestamp: entryTimestamp.toISOString(),
      actionDescription: opts.description ?? `ATT&CK ${techniqueId}`,
      outcome: "success",
    });
  }

  const alerts = await pollAlerts({
    asset: opts.assetId ?? techniqueId,
    from: new Date(entryTimestamp.getTime() - 5 * 60 * 1000).toISOString(),
    to: new Date(entryTimestamp.getTime() + 15 * 60 * 1000).toISOString(),
    techniqueId,
  });

  const first = alerts[0] as
    | { id?: string; rule_name?: string; timestamp?: string; detection_delay_seconds?: number }
    | undefined;
  if (!first) return { verdict: "not_detected", alert: null };
  const delay = first.detection_delay_seconds ?? 0;
  return {
    verdict: delay > 300 ? "detected_late" : "detected",
    alert: {
      alertId: first.id ?? "unknown",
      ruleName: first.rule_name ?? `Sentinel rule for ${techniqueId}`,
      delaySeconds: delay,
      detectedAt: new Date(first.timestamp ?? entryTimestamp.getTime() + delay * 1000),
    },
  };
}
