import { prisma } from "@/lib/db";
import { saveFile, fileDataUri } from "@/lib/storage";
import type { TemplateFinding } from "./template";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// ponytail: one browser reused across queued generations — launching Chromium per
// job is the slowest part (~seconds of cold start). Browser is process-lifetime.
type BrowserHandle = { browser: import("playwright").Browser };
let browserPromise: Promise<BrowserHandle> | null = null;

async function getBrowser(): Promise<BrowserHandle> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      return { browser };
    })().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/** Renders the report PDF via headless Chromium and stores it. Runs inside the worker process. */
export async function generateReportPdf(reportId: string): Promise<void> {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: "generating" },
    include: {
      project: { include: { application: true } },
      findings: { orderBy: { position: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
    },
  });

  try {
    const { browser } = await getBrowser();

    const findings: TemplateFinding[] = report.findings.map((f) => ({
      position: f.position,
      title: f.title,
      severity: f.severity,
      status: f.status,
      cve: f.cve,
      cwe: f.cwe,
      cvssScore: f.cvssScore === null ? null : Number(f.cvssScore),
      cvssVector: f.cvssVector,
      description: f.description,
      mitigation: f.mitigation,
      replication: f.replication,
      attackTechniques: f.attackTechniques,
    }));

    const images = report.evidence
      .map((e) => {
        const ext = e.filePath.slice(e.filePath.lastIndexOf(".")).toLowerCase();
        const mime = IMAGE_MIME[ext];
        if (!mime) return null;
        const dataUri = fileDataUri(e.filePath, mime);
        return dataUri ? { caption: e.caption, dataUri } : null;
      })
      .filter((x): x is { caption: string | null; dataUri: string } => x !== null);

    // ponytail: template is a plain string renderer — no React runtime needed in the worker
    const { renderReportHtml } = await import("./template");
    const finalHtml = renderReportHtml(
      {
        title: report.title,
        version: report.version,
        generatedAt: new Date(),
        execSummary: report.execSummary,
        conclusion: report.conclusion,
      },
      {
        code: report.project.code,
        name: report.project.name,
        applicationName: report.project.application.name,
        startDate: report.project.startDate,
        endDate: report.project.endDate,
      },
      findings,
      images
    );

    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });

    const key = `reports/${report.id}.pdf`;
    saveFile(key, Buffer.from(pdf));

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "generated", filePath: key, generatedAt: new Date() },
    });
  } catch (err) {
    await prisma.report.update({ where: { id: reportId }, data: { status: "failed" } });
    throw err;
  }
}
