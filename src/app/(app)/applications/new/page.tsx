import { BackLink } from "@/components/ui/back-link";
import { Panel } from "@/components/ui/panel";
import { ApplicationForm } from "../_components/application-form";

export default function NewApplicationPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Application</h1>
      <Panel>
        <ApplicationForm />
      </Panel>
      <BackLink href="/applications">Back to applications</BackLink>
    </div>
  );
}
