"use server";

import { revalidatePath } from "next/cache";
import { readFile } from "@/lib/storage";
import { saveFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";
import { parseDettctYaml } from "@/lib/dettct";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Import a DeTT&CT techniques-administration YAML.
 * Accepts either an uploaded file or an absolute path produced by the external scheduled job
 * (PRD M11: DeTT&CT runs externally and writes YAML; Vanguard only reads it).
 */
export async function importDettctRun(fd: FormData) {
  const { user } = await requireUser();
  let source: string | null = null;
  let storedKey: string | null = null;
  let runAt = new Date();

  const file = fd.get("file") as File | null;
  const pathInput = str(fd, "path");

  if (file && file.size > 0) {
    source = await file.text();
    storedKey = `dettct/${crypto.randomUUID()}.yaml`;
    saveFile(storedKey, Buffer.from(await file.arrayBuffer()));
  } else if (pathInput) {
    // ponytail: direct fs read of an operator-provided path â€” trusted internal tool
    try {
      source = readFile(pathInput)?.toString("utf8") ?? null;
    } catch {
      source = null;
    }
    storedKey = pathInput;
  }
  if (!source) flashErr("/dettct", "Provide a YAML upload or a readable path");

  let snap;
  try {
    snap = parseDettctYaml(source);
  } catch (e) {
    flashErr("/dettct", e instanceof Error ? e.message : "Invalid YAML");
  }
  const yamlDate = snap.runAt;
  if (!Number.isNaN(yamlDate.getTime())) runAt = yamlDate;

  const run = await prisma.dettctRun.create({
    data: {
      filePath: storedKey!,
      runAt,
      payload: snap.techniques as unknown as object[],
      totalTechniques: snap.total,
      coveredCount: snap.covered,
    },
  });
  await audit({
    userId: user.id,
    action: "import",
    resourceType: "dettct_run",
    resourceId: run.id,
    details: { covered: `${snap.covered}/${snap.total}`, name: snap.name },
  });
  revalidatePath("/dettct");
  await flashOk("/dettct", `Imported: ${snap.covered}/${snap.total} techniques covered`);
}
