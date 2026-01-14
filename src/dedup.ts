/**
 * Deduplicates TOON format transcript entries by segment ID.
 *
 * Groups entries by Segment ID (4th field in TOON format).
 * If both C (Confirmed) and U (Unconfirmed) exist for same segment, keeps only C.
 * If only U exists, preserves it.
 * Maintains chronological order by segment ID.
 *
 * TOON format: timestamp,source,status,segment,confidence,duration,language,text
 * - source: M=microphone, S=system (audio), E=events
 * - status: C=confirmed, U=unconfirmed, T=translated, N=no_speech
 * - segment: sequential segment number
 *
 * @param lines - Array of TOON format lines to deduplicate
 * @returns Deduplicated array of TOON format lines
 */
export function deduplicateToonEntries(lines: string[]): string[] {
  throw new Error("not implemented");
}
