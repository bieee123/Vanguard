import { redirect } from "next/navigation";

/** Redirect back with a success flash in the query string (?ok=). */
export function flashOk(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

/** Redirect back with an error flash (?err=). Replaces thrown validation errors. */
export function flashErr(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(message)}`);
}
