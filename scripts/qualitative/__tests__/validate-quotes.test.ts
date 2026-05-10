import { describe, it, expect } from "vitest";
import { groundQuote } from "../validate-quotes";
import { parseTranscriptFromString } from "../parse-transcript";
import type { ManifestEntry, RawCodedQuote } from "../../../src/types/qualitative";

const FIXTURE = `WEBVTT

1  
00:00:02.400 \\-\\-\\> 00:00:03.340  
Adrienne Heinz, Ph.D.: Tell me about life after the fire.

2  
00:00:03.630 \\-\\-\\> 00:00:18.290  
001 : Yeah, so my routines were completely upended after the fire.

3  
00:00:18.500 \\-\\-\\> 00:00:30.000  
001 : I had no idea what any of this meant. The inventory was overwhelming.

4  
00:00:30.500 \\-\\-\\> 00:00:35.000  
Adrienne Heinz, Ph.D.: That sounds really hard.

5  
00:00:35.500 \\-\\-\\> 00:00:45.000  
001 : Yeah, so my routines were completely upended after the fire.
`;

const { parsed } = parseTranscriptFromString(FIXTURE, "INT001");

const entry: ManifestEntry = {
  id: "INT001",
  transcriptFilename: "INT001.md",
  transcriptPath: "fixture",
  transcriptSha256: "a".repeat(64),
  cueCount: 5,
  participantCueCount: 3,
  interviewerCueCount: 2,
  demographics: null,
  mvpDemoShown: null,
  builtAt: new Date().toISOString(),
};

const knownCodeIds = new Set(["routine_collapse", "exec_dysfunction"]);

const make = (q: Partial<RawCodedQuote>): RawCodedQuote => ({
  quoteVerbatim: q.quoteVerbatim ?? "",
  codeIds: q.codeIds ?? ["routine_collapse"],
  rationale: q.rationale,
});

describe("groundQuote", () => {
  it("accepts a verbatim participant quote and computes citation", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "I had no idea what any of this meant." }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citation.cueNumber).toBe(3);
      expect(r.citation.startTime).toBe("00:00:18.500");
      expect(r.citation.flatCharStart).toBeGreaterThan(0);
      expect(r.citation.contextAfter).toContain("inventory was overwhelming");
    }
  });

  it("rejects a quote not in the transcript", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "this string never appears anywhere." }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("QUOTE_NOT_FOUND");
  });

  it("rejects a quote that lives only in an interviewer span", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "Tell me about life after the fire." }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("QUOTE_SPANS_NON_PARTICIPANT");
  });

  it("rejects an ambiguous quote (appears more than once)", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "Yeah, so my routines were completely upended after the fire." }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AMBIGUOUS_QUOTE");
  });

  it("rejects an unknown code id", () => {
    const r = groundQuote(
      make({
        quoteVerbatim: "I had no idea what any of this meant.",
        codeIds: ["routine_collapse", "totally_made_up_code"],
      }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("UNKNOWN_CODE_ID");
      expect(r.detail).toBe("totally_made_up_code");
    }
  });

  it("rejects an empty quote", () => {
    const r = groundQuote(make({ quoteVerbatim: "  " }), entry, parsed, knownCodeIds);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("EMPTY_QUOTE");
  });

  it("rejects an empty codeIds list", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "I had no idea what any of this meant.", codeIds: [] }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("EMPTY_CODE_LIST");
  });

  it("contextBefore/contextAfter are clipped to the participant span", () => {
    const r = groundQuote(
      make({ quoteVerbatim: "I had no idea what any of this meant." }),
      entry,
      parsed,
      knownCodeIds,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citation.contextBefore).toBe("");
    }
  });
});
