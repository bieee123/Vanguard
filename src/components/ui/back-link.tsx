import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Uniform back-navigation button for edit/new/detail pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-secondary inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-xs"
    >
      <ArrowLeft size={13} />
      {children}
    </Link>
  );
}
