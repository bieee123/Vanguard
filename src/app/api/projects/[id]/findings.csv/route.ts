import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { csvRow } from "@/lib/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      findings: {
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        include: { assets: { include: { asset: true } } },
      },
    },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const rows = [
    csvRow(["Title", "Severity", "Status", "CVSS score", "CVSS vector", "CVE", "CWE", "ATT&CK techniques", "Affected assets"]),
    ...project.findings.map((f) =>
      csvRow([
        f.title,
        f.severity,
        f.status,
        f.cvssScore === null ? "" : Number(f.cvssScore).toString(),
        f.cvssVector ?? "",
        f.cve ?? "",
        f.cwe ?? "",
        f.attackTechniques.join(" "),
        f.assets.map((fa) => fa.asset.hostname ?? fa.asset.ipAddress ?? "").filter(Boolean).join("; "),
      ])
    ),
  ];

  return new Response("\uFEFF" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.code}-findings.csv"`,
    },
  });
}
