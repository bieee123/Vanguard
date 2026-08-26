import { parse } from "yaml";

// DeTT&CT techniques-administration YAML reader (M11).
// Vanguard only reads the tool's output file — no DeTT&CT logic is reimplemented.

export interface DettctTechnique {
  techniqueId: string;
  techniqueName: string;
  detectionScore: number; // latest score in the logbook
  visibilityScore: number;
  location: string[];
}

export interface DettctSnapshot {
  fileVersion: string;
  name: string;
  runAt: Date;
  techniques: DettctTechnique[];
  total: number;
  covered: number;
  uncovered: number;
}

interface RawScoreEntry {
  date?: string | Date;
  score?: number;
}
interface RawDetection {
  applicable_to?: string[];
  location?: string[];
  score_logbook?: RawScoreEntry[];
}
interface RawTechnique {
  technique_id: string;
  technique_name: string;
  detection?: RawDetection[];
  visibility?: RawDetection[];
}

function latestScore(logbook?: RawScoreEntry[]): number {
  if (!logbook || logbook.length === 0) return 0;
  const sorted = [...logbook].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  return Number(sorted.at(-1)?.score ?? 0);
}

function toDate(d?: string | Date): Date {
  if (!d) return new Date(0);
  return d instanceof Date ? d : new Date(d);
}

export function parseDettctYaml(source: string): DettctSnapshot {
  const doc = parse(source) as {
    version?: string;
    file_type?: string;
    name?: string;
    date?: string | Date;
    techniques?: RawTechnique[];
  };
  if (!doc || doc.file_type !== "techniques-administration" || !Array.isArray(doc.techniques)) {
    throw new Error("Not a DeTT&CT techniques-administration file");
  }

  const techniques: DettctTechnique[] = doc.techniques.map((t) => ({
    techniqueId: t.technique_id,
    techniqueName: t.technique_name ?? t.technique_id,
    detectionScore: Math.max(0, ...((t.detection ?? []).map((d) => latestScore(d.score_logbook)))),
    visibilityScore: Math.max(0, ...((t.visibility ?? []).map((v) => latestScore(v.score_logbook)))),
    location: [...new Set((t.detection ?? []).flatMap((d) => d.location ?? []))],
  }));

  // covered = at least one detection source scored > 0
  const covered = techniques.filter((t) => t.detectionScore > 0).length;
  return {
    fileVersion: doc.version ?? "?",
    name: doc.name ?? "unnamed",
    runAt: toDate(doc.date),
    techniques,
    total: techniques.length,
    covered,
    uncovered: techniques.length - covered,
  };
}
