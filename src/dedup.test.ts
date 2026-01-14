import { describe, it, expect } from "vitest";
import { deduplicateToonEntries } from "./dedup.js";

describe("deduplicateToonEntries", () => {
  describe("Acceptance Criteria 1: Basic Deduplication", () => {
    it("keeps only Confirmed when both Unconfirmed and Confirmed exist for same segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,test unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,test confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,test confirmed"
      );
    });

    it("handles segment appearing as Confirmed first, then Unconfirmed", () => {
      const input = [
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,test confirmed",
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,test unconfirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,test confirmed"
      );
    });

    it("deduplicates multiple segments correctly", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,first unconfirmed",
        "2026-01-13T15:14:08+08:00,S,U,101,,0.0,,second unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,first confirmed",
        "2026-01-13T15:14:12+08:00,S,C,101,0.90,2.8,en,second confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain(",C,100,");
      expect(result[1]).toContain(",C,101,");
    });

    it("handles multiple Unconfirmed entries for same segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,first attempt",
        "2026-01-13T15:14:07+08:00,S,U,100,,0.0,,second attempt",
        "2026-01-13T15:14:08+08:00,S,U,100,,0.0,,third attempt",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,final confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,100,");
      expect(result[0]).toContain("final confirmed");
    });
  });

  describe("Acceptance Criteria 2: Real-time Preservation", () => {
    it("preserves Confirmed when no Unconfirmed exists for segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,C,100,0.85,3.5,en,only confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "2026-01-13T15:14:06+08:00,S,C,100,0.85,3.5,en,only confirmed"
      );
    });

    it("preserves Unconfirmed when no Confirmed exists for segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,101,,0.0,,only unconfirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "2026-01-13T15:14:06+08:00,S,U,101,,0.0,,only unconfirmed"
      );
    });

    it("preserves multiple Unconfirmed segments without Confirmed counterparts", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,101,,0.0,,first unconfirmed only",
        "2026-01-13T15:14:08+08:00,S,U,102,,0.0,,second unconfirmed only",
        "2026-01-13T15:14:10+08:00,S,U,103,,0.0,,third unconfirmed only",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toContain(",U,101,");
      expect(result[1]).toContain(",U,102,");
      expect(result[2]).toContain(",U,103,");
    });

    it("handles mixed scenario with some confirmed and some unconfirmed only", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,will be confirmed",
        "2026-01-13T15:14:08+08:00,S,U,101,,0.0,,stays unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,confirmed",
        "2026-01-13T15:14:12+08:00,S,U,102,,0.0,,also stays unconfirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(3);
      expect(result.filter((l) => l.includes(",C,"))).toHaveLength(1);
      expect(result.filter((l) => l.includes(",U,"))).toHaveLength(2);
    });
  });

  describe("Acceptance Criteria 3: Order Integrity", () => {
    it("maintains chronological order by segment ID", () => {
      const input = [
        "2026-01-13T15:14:10+08:00,S,C,102,0.85,3.5,en,segment 102",
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,segment 100 unconfirmed",
        "2026-01-13T15:14:08+08:00,S,C,101,0.90,2.8,en,segment 101",
        "2026-01-13T15:14:12+08:00,S,C,100,0.88,3.2,en,segment 100 confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(3);
      // Extract segment IDs to verify order
      const segmentIds = result.map((line) => {
        const parts = line.split(",");
        return parseInt(parts[3]);
      });
      expect(segmentIds).toEqual([100, 101, 102]);
    });

    it("maintains order with gaps in segment sequence", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,C,100,0.85,3.5,en,segment 100",
        "2026-01-13T15:14:08+08:00,S,C,105,0.90,2.8,en,segment 105",
        "2026-01-13T15:14:10+08:00,S,C,110,0.88,3.2,en,segment 110",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(3);
      const segmentIds = result.map((line) => parseInt(line.split(",")[3]));
      expect(segmentIds).toEqual([100, 105, 110]);
    });

    it("sorts deduplicated results by segment ID even with random input order", () => {
      const input = [
        "2026-01-13T15:14:16+08:00,S,U,215,,0.0,,unconfirmed 215",
        "2026-01-13T15:14:08+08:00,S,C,201,0.90,2.8,en,confirmed 201",
        "2026-01-13T15:14:20+08:00,S,C,215,0.82,3.04,en,confirmed 215",
        "2026-01-13T15:14:06+08:00,S,U,200,,0.0,,unconfirmed 200",
        "2026-01-13T15:14:12+08:00,S,C,210,0.88,3.2,en,confirmed 210",
        "2026-01-13T15:14:10+08:00,S,C,200,0.85,3.5,en,confirmed 200",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(4);
      const segmentIds = result.map((line) => parseInt(line.split(",")[3]));
      expect(segmentIds).toEqual([200, 201, 210, 215]);
    });
  });

  describe("Acceptance Criteria 4: Polling Consistency", () => {
    it("last_line metadata should reflect raw file position (implementation note)", () => {
      // This test documents the requirement that deduplication
      // should NOT affect the last_line metadata calculation
      // The actual last_line logic is in index.ts, not in dedup.ts
      // This test ensures dedup function is pure and doesn't modify metadata

      const input = [
        "2026-01-13T15:14:06+08:00,S,U,100,,0.0,,unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,confirmed",
      ];

      const result = deduplicateToonEntries(input);

      // Dedup should return 1 line (only confirmed)
      expect(result).toHaveLength(1);
      // But the calling code should track that 2 raw lines were processed
      // This ensures polling continues from correct position in raw file
    });
  });

  describe("Acceptance Criteria 5: Backward Compatibility", () => {
    it("empty input returns empty output", () => {
      const result = deduplicateToonEntries([]);
      expect(result).toEqual([]);
    });

    it("single line input returns single line output", () => {
      const input = ["2026-01-13T15:14:06+08:00,S,C,100,0.85,3.5,en,single line"];
      const result = deduplicateToonEntries(input);
      expect(result).toEqual(input);
    });

    it("preserves all lines when no duplicates exist", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,C,100,0.85,3.5,en,first",
        "2026-01-13T15:14:08+08:00,S,C,101,0.90,2.8,en,second",
        "2026-01-13T15:14:10+08:00,S,C,102,0.88,3.2,en,third",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(3);
      expect(result).toEqual(input);
    });
  });

  describe("Edge Cases", () => {
    it("handles Translated status correctly", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,T,100,0.85,3.5,en,translated text",
        "2026-01-13T15:14:08+08:00,S,C,100,0.90,2.8,en,confirmed text",
      ];

      const result = deduplicateToonEntries(input);

      // Both T and C should be preserved as they represent different states
      // Or if we prioritize C over T, document that behavior
      // For now, let's assume C takes precedence over T
      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,100,");
    });

    it("handles no_speech status correctly", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,N,100,,,, ",
        "2026-01-13T15:14:08+08:00,S,C,100,0.90,2.8,en,confirmed text",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,100,");
    });

    it("handles text with commas (quoted text)", () => {
      const input = [
        '2026-01-13T15:14:06+08:00,S,U,100,,0.0,,"text with, commas"',
        '2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,"confirmed text, with commas"',
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,100,");
      expect(result[0]).toContain("confirmed text, with commas");
    });

    it("handles different sources (M vs S) for same segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,M,U,100,,0.0,,microphone unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,system confirmed",
      ];

      const result = deduplicateToonEntries(input);

      // Deduplication is by segment ID regardless of source
      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,100,");
    });

    it("preserves Event entries (E source)", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,E,N,100,,,, ",
        "2026-01-13T15:14:08+08:00,S,U,101,,0.0,,regular entry",
      ];

      const result = deduplicateToonEntries(input);

      // Events should be preserved as they represent system events, not transcription
      expect(result).toHaveLength(2);
      expect(result[0]).toContain(",E,");
      expect(result[1]).toContain(",S,");
    });

    it("handles Event entries mixed with transcription for same segment", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,E,N,100,,,, ",
        "2026-01-13T15:14:08+08:00,S,U,100,,0.0,,transcription unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,100,0.85,3.5,en,transcription confirmed",
      ];

      const result = deduplicateToonEntries(input);

      // Event should be preserved, and C should override U for transcription
      expect(result).toHaveLength(2);
      const eventEntry = result.find((l) => l.includes(",E,"));
      const transEntry = result.find((l) => l.includes(",C,100,"));
      expect(eventEntry).toBeDefined();
      expect(transEntry).toBeDefined();
    });

    it("handles very large segment numbers", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,999999,,0.0,,large segment unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,999999,0.85,3.5,en,large segment confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,999999,");
    });

    it("handles segment ID with leading zeros", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,007,,0.0,,unconfirmed",
        "2026-01-13T15:14:10+08:00,S,C,007,0.85,3.5,en,confirmed",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain(",C,007,");
    });
  });

  describe("Real-world Scenario", () => {
    it("handles typical transcription flow with real data from issue description", () => {
      const input = [
        "2026-01-13T15:14:06+08:00,S,U,215,,0.0,,and experiences",
        "2026-01-13T15:13:52+08:00,S,C,215,0.82,3.04,,and experiences as possible to match",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        "2026-01-13T15:13:52+08:00,S,C,215,0.82,3.04,,and experiences as possible to match"
      );
    });

    it("simulates live transcription with rolling updates", () => {
      const input = [
        "2026-01-13T15:14:00+08:00,S,U,100,,0.0,,initial",
        "2026-01-13T15:14:02+08:00,S,U,101,,0.0,,next word",
        "2026-01-13T15:14:04+08:00,S,C,100,0.85,3.5,en,initial confirmed version",
        "2026-01-13T15:14:06+08:00,S,U,102,,0.0,,still live",
        "2026-01-13T15:14:08+08:00,S,C,101,0.90,2.8,en,next word confirmed",
        "2026-01-13T15:14:10+08:00,S,U,103,,0.0,,very recent",
      ];

      const result = deduplicateToonEntries(input);

      expect(result).toHaveLength(4);
      expect(result[0]).toContain(",C,100,");
      expect(result[1]).toContain(",C,101,");
      expect(result[2]).toContain(",U,102,");
      expect(result[3]).toContain(",U,103,");

      const segmentIds = result.map((line) => parseInt(line.split(",")[3]));
      expect(segmentIds).toEqual([100, 101, 102, 103]);
    });
  });
});
