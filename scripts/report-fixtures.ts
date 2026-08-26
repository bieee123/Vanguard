// Creates minimal fixtures for the report smoke test and prints the report id.
// Usage: npx tsx scripts/report-fixtures.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  // ensure a user (report.createdBy is optional, but keep it realistic)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("Run scripts/seed-admin.ts first");
    process.exit(1);
  }

  let app = await prisma.application.findFirst();
  if (!app) {
    app = await prisma.application.create({
      data: { name: "Smoke Target App", criticality: "high", owningTeam: "QA" },
    });
  }

  let project = await prisma.project.findFirst({ where: { applicationId: app.id } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        code: "ENG-SMK",
        name: "Smoke Engagement",
        type: "internal_pentest",
        applicationId: app.id,
        ownerId: user.id,
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-30"),
      },
    });
  }

  const existing = await prisma.finding.count({ where: { projectId: project.id } });
  if (existing < 2) {
    await prisma.finding.createMany({
      data: [
        {
          projectId: project.id,
          title: "Stored XSS in comment form",
          severity: "high",
          cvssScore: 8.1,
          cvssVector: "AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N",
          description: "Comments render raw HTML.\n\n**Impact:** session theft.",
          mitigation: "Escape output; add CSP.",
          replication: "1. Post `<img src=x onerror=alert(1)>`\n2. View page",
          attackTechniques: ["T1059.007"],
          createdById: user.id,
        },
        {
          projectId: project.id,
          title: "Default credentials on admin panel",
          severity: "critical",
          cvssScore: 9.8,
          cvssVector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
          description: "admin:admin works.",
          mitigation: "Force rotation; disable defaults.",
          attackTechniques: ["T1078.001"],
          createdById: user.id,
        },
      ],
    });
  }

  const findings = await prisma.finding.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });

  let report = await prisma.report.findFirst({ where: { projectId: project.id } });
  if (!report) {
    report = await prisma.report.create({
      data: {
        projectId: project.id,
        title: "Smoke Report",
        execSummary: "Two issues found — **one critical**. Fix before release.",
        conclusion: "Retest scheduled after remediation.",
        createdById: user.id,
        findings: {
          create: findings.map((f, i) => ({
            sourceId: f.id,
            position: i + 1,
            title: f.title,
            severity: f.severity,
            status: f.status,
            cve: f.cve,
            cwe: f.cwe,
            cvssScore: f.cvssScore,
            cvssVector: f.cvssVector,
            description: f.description,
            mitigation: f.mitigation,
            replication: f.replication,
            attackTechniques: [...f.attackTechniques],
          })),
        },
      },
    });
    // hashPassword call kept so the script stays symmetric with seed-admin if extended
    void hashPassword;
  }

  console.log(JSON.stringify({ projectId: project.id, reportId: report.id }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
