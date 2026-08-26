import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { ApplicationForm } from "../_components/application-form";

export default function NewApplicationPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Application</h1>
      <Panel>
        <ApplicationForm />
      </Panel>
      <Link href="/applications" className="text-xs text-fg-muted hover:underline">
        ← Back to applications
      </Link>
    </div>
  );
}
