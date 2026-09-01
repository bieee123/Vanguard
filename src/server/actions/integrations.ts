"use server";

import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { healthProbe, sentinelConfig } from "@/lib/sentinel";

export async function testSentinelConnection() {
  await requireUser();
  const cfg = sentinelConfig();
  if (!cfg) {
    flashErr("/settings/integrations", "Sentinel not configured");
    return;
  }
  const { ok, message } = await healthProbe();
  if (ok) flashOk("/settings/integrations", `Connected — ${message}`);
  else flashErr("/settings/integrations", `Connection failed — ${message}`);
}
