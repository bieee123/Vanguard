import { requireUser } from "@/lib/session";
import { Panel } from "@/components/ui/panel";
import { SecurityClient } from "./security-client";

export default async function SecurityPage() {
  const { user } = await requireUser();
  return (
    <Panel
      title="Multi-Factor Authentication"
      description="Email OTP is mandatory for all Vanguard accounts (PRD v2 §2)."
    >
      <SecurityClient enabled={Boolean(user.twoFactorEnabled)} />
    </Panel>
  );
}
