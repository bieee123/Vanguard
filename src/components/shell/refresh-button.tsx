"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  return (
    <button
      aria-label="Refresh data"
      title="Refresh"
      onClick={() => router.refresh()}
      className="rounded-sm p-1 text-fg-secondary hover:bg-hover hover:text-fg-primary"
    >
      <RefreshCw size={15} />
    </button>
  );
}
