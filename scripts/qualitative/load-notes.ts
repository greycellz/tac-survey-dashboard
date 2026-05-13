import * as fs from "node:fs";
import * as path from "node:path";
import Papa from "papaparse";
import type {
  ParticipantId,
  Demographics,
  ResearcherNotesByCategory,
  ResearcherNotesEntry,
  ResearcherNoteCategoryKey,
} from "../../src/types/qualitative";

// =====================================================================
// Header-name lookups. Match by case-insensitive includes on a
// normalized version of the header (whitespace collapsed, lowercased).
// =====================================================================

const H = {
  participant: "participant",
  transcript: "transcript",

  // Researcher notes
  lifeAndRoutine: "life and routine",
  emotionalImpact: "emotional impact",
  recoveryChallenges: "recovery challenges",
  needsOverTime: "needs over time",
  technology: "technology for recovery",
  aiAttitudes: "ai for recovery",
  chatGptInsights: "chatgpt insights",

  // Demographics
  age: "what is your age",
  gender: "what is your gender",
  hasChildren: "children under the age of 18",
  caregiver: "caregiver for a relative",
  pet: "caring for a pet",

  // Closed-ended single-select
  livingSituation: "current living situation",
  fireAffectedMost: "fire(s) affected you most",
  displacementDuration: "how long were you displaced",
  recoveryStage: "stage of recovery",
  emotionalWellbeing: "emotional wellbeing right now",
  hasSoughtMentalHealthSupport: "sought any emotional or mental health support",
  hasUsedAiBefore: "ever used an ai tool",
  aiChatbotInterest: "interested would you be in using an ai chatbot",

  // Multiselect
  fireImpactTypes: "how were you impacted by the fire",
  challengingAreas: "which areas have been most challenging",
  mentalHealthBarriers: "what barriers make it hard to get emotional",
  helpNeededNow: "which types of help do you most need",

  // Free-text long-form
  mostOverwhelming: "what has felt most overwhelming",
  mostHelpful: "most helpful in your recovery",
  whatWouldHaveHelped: "would have made your recovery process easier",
  copingMechanisms: "how do you currently cope",
  aiCoachWish: "if an ai coach could help you with one thing",
  additionalSharing: "anything else you",
  adviceForOthers: "advice would you give",
} as const;

// =====================================================================
// Helpers
// =====================================================================

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function findCol(headers: string[], needle: string): number {
  const n = norm(needle);
  return headers.findIndex((h) => norm(h).includes(n));
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
  if (t === "" || t.toLowerCase() === "n/a") return null;
  return t;
}

/**
 * Multiselect cells use ";" as the separator. Some cells embed an
 * "Other: …" suffix where the free-text after the colon is itself part
 * of the option. We keep those entries intact (don't split on commas
 * inside them) and just strip whitespace.
 */
function parseMultiselect(s: string | undefined | null): string[] | null {
  const t = nonEmpty(s);
  if (!t) return null;
  return t
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function participantIdFromCell(s: string): ParticipantId | null {
  const n = Number.parseInt(s.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return ("INT" + String(n).padStart(3, "0")) as ParticipantId;
}

// =====================================================================
// Loader
// =====================================================================

export function loadResearcherNotes(absPath: string): ResearcherNotesEntry[] {
  const csv = fs.readFileSync(absPath, "utf8");
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    console.warn(`[notes] CSV parse warnings:`, parsed.errors.slice(0, 3));
  }
  const rows = parsed.data;
  if (rows.length < 2) return [];

  const headers = rows[0];

  const idx = Object.fromEntries(
    Object.entries(H).map(([key, needle]) => [key, findCol(headers, needle)]),
  ) as Record<keyof typeof H, number>;

  for (const [key, i] of Object.entries(idx)) {
    if (i === -1) {
      console.warn(`[notes] Could not locate column for "${key}" — values will be null.`);
    }
  }

  const cell = (row: string[], i: number): string | undefined =>
    i === -1 ? undefined : row[i];

  const entries: ResearcherNotesEntry[] = [];
  let skippedNoId = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const idCell = cell(row, idx.participant);
    if (!idCell || idCell.trim() === "") {
      skippedNoId++;
      continue;
    }
    const id = participantIdFromCell(idCell);
    if (!id) {
      skippedNoId++;
      continue;
    }

    const notes: ResearcherNotesByCategory = {
      lifeAndRoutineChanges: nonEmpty(cell(row, idx.lifeAndRoutine)),
      emotionalImpact: nonEmpty(cell(row, idx.emotionalImpact)),
      recoveryChallengesAndPainPoints: nonEmpty(cell(row, idx.recoveryChallenges)),
      needsOverTime: nonEmpty(cell(row, idx.needsOverTime)),
      technologyForRecovery: nonEmpty(cell(row, idx.technology)),
      aiAttitudesAndBeliefs: nonEmpty(cell(row, idx.aiAttitudes)),
      chatGptInsights: nonEmpty(cell(row, idx.chatGptInsights)),
    };

    const demographics: Demographics = {
      age: toNumOrNull(cell(row, idx.age)),
      gender: nonEmpty(cell(row, idx.gender)),
      hasChildrenUnder18: toBoolOrNull(cell(row, idx.hasChildren)),
      isCaregiverForRelative: toBoolOrNull(cell(row, idx.caregiver)),
      hasPet: toBoolOrNull(cell(row, idx.pet)),

      livingSituation: nonEmpty(cell(row, idx.livingSituation)),
      fireAffectedMost: nonEmpty(cell(row, idx.fireAffectedMost)),
      displacementDuration: nonEmpty(cell(row, idx.displacementDuration)),
      recoveryStage: nonEmpty(cell(row, idx.recoveryStage)),
      emotionalWellbeing: nonEmpty(cell(row, idx.emotionalWellbeing)),
      hasSoughtMentalHealthSupport: nonEmpty(cell(row, idx.hasSoughtMentalHealthSupport)),
      hasUsedAiBefore: nonEmpty(cell(row, idx.hasUsedAiBefore)),
      aiChatbotInterest: nonEmpty(cell(row, idx.aiChatbotInterest)),

      fireImpactTypes: parseMultiselect(cell(row, idx.fireImpactTypes)),
      challengingAreas: parseMultiselect(cell(row, idx.challengingAreas)),
      mentalHealthBarriers: parseMultiselect(cell(row, idx.mentalHealthBarriers)),
      helpNeededNow: parseMultiselect(cell(row, idx.helpNeededNow)),

      mostOverwhelming: nonEmpty(cell(row, idx.mostOverwhelming)),
      mostHelpful: nonEmpty(cell(row, idx.mostHelpful)),
      whatWouldHaveHelped: nonEmpty(cell(row, idx.whatWouldHaveHelped)),
      copingMechanisms: nonEmpty(cell(row, idx.copingMechanisms)),
      aiCoachWish: nonEmpty(cell(row, idx.aiCoachWish)),
      additionalSharing: nonEmpty(cell(row, idx.additionalSharing)),
      adviceForOthers: nonEmpty(cell(row, idx.adviceForOthers)),
    };

    entries.push({
      id,
      notes,
      demographics,
      transcriptUrl: nonEmpty(cell(row, idx.transcript)),
    });
  }

  if (skippedNoId > 0) {
    console.log(`[notes] Skipped ${skippedNoId} row(s) with missing/invalid Participant id.`);
  }
  console.log(`[notes] Loaded ${entries.length} participant rows.`);
  return entries;
}

const RESEARCHER_FULL_NOTE_KEYS: ResearcherNoteCategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "chatGptInsights",
];

/**
 * Full original researcher narratives from notes.csv (seven columns), keyed by participant.
 */
export function loadResearcherFullNotes(csvPath?: string): Partial<
  Record<ParticipantId, Partial<Record<ResearcherNoteCategoryKey, string>>>
> {
  const absPath = csvPath ?? path.resolve("data/qualitative/notes.csv");
  if (!fs.existsSync(absPath)) return {};

  const entries = loadResearcherNotes(absPath);
  const out: Partial<Record<ParticipantId, Partial<Record<ResearcherNoteCategoryKey, string>>>> = {};
  for (const e of entries) {
    const partial: Partial<Record<ResearcherNoteCategoryKey, string>> = {};
    for (const key of RESEARCHER_FULL_NOTE_KEYS) {
      const v = e.notes[key];
      if (v) partial[key] = v;
    }
    if (Object.keys(partial).length > 0) out[e.id] = partial;
  }
  return out;
}
