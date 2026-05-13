import * as fs from "node:fs";
import {
  RESEARCHER_NOTE_LABEL_TO_KEY,
  type ResearcherNotesSummary,
  type ResearcherNoteCategoryKey,
  type ParticipantId,
} from "../../src/types/qualitative";

/**
 * Parse RESEARCHER_NOTES_SUMMARIES.md into typed objects.
 *
 * Structure expected:
 *   # Researcher Notes Summaries
 *   **Version:** vX.Y.Z
 *   **Generated:** YYYY-MM-DD ...
 *   ---
 *   ## INT001
 *   **Summary**
 *   <paragraph>
 *   **Life and routine changes:** one-liner
 *   **Emotional impact:** one-liner
 *   ...
 *   ---
 *   ## INT002
 *   ...
 */
export function parseResearcherNotesMd(md: string): {
  version: string;
  generatedAt: string;
  summaries: Partial<Record<ParticipantId, ResearcherNotesSummary>>;
} {
  const versionMatch = md.match(/\*\*Version:\*\*\s*([vV][\d.]+)/);
  const generatedMatch = md.match(/\*\*Generated:\*\*\s*([^\n]+)/);
  const version = versionMatch?.[1] ?? "v0.0.0";
  const generatedAt = generatedMatch?.[1]?.trim() ?? new Date().toISOString();

  const sections = md.split(/\n##\s+(INT\d{3,})\s*\n/);
  const summaries: Partial<Record<ParticipantId, ResearcherNotesSummary>> = {};

  for (let i = 1; i < sections.length; i += 2) {
    const participantId = sections[i] as ParticipantId;
    const body = sections[i + 1] ?? "";

    const summaryMatch = body.match(
      /\*\*Summary\*\*\s*\n+([\s\S]*?)(?=\n\*\*[A-Z][^*]*?:\*\*|\n---|$)/,
    );
    const summary = summaryMatch?.[1]?.trim() ?? "";

    const perCategory: Partial<Record<ResearcherNoteCategoryKey, string>> = {};
    const labelRegex = /\*\*([^*]+?):\*\*\s*([^\n]+)/g;
    let m;
    while ((m = labelRegex.exec(body)) !== null) {
      const label = m[1].trim();
      const text = m[2].trim();
      const key = RESEARCHER_NOTE_LABEL_TO_KEY[label];
      if (key) perCategory[key] = text;
    }

    summaries[participantId] = { participantId, summary, perCategory };
  }

  return { version, generatedAt, summaries };
}

export function loadResearcherNotesMd(absPath: string): {
  version: string;
  generatedAt: string;
  summaries: Partial<Record<ParticipantId, ResearcherNotesSummary>>;
} {
  return parseResearcherNotesMd(fs.readFileSync(absPath, "utf8"));
}
