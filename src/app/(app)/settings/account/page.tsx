import { requireUser } from "@/lib/session";
import { Panel } from "@/components/ui/panel";
import { updateProfile } from "@/server/actions/users";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const { user } = await requireUser();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Profile">
        <form action={updateProfile} className="max-w-sm space-y-3">
          <div>
            <label className="label" htmlFor="name">
              Display name
            </label>
            <input id="name" name="name" required className="input" defaultValue={user.name} />
          </div>
          <div>
            <p className="label">Email</p>
            <p className="font-mono text-sm">{user.email}</p>
          </div>
          <button className="btn btn-primary">Save</button>
        </form>
        {/* ponytail: avatar upload deferred until StorageService exists (Sprint 2 evidence work) */}
      </Panel>

      <Panel title="Change Password">
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}
