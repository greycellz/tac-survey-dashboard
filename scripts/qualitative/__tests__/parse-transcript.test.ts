import { describe, it, expect } from "vitest";
import { parseTranscriptFromString, classifySpeaker, participantIdFromFilename } from "../parse-transcript";
import type { ParticipantId } from "../../../src/types/qualitative";

const ID: ParticipantId = "INT001";

const FIXTURE = `WEBVTT

1  
00:00:02.400 \\-\\-\\> 00:00:03.340  
Adrienne Heinz, Ph.D.: Great.

2  
00:00:03.630 \\-\\-\\> 00:00:18.290  
Adrienne Heinz, Ph.D.: Tell me about life after the fire.

3  
00:00:23.920 \\-\\-\\> 00:00:28.410  
001 : Yeah, so my routines were completely upended.

4  
00:00:28.730 \\-\\-\\> 00:00:41.439  
001 : I had no idea what any of this meant.
`;

describe("classifySpeaker", () => {
  it("treats numeric labels as participant", () => {
    expect(classifySpeaker("001")).toBe("participant");
    expect(classifySpeaker("123")).toBe("participant");
  });
  it("treats named labels as interviewer", () => {
    expect(classifySpeaker("Adrienne Heinz, Ph.D.")).toBe("interviewer");
    expect(classifySpeaker("Abhi Jha")).toBe("interviewer");
  });
});

describe("participantIdFromFilename", () => {
  it("accepts INT001.md", () => {
    expect(participantIdFromFilename("INT001.md")).toBe("INT001");
  });
  it("rejects bad names", () => {
    expect(() => participantIdFromFilename("001.md")).toThrow();
    expect(() => participantIdFromFilename("INT001.txt")).toThrow();
  });
});

describe("parseTranscriptFromString", () => {
  const { parsed, warnings } = parseTranscriptFromString(FIXTURE, ID);

  it("parses all four cues without warnings", () => {
    expect(warnings).toEqual([]);
    expect(parsed.cues).toHaveLength(4);
  });

  it("classifies speakers correctly", () => {
    expect(parsed.participantUtteranceCount).toBe(2);
    expect(parsed.interviewerUtteranceCount).toBe(2);
  });

  it("strips escaped arrows and timestamps from text", () => {
    expect(parsed.cues[2].text).toBe("Yeah, so my routines were completely upended.");
    expect(parsed.cues[2].text).not.toContain("-->");
  });

  it("flatText only contains role-prefixed lines, no cue numbers/timestamps", () => {
    expect(parsed.flatText).not.toMatch(/00:\d{2}:\d{2}/);
    expect(parsed.flatText).not.toMatch(/^\d+\s*$/m);
    expect(parsed.flatText).toContain("PARTICIPANT: I had no idea what any of this meant.");
    expect(parsed.flatText).toContain("INTERVIEWER: Tell me about life after the fire.");
  });

  it("speakerSpans cover every utterance and resolve correctly", () => {
    const needle = "I had no idea what any of this meant.";
    const idx = parsed.flatText.indexOf(needle);
    expect(idx).toBeGreaterThan(-1);
    const span = parsed.speakerSpans.find(
      (s) => s.flatCharStart <= idx && idx + needle.length <= s.flatCharEnd,
    );
    expect(span).toBeDefined();
    expect(span!.speakerRole).toBe("participant");
    expect(span!.cueNumber).toBe(4);
  });

  it("speakerSpans correctly identify interviewer text — needed for validator", () => {
    const needle = "Tell me about life after the fire.";
    const idx = parsed.flatText.indexOf(needle);
    const span = parsed.speakerSpans.find(
      (s) => s.flatCharStart <= idx && idx + needle.length <= s.flatCharEnd,
    );
    expect(span!.speakerRole).toBe("interviewer");
  });
});

describe("Zoom \\--\\> variant", () => {
  const z = `WEBVTT

1
00:00:01.000 \\--\\> 00:00:02.000
002 : Hello there.
`;
  const r = parseTranscriptFromString(z, "INT002");
  it("normalizes \\--\\> timestamps", () => {
    expect(r.warnings).toEqual([]);
    expect(r.parsed.cues[0].text).toBe("Hello there.");
  });
});
