"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      aria-label="Sign out"
      title="Sign out"
      className="btn btn-secondary px-2 py-1"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
      }}
    >
      <LogOut size={16} />
    </button>
  );
}
