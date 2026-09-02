"use client";

import { useRouter } from "next/navigation";

/** Table row that navigates on click (whole row is the link target). */
export function ClickableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-hover ${className}`}
      onClick={() => router.push(href)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
