// Sprint 4 smoke: wiki-links/backlinks/broken marker, embedding pipeline (graceful),
// keyword RAG fallback, DeTT&CT import from the docs fixture.
// Usage: npx tsx --env-file=.env scripts/smoke-kb.ts
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { extractWikiLinks } from "../src/lib/wiki";
import { parseDettctYaml } from "../src/lib/dettct";
import { embedNote } from "../src/server/kb/embedding";
import { askKb } from "../src/server/kb/rag";

const db = new PrismaClient();
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name}  ${detail}`);
    failures++;
  }
}

async function main() {
  const user = await db.user.findFirstOrThrow();

  // ── KB: notes + links ──────────────────────────────────────────────
  await db.note.deleteMany({ where: { title: { in: ["Smoke Nmap Basics", "Smoke Recon Playbook"] } } });
  const a = await db.note.create({
    data: { title: "Smoke Nmap Basics", bodyMarkdown: "Scan with `nmap -sV`.\n\nSee [[Smoke Recon Playbook]].", createdById: user.id },
  });
  const b = await db.note.create({
    data: { title: "Smoke Recon Playbook", bodyMarkdown: "Start with [[Smoke Nmap Basics]] then [[Totally Missing Note]]." },
  });

  // replicate action's sync logic (actions need request context)
  for (const [noteId, body] of [[a.id, a.bodyMarkdown], [b.id, b.bodyMarkdown]] as const) {
    await db.noteLink.deleteMany({ where: { sourceId: noteId } });
    for (const raw of extractWikiLinks(body)) {
      const target = await db.note.findFirst({ where: { title: raw } });
      await db.noteLink.create({ data: { sourceId: noteId, targetId: target?.id ?? null, targetTitleRaw: raw } });
    }
  }

  const backlinksB = await db.noteLink.count({ where: { targetId: b.id } });
  check("backlink resolved", backlinksB === 1);
  const broken = await db.noteLink.findFirst({ where: { sourceId: b.id, targetId: null } });
  check("broken link marked", broken?.targetTitleRaw === "Totally Missing Note");

  // ── M10: embedding pipeline graceful without provider ──────────────
  await embedNote(a.id);
  const chunks = await db.noteChunk.count({ where: { noteId: a.id } });
  check("chunks stored without provider", chunks > 0, `chunks=${chunks}`);
  const vectorless = await db.noteChunk.findFirst({ where: { noteId: a.id }, select: { embeddingJson: true } });
  check("no vectors in sources-only mode", vectorless?.embeddingJson === null);

  const rag = await askKb("nmap");
  check("keyword RAG finds note", rag.sources.some((s) => s.title === "Smoke Nmap Basics"), JSON.stringify(rag.sources));
  check("sources-only mode flagged", rag.mode === "sources-only" && rag.answer === null);

  // exclude_from_rag hides chunks+results
  await db.note.update({ where: { id: a.id }, data: { excludeFromRag: true } });
  await embedNote(a.id);
  const hidden = await db.noteChunk.count({ where: { noteId: a.id, excludeFromRag: false } });
  check("exclude-from-RAG respected", hidden === 0);
  const rag2 = await askKb("nmap");
  check("excluded note absent from results", !rag2.sources.some((s) => s.title === "Smoke Nmap Basics"));
  await db.note.update({ where: { id: a.id }, data: { excludeFromRag: false } });

  // ── M11: DeTT&CT import from docs fixture ──────────────────────────
  const yamlSource = fs.readFileSync("docs/samples/dettct_techniques.yaml", "utf8");
  const snap = parseDettctYaml(yamlSource);
  check("fixture parsed", snap.total === 4 && snap.covered === 3, `${snap.covered}/${snap.total}`);
  await db.dettctRun.deleteMany({ where: { filePath: { contains: "dettct_techniques.yaml" } } });
  const run = await db.dettctRun.create({
    data: {
      filePath: "docs/samples/dettct_techniques.yaml",
      runAt: snap.runAt,
      payload: snap.techniques as unknown as object[],
      totalTechniques: snap.total,
      coveredCount: snap.covered,
    },
  });
  check("snapshot persisted", run.coveredCount === 3);

  if (failures > 0) {
    console.error(`\nSMOKE FAILED: ${failures}`);
    process.exit(1);
  }
  console.log("\nSMOKE OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
