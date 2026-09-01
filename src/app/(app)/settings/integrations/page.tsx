import { sentinelConfig } from "@/lib/sentinel";
import { testSentinelConnection } from "@/server/actions/integrations";
import { Panel } from "@/components/ui/panel";

function mask(key: string): string {
  return key ? `${key.slice(0, 6)}…${key.slice(-4)}` : "not set";
}

export default function IntegrationsSettingsPage() {
  const cfg = sentinelConfig();

  return (
    <div className="space-y-4">
      <Panel title="Sentinel (SOC middleware)">
        <p className="mb-3 text-xs text-fg-muted">
          Base URL + scoped keys are read from environment (<code>SENTINEL_BASE_URL</code>,{" "}
          <code>SENTINEL_READ_KEY</code>, <code>SENTINEL_WRITE_KEY</code>). The read key powers alert
          polling, the write key pushes actions/findings/rule requests. Both follow the{" "}
          <code>VANGUARD-INTEGRATION.md</code> contract.
        </p>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-fg-muted">Base URL</dt>
            <dd>{cfg?.baseUrl ?? <span className="text-amber-400">not set</span>}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-fg-muted">Read key</dt>
            <dd>{cfg?.readKey ? mask(cfg.readKey) : <span className="text-amber-400">not set</span>}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-fg-muted">Write key</dt>
            <dd>{cfg?.writeKey ? mask(cfg.writeKey) : <span className="text-amber-400">not set</span>}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-fg-muted">Status</dt>
            <dd>{cfg ? <span className="text-emerald-400">configured</span> : <span className="text-amber-400">unconfigured</span>}</dd>
          </div>
        </dl>
        <form action={testSentinelConnection} className="mt-4 border-t border-line-subtle pt-3">
          <button className="btn btn-secondary" disabled={!cfg}>
            Test connection
          </button>
        </form>
      </Panel>
    </div>
  );
}
