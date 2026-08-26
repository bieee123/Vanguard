"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the page while the report PDF job is in flight. */
export function GenerationPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
