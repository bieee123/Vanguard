export function nextEngagementCode(sequence: number): string {
  return `ENG-${String(sequence).padStart(3, "0")}`;
}
