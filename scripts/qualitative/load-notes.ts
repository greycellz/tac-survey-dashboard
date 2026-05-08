import * as fs from "node:fs";
import Papa from "papaparse";
import type {
  ParticipantId,
  Demographics,
  ResearcherNotesByCategory,
  ResearcherNotesEntry,
} from "../../src/types/qualitative";

// =====================================================================
// Loader for the researcher pre-coded notes spreadsheet.
//
// Expected CSV structure (export the Google Sheet "as CSV"):
//   1. Participant            (1, 2, …, 16)   → mapped to INT001…INT016
//   2. Transcripts            (Google Doc URL, optional)
//   3. Life and routine changes and challenges
//   4. Emotional impact
//   5. Recovery challenges and pain points
//   6. Needs over time
//   7. Technology for recovery
//   8. AI for Recovery Attitudes and Beliefs
//   9. ChatGPT insights
//  10. (blank spacer column — ignored)
//  11. What is your age?
//  12. What is your gender?
//  13. Do you have children under the age of 18?
//  14. Are you a caregiver for a relative with a disability or health condition?
//  15. Are you currently caring for a pet?
//
// Header row matching is by NAME (case- and whitespace-insensitive
// startsWith), not by position, so column reordering won't break it.
// =====================================================================

const HEADERS = {
  participant: "participant",
  transcript: "transcript",
  lifeAndRoutineChanges: "life and routine",
  emotionalImpact: "emotional impact",
  recoveryChallenges: "recovery challenges",
  needsOverTime: "needs over time",
  technology: "technology for recovery",
  aiAttitudes: "ai for recovery",
  chatGptInsights: "chatgpt insights",
  age: "what is your age",
  gender: "what is your gender",
  hasChildren: "children under the age of 18",
  caregiver: "caregiver for a relative",
  pet: "caring for a pet",
} as const;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function findCol(headers: string[], needle: string): number {
  const n = norm(needle);
  return headers.findIndex((h) => norm(h).startsWith(n));
}

function toBoolOrNull(s: string | undefined | null): boolean | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (v === "yes" || v === "y" || v === "true") return true;
  if (v === "no" || v === "n" || v === "false") return false;
  return null;
}

function toNumOrNull(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number.parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function nonEmpty(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return t === "" || t.toLowerCase() === "n/a" ? null : t;
}

function participantIdFromCell(s: string): ParticipantId {
  const n = Number.parseInt(s.trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Bad participant value in notes CSV: "${s}"`);
  }
  return ("INT" + String(n).padStart(3, "0")) as ParticipantId;
}

function cell(row: string[], i: number): string | undefined {
  if (i < 0 || i >= row.length) return undefined;
  return row[i];
}

export function loadResearcherNotes(absPath: string): ResearcherNotesEntry[] {
  const csv = fs.readFileSync(absPath, "utf8");
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    console.warn(`[notes] CSV parse warnings:`, parsed.errors.slice(0, 3));
  }
  const rows = parsed.data;
  if (rows.length < 2) return [];

  const headers = rows[0]!;
  const idx = {
    participant: findCol(headers, HEADERS.participant),
    transcript: findCol(headers, HEADERS.transcript),
    life: findCol(headers, HEADERS.lifeAndRoutineChanges),
    emo: findCol(headers, HEADERS.emotionalImpact),
    chal: findCol(headers, HEADERS.recoveryChallenges),
    needs: findCol(headers, HEADERS.needsOverTime),
    tech: findCol(headers, HEADERS.technology),
    ai: findCol(headers, HEADERS.aiAttitudes),
    gpt: findCol(headers, HEADERS.chatGptInsights),
    age: findCol(headers, HEADERS.age),
    gender: findCol(headers, HEADERS.gender),
    children: findCol(headers, HEADERS.hasChildren),
    caregiver: findCol(headers, HEADERS.caregiver),
    pet: findCol(headers, HEADERS.pet),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) {
      console.warn(`[notes] Could not locate column "${k}" — values will be null.`);
    }
  }

  if (idx.participant < 0) {
    console.warn(`[notes] Could not locate Participant column — no entries loaded.`);
    return [];
  }

  const entries: ResearcherNotesEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const partCell = cell(row, idx.participant);
    if (!partCell?.trim()) continue;
    const id = participantIdFromCell(partCell);
    const notes: ResearcherNotesByCategory = {
      lifeAndRoutineChanges: nonEmpty(cell(row, idx.life)),
      emotionalImpact: nonEmpty(cell(row, idx.emo)),
      recoveryChallengesAndPainPoints: nonEmpty(cell(row, idx.chal)),
      needsOverTime: nonEmpty(cell(row, idx.needs)),
      technologyForRecovery: nonEmpty(cell(row, idx.tech)),
      aiAttitudesAndBeliefs: nonEmpty(cell(row, idx.ai)),
      chatGptInsights: nonEmpty(cell(row, idx.gpt)),
    };
    const demographics: Demographics = {
      age: toNumOrNull(cell(row, idx.age)),
      gender: nonEmpty(cell(row, idx.gender)),
      hasChildrenUnder18: toBoolOrNull(cell(row, idx.children)),
      isCaregiverForRelative: toBoolOrNull(cell(row, idx.caregiver)),
      hasPet: toBoolOrNull(cell(row, idx.pet)),
    };
    entries.push({
      id,
      notes,
      demographics,
      transcriptUrl: nonEmpty(cell(row, idx.transcript)),
    });
  }
  return entries;
}
