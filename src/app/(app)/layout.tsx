import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={user.name} />
        <main className="app-canvas min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
