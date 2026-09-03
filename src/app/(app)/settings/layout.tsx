import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Settings</h1>
      <SettingsNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
