import { marked } from "marked";

export interface TemplateFinding {
  position: number;
  title: string;
  severity: string;
  status: string;
  cve?: string | null;
  cwe?: string | null;
  cvssScore?: number | null;
  cvssVector?: string | null;
  description?: string | null;
  mitigation?: string | null;
  replication?: string | null;
  attackTechniques: string[];
}

export interface TemplateReport {
  code: string;
  name: string;
  applicationName: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#B42318",
  high: "#D92D20",
  medium: "#B54708",
  low: "#8A6116",
  info: "#667085",
};

function md(source?: string | null): string {
  if (!source) return "";
  // ponytail: trusted internal content rendered into a print PDF, no sanitizer
  return marked.parse(source, { async: false });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderReportHtml(
  report: { title: string; version: number; generatedAt: Date; execSummary?: string | null; conclusion?: string | null },
  engagement: TemplateReport,
  findings: TemplateFinding[],
  evidenceImages: { caption?: string | null; dataUri: string }[]
): string {
  const today = report.generatedAt.toISOString().slice(0, 10);
  const findingBlocks = findings
    .map((f) => {
      const color = SEVERITY_COLOR[f.severity] ?? "#667085";
      const meta = [
        f.cve ? `CVE ${esc(f.cve)}` : null,
        f.cwe ? `CWE ${esc(f.cwe)}` : null,
        f.cvssScore !== null && f.cvssScore !== undefined ? `CVSS ${f.cvssScore}${f.cvssVector ? ` (${esc(f.cvssVector)})` : ""}` : null,
        f.attackTechniques.length ? `ATT&CK ${f.attackTechniques.map(esc).join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" &nbsp;·&nbsp; ");
      return `
      <section class="finding">
        <div class="finding-head">
          <span class="pos">F-${String(f.position).padStart(3, "0")}</span>
          <h3>${esc(f.title)}</h3>
          <span class="sev" style="background:${color}">${esc(f.severity)}</span>
        </div>
        ${meta ? `<p class="meta">${meta}</p>` : ""}
        ${f.description ? `<h4>Description</h4><div class="md">${md(f.description)}</div>` : ""}
        ${f.replication ? `<h4>Replication steps</h4><div class="md mono">${md(f.replication)}</div>` : ""}
        ${f.mitigation ? `<h4>Remediation</h4><div class="md">${md(f.mitigation)}</div>` : ""}
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #101828; line-height: 1.55; margin: 0; }
  .page { padding: 48px 56px; }
  h1 { font-size: 24pt; margin: 0 0 4px; }
  h2 { font-size: 15pt; border-bottom: 2px solid #B42318; padding-bottom: 6px; margin-top: 40px; }
  h3 { font-size: 12pt; margin: 0; }
  h4 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: .06em; color: #475467; margin: 16px 0 4px; }
  .cover { background: #101828; color: #fff; padding: 96px 56px; }
  .cover .brand { letter-spacing: .35em; font-size: 11pt; color: #F97066; font-weight: 700; }
  .cover h1 { color: #fff; margin-top: 12px; }
  .cover .sub { color: #98A2B3; margin-top: 8px; }
  .cover table { margin-top: 40px; color: #EAECF0; font-size: 10pt; }
  .cover td { padding: 3px 18px 3px 0; }
  .cover td:first-child { color: #98A2B3; }
  .finding { border: 1px solid #E4E7EC; border-radius: 8px; padding: 16px 20px; margin: 14px 0; page-break-inside: avoid; }
  .finding-head { display: flex; align-items: baseline; gap: 12px; }
  .pos { font-family: Consolas, monospace; color: #475467; }
  .sev { color: #fff; border-radius: 4px; padding: 2px 10px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; }
  .meta { font-family: Consolas, monospace; font-size: 8.5pt; color: #475467; margin: 6px 0 0; }
  .md p { margin: 4px 0; } .md pre { background: #F2F4F7; padding: 10px; border-radius: 6px; overflow-x: auto; }
  .mono pre { font-family: Consolas, monospace; font-size: 9pt; }
  .evidence img { max-width: 100%; border: 1px solid #E4E7EC; border-radius: 6px; margin-top: 8px; }
  .caption { font-size: 8.5pt; color: #667085; }
</style>
</head>
<body>
  <div class="cover">
    <div class="brand">VANGUARD · RED TEAM OPERATIONS</div>
    <h1>${esc(report.title)}</h1>
    <div class="sub">v${report.version} · ${today}</div>
    <table>
      <tr><td>Engagement</td><td>${esc(engagement.code)} — ${esc(engagement.name)}</td></tr>
      <tr><td>Application</td><td>${esc(engagement.applicationName)}</td></tr>
      <tr><td>Period</td><td>${engagement.startDate?.toISOString().slice(0, 10) ?? "?"} → ${engagement.endDate?.toISOString().slice(0, 10) ?? "?"}</td></tr>
      <tr><td>Findings</td><td>${findings.length}</td></tr>
    </table>
  </div>
  <div class="page">
    ${report.execSummary ? `<h2>Executive Summary</h2><div class="md">${md(report.execSummary)}</div>` : ""}
    <h2>Detailed Findings</h2>
    ${findings.length ? findingBlocks : "<p>No findings were included in this report.</p>"}
    ${evidenceImages.length ? `<h2>Evidence</h2>${evidenceImages.map((e) => `<div class="evidence"><img src="${e.dataUri}" />${e.caption ? `<p class="caption">${esc(e.caption)}</p>` : ""}</div>`).join("")}` : ""}
    ${report.conclusion ? `<h2>Conclusion</h2><div class="md">${md(report.conclusion)}</div>` : ""}
  </div>
</body>
</html>`;
}
