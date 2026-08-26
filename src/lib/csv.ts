function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180-ish CSV row escaping. */
export function csvRow(cells: unknown[]): string {
  return cells.map(escapeCell).join(",");
}
