import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedTranscript, Cue, SpeakerSpan, SpeakerRole, ParticipantId } from "../../src/types/qualitative";

// =====================================================================
// VTT parser for Zoom-exported transcripts (markdown-escaped variant).
// Pure functions, no side effects beyond fs.readFileSync.
// =====================================================================

/** Participant labels start with a numeric ID (e.g. "001", "007"),
 *  optionally followed by whitespace and annotations like pronouns
 *  ("007 (she/her)" or "007  (he/him)"). Interviewer labels start with
 *  a name (letter), so anything not matching digits-then-boundary
 *  is treated as interviewer.
 */
export function classifySpeaker(speakerLabelRaw: string): SpeakerRole {
  return /^\d{1,4}(\s|$)/.test(speakerLabelRaw.trim())
    ? "participant"
    : "interviewer";
}

/** "INT001.md" → "INT001"; throws if filename doesn't match the convention. */
export function participantIdFromFilename(filename: string): ParticipantId {
  const m = filename.match(/^(INT\d{3,})\.md$/);
  if (!m) {
    throw new Error(`Filename "${filename}" does not match expected pattern INT###.md`);
  }
  return m[1] as ParticipantId;
}

/**
 * Split a VTT body into raw cue blocks. A block is contiguous non-blank
 * lines. The leading "WEBVTT" header (and any blank line after it) is
 * skipped.
 */
function splitIntoCueBlocks(body: string): string[] {
  // Normalize line endings, strip the escaping on arrows, drop trailing
  // markdown two-space line breaks (they are display artifacts).
  const normalized = body
    .replace(/\r\n/g, "\n")
    .replace(/\\-\\-\\>/g, "-->")
    .replace(/\\--\\>/g, "-->")
    .replace(/ {2,}\n/g, "\n");

  const lines = normalized.split("\n");

  // Drop WEBVTT header
  let i = 0;
  if (lines[i]?.trim().toUpperCase().startsWith("WEBVTT")) i++;
  while (i < lines.length && lines[i].trim() === "") i++;

  const blocks: string[] = [];
  let current: string[] = [];
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
    } else {
      current.push(lines[i]);
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

const TIMESTAMP_LINE_RE =
  /^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*$/;

/**
 * Parse a single cue block into a Cue, or null if malformed (we collect
 * malformed blocks in `warnings` for the caller to surface).
 */
function parseCueBlock(block: string, warnings: string[]): Cue | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) {
    warnings.push(`Skipping short block: ${JSON.stringify(block).slice(0, 80)}`);
    return null;
  }

  const cueNumber = Number.parseInt(lines[0], 10);
  if (!Number.isFinite(cueNumber)) {
    warnings.push(`Bad cue number: "${lines[0]}"`);
    return null;
  }

  const tsMatch = lines[1].match(TIMESTAMP_LINE_RE);
  if (!tsMatch) {
    warnings.push(`Bad timestamp line in cue ${cueNumber}: "${lines[1]}"`);
    return null;
  }

  // Speaker line(s) may be split across multiple lines if the utterance
  // wrapped. We rejoin everything from line 2 onward and split on the
  // FIRST colon to separate speaker from text.
  const speakerAndText = lines.slice(2).join(" ");
  const colonIdx = speakerAndText.indexOf(":");
  if (colonIdx === -1) {
    warnings.push(`No speaker colon in cue ${cueNumber}`);
    return null;
  }
  const speakerLabelRaw = speakerAndText.slice(0, colonIdx).trim();
  const text = speakerAndText.slice(colonIdx + 1).trim();
  if (text === "") {
    // Empty utterance — keep it but mark it; sometimes a speaker turn has no transcribed text.
    // Returning the cue lets us preserve cue count parity with the source.
  }

  return {
    cueNumber,
    startTime: tsMatch[1],
    endTime: tsMatch[2],
    speakerLabelRaw,
    speakerRole: classifySpeaker(speakerLabelRaw),
    text,
  };
}

/**
 * Build the flat text and the speakerSpans index from a list of cues.
 * Format:
 *   PARTICIPANT: <text>\n
 *   INTERVIEWER: <text>\n
 *
 * Empty utterances are skipped (they can't be cited).
 */
function buildFlatText(cues: Cue[]): {
  flatText: string;
  speakerSpans: SpeakerSpan[];
} {
  const parts: string[] = [];
  const spans: SpeakerSpan[] = [];
  let cursor = 0;
  for (const cue of cues) {
    if (cue.text === "") continue;
    const prefix = cue.speakerRole === "participant" ? "PARTICIPANT: " : "INTERVIEWER: ";
    const line = prefix + cue.text + "\n";
    const lineStart = cursor + prefix.length;
    const lineEnd = cursor + prefix.length + cue.text.length;
    spans.push({
      cueNumber: cue.cueNumber,
      speakerRole: cue.speakerRole,
      flatCharStart: lineStart,
      flatCharEnd: lineEnd,
    });
    parts.push(line);
    cursor += line.length;
  }
  return { flatText: parts.join(""), speakerSpans: spans };
}

export type ParseResult = {
  parsed: ParsedTranscript;
  warnings: string[];
};

export function parseTranscriptFromString(body: string, participantId: ParticipantId): ParseResult {
  const warnings: string[] = [];
  const blocks = splitIntoCueBlocks(body);
  const cues: Cue[] = [];
  for (const b of blocks) {
    const cue = parseCueBlock(b, warnings);
    if (cue) cues.push(cue);
  }
  const { flatText, speakerSpans } = buildFlatText(cues);
  const participantCueCount = cues.filter(
    (c) => c.speakerRole === "participant" && c.text !== "",
  ).length;
  const interviewerCueCount = cues.filter(
    (c) => c.speakerRole === "interviewer" && c.text !== "",
  ).length;
  return {
    parsed: {
      participantId,
      cues,
      flatText,
      speakerSpans,
      participantCueCount,
      interviewerCueCount,
    },
    warnings,
  };
}

export function parseTranscriptFromFile(absPath: string): ParseResult {
  const filename = path.basename(absPath);
  const id = participantIdFromFilename(filename);
  const body = fs.readFileSync(absPath, "utf8");
  return parseTranscriptFromString(body, id);
}
