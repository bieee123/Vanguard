"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        aria-label="Sign out"
        title="Sign out"
        type="submit"
        className="btn btn-secondary px-2 py-1"
      >
        <LogOut size={16} />
      </button>
    </form>
  );
}
