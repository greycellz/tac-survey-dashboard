// =====================================================================
// Qualitative workspace types
// =====================================================================
// All types are JSON-serializable (no Dates, no Maps, no functions).
// This file is the single source of truth for the qualitative data model.
// =====================================================================

// ---------- Participants & demographics ----------

export type ParticipantId = `INT${string}`; // e.g., "INT001"

export type Demographics = {
  age: number | null;
  gender: string | null;
  hasChildrenUnder18: boolean | null;
  isCaregiverForRelative: boolean | null;
  hasPet: boolean | null;
};

// ---------- Parsed transcript ----------

export type SpeakerRole = "participant" | "interviewer";

export type Cue = {
  cueNumber: number;
  startTime: string; // "HH:MM:SS.fff"
  endTime: string; // "HH:MM:SS.fff"
  speakerLabelRaw: string; // exact label from file, e.g., "001" or "Adrienne Heinz, Ph.D."
  speakerRole: SpeakerRole;
  text: string; // utterance text only, no speaker prefix, no timestamps
};

/**
 * A span in the flat text identifying which speaker said what.
 * Used by the validator (later prompt) to enforce that quotes fall
 * entirely within participant utterances.
 */
export type SpeakerSpan = {
  cueNumber: number;
  speakerRole: SpeakerRole;
  flatCharStart: number; // inclusive
  flatCharEnd: number; // exclusive
};

export type ParsedTranscript = {
  participantId: ParticipantId;
  cues: Cue[];
  /**
   * Concatenated, normalized text used for quote substring matching.
   * Format: each utterance on its own line, prefixed with role tag:
   *   "PARTICIPANT: <text>\n"
   *   "INTERVIEWER: <text>\n"
   * The ROLE prefix (not the raw speaker name) is used so labels are stable.
   */
  flatText: string;
  /** Lookup: flatText offset → which cue/role it belongs to */
  speakerSpans: SpeakerSpan[];
  /** Total counts for sanity checks */
  participantUtteranceCount: number;
  interviewerUtteranceCount: number;
};

// ---------- Manifest ----------

export type ManifestEntry = {
  id: ParticipantId;
  transcriptFilename: string; // "INT001.md"
  transcriptPath: string; // "data/qualitative/transcripts/INT001.md"
  /** sha256 of the raw transcript file bytes — drift detector */
  transcriptSha256: string;
  /** Quick sanity counts from parsing */
  cueCount: number;
  participantUtteranceCount: number;
  interviewerUtteranceCount: number;
  /** Pulled from notes.csv if present, else null */
  demographics: Demographics | null;
  /** ISO timestamp of when this entry was built */
  builtAt: string;
};

export type Manifest = {
  version: 1;
  generatedAt: string; // ISO timestamp
  entries: ManifestEntry[];
};

// ---------- Researcher notes (pre-coded summaries) ----------

/**
 * The 8 category columns from the researcher notes CSV.
 * Each is free text — researcher's interpretive summary.
 * In a later prompt we will use these to detect note↔transcript divergences.
 */
export type ResearcherNotesByCategory = {
  lifeAndRoutineChanges: string | null;
  emotionalImpact: string | null;
  recoveryChallengesAndPainPoints: string | null;
  needsOverTime: string | null;
  technologyForRecovery: string | null;
  aiAttitudesAndBeliefs: string | null;
  chatGptInsights: string | null; // researcher meta-insight column
  // mvpFeedback is intentionally NOT a notes field — it's extracted from
  // transcripts in a later prompt because notes coverage is incomplete.
};

export type ResearcherNotesEntry = {
  id: ParticipantId;
  notes: ResearcherNotesByCategory;
  demographics: Demographics;
  /** Original Google Doc URL from the spreadsheet, for reference only */
  transcriptUrl: string | null;
};

// ---------- Citation (defined here so later prompts use the same shape) ----------

/**
 * A citation is the atomic unit of evidence. Every code, quote, or claim
 * that appears in the qualitative dashboard must resolve to a Citation.
 * Citations are PRODUCED BY THE VALIDATOR (later prompt), not by the
 * model — the model returns only `quoteVerbatim` and the validator
 * computes the offsets by string-matching against the transcript.
 */
export type Citation = {
  participantId: ParticipantId;
  transcriptPath: string;
  transcriptSha256: string; // pinned at extraction time; mismatch later = drift
  quoteVerbatim: string;
  flatCharStart: number; // offset into ParsedTranscript.flatText
  flatCharEnd: number;
  cueNumber: number; // resolved cue from speakerSpans
  startTime: string; // for video reference, e.g., "00:01:35.220"
  contextBefore: string; // up to 80 chars before quote in flatText
  contextAfter: string; // up to 80 chars after quote in flatText
};
