import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { AiAskPanel } from "@/components/ai/ask-ai-panel";
import { FlashMessage } from "@/components/ui/flash";
import { FlashCookie } from "@/components/ui/flash-cookie-server";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const modelLabel = process.env.AI_CHAT_MODEL ?? null;
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={user.name} />
        <main className="app-canvas min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Suspense>
        <AiAskPanel modelLabel={modelLabel} />
      </Suspense>
      <Suspense>
        <FlashMessage />
      </Suspense>
      <FlashCookie />
    </div>
  );
}
