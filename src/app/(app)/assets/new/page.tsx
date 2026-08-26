import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { createAsset } from "@/server/actions/assets";

const CRITICALITIES = ["critical", "high", "medium", "low", "unknown"] as const;
const STATUSES = ["unverified", "in_scope", "out_of_scope", "compromised", "not_compromised"] as const;

export default function NewAssetPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Asset</h1>
      <Panel>
        <form action={createAsset} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="hostname">
                Hostname
              </label>
              <input id="hostname" name="hostname" className="input font-mono" placeholder="web-01.corp.local" />
            </div>
            <div>
              <label className="label" htmlFor="ipAddress">
                IP address
              </label>
              <input id="ipAddress" name="ipAddress" className="input font-mono" placeholder="10.0.0.15" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="osFingerprint">
                OS / service fingerprint
              </label>
              <input id="osFingerprint" name="osFingerprint" className="input font-mono" />
            </div>
            <div>
              <label className="label" htmlFor="businessUnit">
                Business unit
              </label>
              <input id="businessUnit" name="businessUnit" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="criticality">
                Criticality
              </label>
              <select id="criticality" name="criticality" className="input" defaultValue="unknown">
                {CRITICALITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select id="status" name="status" className="input" defaultValue="unverified">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="discoveredBy">
                Discovered by
              </label>
              <input id="discoveredBy" name="discoveredBy" className="input" defaultValue="manual" />
            </div>
          </div>
          <button className="btn btn-primary">Create Asset</button>
        </form>
      </Panel>
      <Link href="/assets" className="text-xs text-fg-muted hover:underline">
        ← Back to assets
      </Link>
    </div>
  );
}
