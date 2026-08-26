"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { flashErr, flashOk } from "@/lib/flash";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function createAsset(fd: FormData) {
  const { user } = await requireUser();
  const hostname = str(fd, "hostname");
  const ipAddress = str(fd, "ipAddress");
  if (!hostname && !ipAddress) flashErr("/assets/new", "Hostname or IP address is required");

  const asset = await prisma.asset.create({
    data: {
      hostname,
      ipAddress,
      osFingerprint: str(fd, "osFingerprint"),
      businessUnit: str(fd, "businessUnit"),
      criticality: (str(fd, "criticality") ?? "unknown") as never,
      status: (str(fd, "status") ?? "unverified") as never,
      discoveredBy: str(fd, "discoveredBy") ?? "manual",
    },
  });
  await audit({
    userId: user.id,
    action: "create",
    resourceType: "asset",
    resourceId: asset.id,
    details: { hostname, ipAddress },
  });
  flashOk(`/assets/${asset.id}`, "Asset created");
}

export async function updateAsset(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) flashErr("/assets", "Missing id");
  const hostname = str(fd, "hostname");
  const ipAddress = str(fd, "ipAddress");
  if (!hostname && !ipAddress) flashErr("/assets", "Hostname or IP address is required");

  await prisma.asset.update({
    where: { id },
    data: {
      hostname,
      ipAddress,
      osFingerprint: str(fd, "osFingerprint"),
      businessUnit: str(fd, "businessUnit"),
      criticality: (str(fd, "criticality") ?? "unknown") as never,
      status: (str(fd, "status") ?? "unverified") as never,
      discoveredBy: str(fd, "discoveredBy"),
      sentinelAssetId: str(fd, "sentinelAssetId"),
    },
  });
  await audit({ userId: user.id, action: "update", resourceType: "asset", resourceId: id });
  revalidatePath("/assets");
  flashOk(/assets/+id, "Saved");
}

export async function deleteAsset(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id") as string;
  if (!id) throw new Error("Missing id");
  await prisma.asset.delete({ where: { id } });
  await audit({ userId: user.id, action: "delete", resourceType: "asset", resourceId: id });
  flashOk("/assets", "Asset deleted");
}

export async function linkAssetToEngagement(fd: FormData) {
  const { user } = await requireUser();
  const assetId = str(fd, "assetId");
  const projectId = str(fd, "projectId");
  if (!assetId || !projectId) flashErr("/assets", "Missing fields");
  await prisma.engagementAsset.create({ data: { assetId, projectId } }).catch(() => {
    // already linked (composite PK) â€” idempotent
  });
  await audit({
    userId: user.id,
    action: "link_asset",
    resourceType: "engagement",
    resourceId: projectId,
    details: { assetId },
  });
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/engagements/${projectId}`);
}

export async function unlinkAssetFromEngagement(fd: FormData) {
  const { user } = await requireUser();
  const assetId = str(fd, "assetId");
  const projectId = str(fd, "projectId");
  if (!assetId || !projectId) flashErr("/assets", "Missing fields");
  await prisma.engagementAsset.delete({
    where: { projectId_assetId: { projectId, assetId } },
  });
  await audit({
    userId: user.id,
    action: "unlink_asset",
    resourceType: "engagement",
    resourceId: projectId,
    details: { assetId },
  });
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/engagements/${projectId}`);
}
