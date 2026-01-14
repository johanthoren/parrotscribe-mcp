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
  if (lines.length === 0) return [];

  // Status priority: C > T > U > N (higher number = higher priority)
  const statusPriority: Record<string, number> = {
    C: 4,
    T: 3,
    U: 2,
    N: 1,
  };

  // Parse a TOON line, handling quoted text with commas
  const parseLine = (
    line: string
  ): { source: string; status: string; segment: string } | null => {
    // Match first 4 fields: timestamp, source, status, segment
    // The text field (8th) may contain commas and be quoted
    const match = line.match(/^([^,]*),([^,]*),([^,]*),([^,]*),/);
    if (!match) return null;
    return {
      source: match[2],
      status: match[3],
      segment: match[4],
    };
  };

  // Separate Event entries from transcription entries
  const eventEntries: Array<{ line: string; segment: string }> = [];
  const transcriptionEntries: Map<
    string,
    { line: string; status: string; priority: number }
  > = new Map();

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { source, status, segment } = parsed;

    if (source === "E") {
      // Event entries are always preserved
      eventEntries.push({ line, segment });
    } else {
      // Transcription entries: keep highest priority status per segment
      const priority = statusPriority[status] ?? 0;
      const existing = transcriptionEntries.get(segment);

      if (!existing || priority > existing.priority) {
        transcriptionEntries.set(segment, { line, status, priority });
      }
    }
  }

  // Combine events and transcription entries
  const allEntries: Array<{ line: string; segmentNum: number }> = [];

  for (const { line, segment } of eventEntries) {
    allEntries.push({ line, segmentNum: parseInt(segment, 10) });
  }

  for (const { line } of transcriptionEntries.values()) {
    const parsed = parseLine(line);
    if (parsed) {
      allEntries.push({ line, segmentNum: parseInt(parsed.segment, 10) });
    }
  }

  // Sort by segment number
  allEntries.sort((a, b) => a.segmentNum - b.segmentNum);

  return allEntries.map((e) => e.line);
}
