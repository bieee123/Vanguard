import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { adminCreateUser, adminRemoveUser, adminResetPassword } from "@/server/actions/users";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <Panel title="Users" description={`${users.length} accounts`}>
        <table className="table-dense">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>2FA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-fg-primary">{u.name}</td>
                <td className="font-mono text-xs">{u.email}</td>
                <td>{u.twoFactorEnabled ? "Yes" : "—"}</td>
                <td>
                  <form action={adminResetPassword} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      name="newPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="new password"
                      className="input w-32 py-0.5 text-xs"
                    />
                    <button className="btn btn-secondary px-1.5 py-0.5 text-xs">Reset</button>
                  </form>
                  <form action={adminRemoveUser} className="mt-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="btn btn-danger px-1.5 py-0.5 text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="New User">
        <form action={adminCreateUser} className="space-y-3">
          <div>
            <label className="label" htmlFor="name">
              Name *
            </label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input id="username" name="username" className="input font-mono" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email *
            </label>
            <input id="email" name="email" type="email" required className="input font-mono" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password *
            </label>
            <input id="password" name="password" type="password" required minLength={8} className="input" />
          </div>
          <button className="btn btn-primary">Create User</button>
        </form>
      </Panel>
    </div>
  );
}
