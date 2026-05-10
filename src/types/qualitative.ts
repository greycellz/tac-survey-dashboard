// =====================================================================
// Qualitative workspace types
// =====================================================================
// All types are JSON-serializable (no Dates, no Maps, no functions).
// This file is the single source of truth for the qualitative data model.
// =====================================================================

// ---------- Participants & demographics ----------

export type ParticipantId = `INT${string}`; // e.g., "INT001"

/**
 * Participant-level data from the notes CSV. Combines:
 *   - Pure demographics (age/gender/etc.)
 *   - Closed-ended survey responses (Likert-like and categorical)
 *   - Multiselect arrays
 *   - Free-text long-form answers
 *
 * Every field is nullable — many cells are blank in the source CSV,
 * and several rows in the file may be from the broader survey cohort
 * (n=115) without all columns filled.
 */
export type Demographics = {
  // ----- Core demographics -----
  age: number | null;
  gender: string | null;
  hasChildrenUnder18: boolean | null;
  isCaregiverForRelative: boolean | null;
  hasPet: boolean | null;

  // ----- Single-select categorical -----
  livingSituation: string | null;
  fireAffectedMost: string | null;
  displacementDuration: string | null;
  recoveryStage: string | null;
  emotionalWellbeing: string | null;
  hasSoughtMentalHealthSupport: string | null;
  hasUsedAiBefore: string | null;
  aiChatbotInterest: string | null;

  // ----- Multiselect (semicolon-delimited in source) -----
  fireImpactTypes: string[] | null;
  challengingAreas: string[] | null;
  mentalHealthBarriers: string[] | null;
  helpNeededNow: string[] | null;

  // ----- Free-text long-form -----
  mostOverwhelming: string | null;
  mostHelpful: string | null;
  whatWouldHaveHelped: string | null;
  copingMechanisms: string | null;
  aiCoachWish: string | null;
  additionalSharing: string | null;
  adviceForOthers: string | null;
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
  participantCueCount: number;
  interviewerCueCount: number;
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
  participantCueCount: number;
  interviewerCueCount: number;
  /** Pulled from notes.csv if present, else null */
  demographics: Demographics | null;
  /**
   * Whether the TAC MVP demo was shown to this participant during the
   * interview. Affects how empty `mvpFeedback` arrays in extractions
   * should be interpreted:
   *   true  — demo shown; empty mvpFeedback means the participant had
   *           no codable response (real null finding).
   *   false — demo not shown; empty mvpFeedback is a data-coverage gap.
   *   null  — not yet determined; manifest builder defaults here.
   *
   * Populated by an optional sidecar file (see build-manifest.ts).
   */
  mvpDemoShown: boolean | null;
  /** ISO timestamp of when this entry was built */
  builtAt: string;
};

export type Manifest = {
  version: 1;
  generatedAt: string; // ISO timestamp
  entries: ManifestEntry[];
};

// ---------- Researcher notes (pre-coded summaries) ----------

export type ResearcherNotesByCategory = {
  lifeAndRoutineChanges: string | null;
  emotionalImpact: string | null;
  recoveryChallengesAndPainPoints: string | null;
  needsOverTime: string | null;
  technologyForRecovery: string | null;
  aiAttitudesAndBeliefs: string | null;
  chatGptInsights: string | null;
};

export type ResearcherNotesEntry = {
  id: ParticipantId;
  notes: ResearcherNotesByCategory;
  demographics: Demographics;
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

// =====================================================================
// Extraction types (Prompt 2)
// =====================================================================
// A single extraction is the model's output for one transcript.
// It goes through two stages:
//
//   1. RawExtraction        — what the model returned, structurally
//                             validated against the schema and codebook
//                             but NOT yet grounded in the transcript.
//
//   2. ValidatedExtraction  — produced by the validator (Prompt 4)
//                             after each quote is verified to appear
//                             verbatim inside a PARTICIPANT span. Each
//                             coded quote is upgraded to carry a full
//                             `Citation` with offsets and cue numbers.
//
// The model only ever produces (1). The validator produces (2) by
// enriching (1). Anything in (1) that fails grounding is moved to a
// `rejected` array with a reason — it never silently disappears.
// =====================================================================

/**
 * The 8 coding categories for LLM extraction. The first 6 mirror the
 * researcher notes spreadsheet (minus `chatGptInsights`, which is analyst-only).
 * `mvpFeedback` carries adversarial sub-coding (see CODEBOOK).
 */
export type CategoryKey =
  | "lifeAndRoutineChanges"
  | "emotionalImpact"
  | "recoveryChallengesAndPainPoints"
  | "needsOverTime"
  | "technologyForRecovery"
  | "aiAttitudesAndBeliefs"
  | "mvpFeedback"
  | "crossCutting";

/**
 * One controlled-vocabulary code. Loaded from CODEBOOK.json.
 * The `id` is a stable, snake_case string used in extractions.
 * Display-friendly `name` and `definition` are for the dashboard
 * and codebook viewer.
 */
export type CodebookEntry = {
  id: string; // stable, e.g. "exec_dysfunction"
  category: CategoryKey;
  name: string;
  definition: string;
  /** Optional: examples from earlier interviews / domain knowledge */
  examples?: string[];
  /**
   * For mvpFeedback only: the polarity this code belongs to.
   * Validator/dashboard use this for the adversarial audit.
   */
  polarity?: "endorsement" | "hesitation" | "feature_request";
};

export type Codebook = {
  version: string; // "v1.1.0" — bump on any code change
  generatedAt: string;
  entries: CodebookEntry[];
};

/**
 * One coded quote produced by the model. The `quoteVerbatim` string
 * MUST be a literal substring of the participant's flat text.
 * `codeIds` MUST all be present in the codebook.
 *
 * The model is *not* asked to produce char offsets — those are
 * computed by the validator (Prompt 4) from the verbatim string,
 * which is the only honest source.
 */
export type RawCodedQuote = {
  /** Verbatim participant utterance text — exact substring, no edits. */
  quoteVerbatim: string;
  /** One or more codeIds from the codebook. At least one. */
  codeIds: string[];
  /**
   * Short interpretive note from the model (≤ 280 chars).
   * Optional; helpful for theme synthesis later. NOT a substitute
   * for the verbatim quote.
   */
  rationale?: string;
};

/** Observed pattern that does not map to an existing codebook id (model safety valve). */
export type RawUncodedObservation = {
  category: CategoryKey;
  quoteVerbatim: string;
  note: string;
};

/**
 * The model's per-transcript output, before validation.
 */
export type RawExtraction = {
  participantId: ParticipantId;
  transcriptSha256: string; // pinned at extraction time
  skillVersion: string; // SKILL.md version this was generated against
  codebookVersion: string; // CODEBOOK.json version this was generated against
  generatedAt: string;
  /** Coded quotes grouped by category. Empty array if category not present. */
  codedQuotes: Record<CategoryKey, RawCodedQuote[]>;
  /** Optional; patterns that did not fit the codebook but include a verbatim anchor. */
  uncodedObservations?: RawUncodedObservation[];
  /**
   * Adversarial audit record for mvpFeedback specifically.
   * The model must populate both fields even if the answer is "I looked
   * and could not find any" — see SKILL.md.
   */
  mvpAdversarialAudit: {
    endorsementsAttempted: boolean;
    hesitationsAttempted: boolean;
    notes: string; // model's brief reflection on whether it found both polarities
  };
  /** Transcript-level model summary (≤ 500 words) for the dashboard. */
  summary: string;
};

/**
 * After validation: each accepted quote is upgraded with a full Citation.
 * Anything that failed validation goes in `rejected` with a reason.
 */
export type ValidatedCodedQuote = RawCodedQuote & {
  citation: Citation;
};

export type RejectedQuote = {
  category: CategoryKey;
  raw: RawCodedQuote;
  reason:
    | "QUOTE_NOT_FOUND"
    | "QUOTE_SPANS_NON_PARTICIPANT"
    | "UNKNOWN_CODE_ID"
    | "EMPTY_QUOTE"
    | "EMPTY_CODE_LIST"
    | "AMBIGUOUS_QUOTE"; // appears in multiple places — pick one or rephrase
  detail?: string;
};

export type ValidatedUncodedObservation = {
  category: CategoryKey;
  note: string;
  citation: Citation;
};

export type RejectedUncodedObservation = {
  category: CategoryKey;
  note: string;
  quoteVerbatim: string;
  reason: RejectedQuote["reason"];
  detail?: string;
};

export type ValidatedExtraction = {
  participantId: ParticipantId;
  transcriptSha256: string;
  skillVersion: string;
  codebookVersion: string;
  generatedAt: string;
  validatedAt: string;
  codedQuotes: Record<CategoryKey, ValidatedCodedQuote[]>;
  rejected: RejectedQuote[];
  mvpAdversarialAudit: RawExtraction["mvpAdversarialAudit"];
  summary: string;
  uncodedObservationsValidated?: ValidatedUncodedObservation[];
  uncodedObservationsRejected?: RejectedUncodedObservation[];
};

/**
 * Stable, deterministic ID for a coded quote. Format: `INT###:cueN:K`
 * where K is the index of this quote among all quotes from that participant
 * at that cue (almost always 0; matters only when the same cue contains
 * multiple distinct verbatim spans coded separately).
 *
 * Used in modal URLs (?quote=INT005:cue237:0) and as the React key for
 * quote rows. Stable across re-validations as long as the quote string
 * doesn't change.
 */
export type QuoteId = string;

export function makeQuoteId(participantId: ParticipantId, cueNumber: number, indexAtCue: number): QuoteId {
  return `${participantId}:cue${cueNumber}:${indexAtCue}`;
}

export function parseQuoteId(
  id: QuoteId,
): { participantId: ParticipantId; cueNumber: number; indexAtCue: number } | null {
  const m = id.match(/^(INT\d{3,}):cue(\d+):(\d+)$/);
  if (!m) return null;
  return {
    participantId: m[1] as ParticipantId,
    cueNumber: Number.parseInt(m[2], 10),
    indexAtCue: Number.parseInt(m[3], 10),
  };
}

// =====================================================================
// Affect annotation types (Prompt 6)
// =====================================================================

export type EmotionId =
  | "grief"
  | "fear"
  | "anger"
  | "weariness"
  | "hope"
  | "relief"
  | "numbness"
  | "resignation"
  | "defiance"
  | "gratitude"
  | "pride"
  | "neutral";

export type AffectVocabularyEntry = {
  id: EmotionId;
  name: string;
  definition: string;
};

export type AffectVocabulary = {
  version: string;
  generatedAt: string;
  emotions: AffectVocabularyEntry[];
};

/**
 * One annotation per quote. Produced by the LLM annotator following SKILL_AFFECT.md.
 * The model returns this; validation enforces vocabulary membership and value ranges.
 */
export type QuoteAffect = {
  quoteId: QuoteId;
  participantId: ParticipantId;
  primaryEmotion: EmotionId;
  /** Optional second emotion when affect is genuinely mixed. */
  secondaryEmotion: EmotionId | null;
  /** 0 = flat, 1 = overwhelming. Intensity is independent of valence. */
  intensity: number;
  /**
   * Direction of the speaker's stance toward the *referent of the quote*
   * (e.g., insurance company, AI tool, demo feature, their own home).
   * -1 = strongly against, 0 = neutral, +1 = strongly for.
   */
  stance: number;
  /** Annotator confidence in this label, 0–1. */
  confidence: number;
  /** ≤ 200 chars: brief justification, optional. */
  rationale?: string;
};

/**
 * Per-transcript affect file. One per participant, parallel to extractions.
 */
export type AffectFile = {
  participantId: ParticipantId;
  affectSkillVersion: string;
  affectVocabularyVersion: string;
  generatedAt: string;
  annotations: QuoteAffect[];
};

/**
 * Aggregated affect for a set of quotes — used for spider chart and bar chart.
 * Sums to (number of quotes), not 1.0; UI normalizes for display.
 */
export type AffectFingerprint = {
  /** Number of quotes this fingerprint summarizes */
  n: number;
  /** Count per emotion (primary only — secondary not double-counted) */
  emotionCounts: Record<EmotionId, number>;
  /** Mean intensity across the set */
  meanIntensity: number;
  /** Mean stance across the set */
  meanStance: number;
};

/**
 * Everything the qualitative dashboard needs in memory. Loaded once at
 * server-render time from the JSON files in data/qualitative/.
 */
export type QualitativeBundle = {
  manifest: Manifest;
  codebook: Codebook;
  /** Validated extractions per participant (omitted if `.validated.json` missing). */
  extractions: Partial<Record<ParticipantId, ValidatedExtraction>>;
  /** Parsed transcripts (cues + flat text), keyed by ParticipantId */
  transcripts: Record<ParticipantId, ParsedTranscript>;
  /** Affect layer: optional per participant (Prompt 6). */
  affect: Partial<Record<ParticipantId, AffectFile>>;
  affectVocabulary: AffectVocabulary;
};
