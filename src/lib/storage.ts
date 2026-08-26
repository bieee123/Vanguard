import fs from "node:fs";
import path from "node:path";

// ponytail: local-disk storage behind these three functions — swap bodies to S3 without touching callers (PRD §4.2)
const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(path.resolve(ROOT))) throw new Error("Invalid storage key");
  return full;
}

export function saveFile(key: string, data: Buffer): void {
  const full = resolveKey(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

export function readFile(key: string): Buffer | null {
  try {
    return fs.readFileSync(resolveKey(key));
  } catch {
    return null;
  }
}

export function deleteFile(key: string): void {
  try {
    fs.unlinkSync(resolveKey(key));
  } catch {
    // already gone
  }
}

export function fileDataUri(key: string, mimeType: string): string | null {
  const data = readFile(key);
  return data ? `data:${mimeType};base64,${data.toString("base64")}` : null;
}
