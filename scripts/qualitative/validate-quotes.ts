import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  RawExtraction,
  ValidatedExtraction,
  ValidatedCodedQuote,
  RejectedQuote,
  Citation,
  ParsedTranscript,
  SpeakerSpan,
  CategoryKey,
  Manifest,
  ManifestEntry,
  Codebook,
  RawCodedQuote,
  ValidatedUncodedObservation,
  RejectedUncodedObservation,
} from "../../src/types/qualitative";
import { parseTranscriptFromFile } from "./parse-transcript";
import { loadCodebook } from "./validate-extraction-schema";

const MANIFEST_PATH = path.resolve("data/qualitative/manifest.json");
const CODEBOOK_PATH = path.resolve("data/qualitative/CODEBOOK.json");
const EXTRACTIONS_DIR = path.resolve("data/qualitative/extractions");
const REPORT_PATH = path.resolve("data/qualitative/validation-report.json");

const CONTEXT_WINDOW = 80;

const CATEGORY_KEYS: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];

// =====================================================================
// Pure functions
// =====================================================================

/**
 * Find every occurrence of `needle` in `haystack`, returning all start indices.
 * Used to detect ambiguous quotes (more than one match).
 */
export function findAllOccurrences(haystack: string, needle: string): number[] {
  const out: number[] = [];
  if (needle === "") return out;
  let from = 0;
  while (true) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) break;
    out.push(i);
    from = i + 1;
  }
  return out;
}

/**
 * Find the SpeakerSpan that fully contains [start, end). Returns null if the
 * range crosses two spans or no span fully contains it.
 */
export function spanContaining(
  spans: SpeakerSpan[],
  start: number,
  end: number,
): SpeakerSpan | null {
  for (const s of spans) {
    if (s.flatCharStart <= start && end <= s.flatCharEnd) return s;
  }
  return null;
}

/**
 * Build a Citation from a successful match. Does no validation; assumes the
 * caller already confirmed the match is in a participant span.
 */
export function buildCitation(
  entry: ManifestEntry,
  parsed: ParsedTranscript,
  quoteVerbatim: string,
  idx: number,
  span: SpeakerSpan,
): Citation {
  const cue = parsed.cues.find((c) => c.cueNumber === span.cueNumber);
  if (!cue) {
    throw new Error(
      `Internal: span references cueNumber=${span.cueNumber} not present in parsed.cues for ${entry.id}`,
    );
  }
  const flatCharStart = idx;
  const flatCharEnd = idx + quoteVerbatim.length;

  const contextStart = Math.max(span.flatCharStart, flatCharStart - CONTEXT_WINDOW);
  const contextEnd = Math.min(span.flatCharEnd, flatCharEnd + CONTEXT_WINDOW);
  const contextBefore = parsed.flatText.slice(contextStart, flatCharStart);
  const contextAfter = parsed.flatText.slice(flatCharEnd, contextEnd);

  return {
    participantId: entry.id,
    transcriptPath: entry.transcriptPath,
    transcriptSha256: entry.transcriptSha256,
    quoteVerbatim,
    flatCharStart,
    flatCharEnd,
    cueNumber: span.cueNumber,
    startTime: cue.startTime,
    contextBefore,
    contextAfter,
  };
}

export type GroundingResult =
  | { ok: true; citation: Citation }
  | { ok: false; reason: RejectedQuote["reason"]; detail?: string };

/**
 * Apply all grounding checks to a single RawCodedQuote (or uncodedObservation).
 * Returns either a Citation (if accepted) or a rejection reason.
 */
export function groundQuote(
  raw: RawCodedQuote,
  entry: ManifestEntry,
  parsed: ParsedTranscript,
  knownCodeIds: Set<string>,
): GroundingResult {
  if (!raw.quoteVerbatim || raw.quoteVerbatim.trim() === "") {
    return { ok: false, reason: "EMPTY_QUOTE" };
  }
  if (raw.codeIds && raw.codeIds.length === 0) {
    return { ok: false, reason: "EMPTY_CODE_LIST" };
  }
  if (raw.codeIds) {
    for (const id of raw.codeIds) {
      if (!knownCodeIds.has(id)) {
        return { ok: false, reason: "UNKNOWN_CODE_ID", detail: id };
      }
    }
  }

  const matches = findAllOccurrences(parsed.flatText, raw.quoteVerbatim);
  if (matches.length === 0) {
    return { ok: false, reason: "QUOTE_NOT_FOUND" };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: "AMBIGUOUS_QUOTE",
      detail: `appears ${matches.length} times in flatText`,
    };
  }
  const idx = matches[0];
  const span = spanContaining(parsed.speakerSpans, idx, idx + raw.quoteVerbatim.length);
  if (!span) {
    return { ok: false, reason: "QUOTE_SPANS_NON_PARTICIPANT" };
  }
  if (span.speakerRole !== "participant") {
    return { ok: false, reason: "QUOTE_SPANS_NON_PARTICIPANT" };
  }
  return { ok: true, citation: buildCitation(entry, parsed, raw.quoteVerbatim, idx, span) };
}

// =====================================================================
// Per-extraction validator
// =====================================================================

export type ValidationOutcome = {
  participantId: string;
  validated: ValidatedExtraction;
  counts: {
    accepted: number;
    rejected: number;
    perCategoryAccepted: Record<CategoryKey, number>;
    perCategoryRejected: Record<CategoryKey, number>;
    uncodedAccepted: number;
    uncodedRejected: number;
  };
};

export function validateExtraction(raw: RawExtraction, entry: ManifestEntry, codebook: Codebook): ValidationOutcome {
  if (raw.transcriptSha256 !== entry.transcriptSha256) {
    console.warn(
      `[validate] ${raw.participantId}: transcript SHA drift since extraction (extraction=${raw.transcriptSha256.slice(0, 12)}…, current=${entry.transcriptSha256.slice(0, 12)}…). Validating against current transcript.`,
    );
  }

  const { parsed } = parseTranscriptFromFile(path.resolve(entry.transcriptPath));
  const knownCodeIds = new Set(codebook.entries.map((e) => e.id));

  const accepted: Record<CategoryKey, ValidatedCodedQuote[]> = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [k, [] as ValidatedCodedQuote[]]),
  ) as Record<CategoryKey, ValidatedCodedQuote[]>;

  const rejected: RejectedQuote[] = [];
  const perCategoryAccepted = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
  const perCategoryRejected = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;

  for (const cat of CATEGORY_KEYS) {
    const arr = raw.codedQuotes?.[cat] ?? [];
    for (const q of arr) {
      const result = groundQuote(q, entry, parsed, knownCodeIds);
      if (result.ok) {
        accepted[cat].push({ ...q, citation: result.citation });
        perCategoryAccepted[cat]++;
      } else {
        rejected.push({
          category: cat,
          raw: q,
          reason: result.reason,
          detail: result.detail,
        });
        perCategoryRejected[cat]++;
      }
    }
  }

  const uncodedAccepted: ValidatedUncodedObservation[] = [];
  const uncodedRejected: RejectedUncodedObservation[] = [];

  for (const obs of raw.uncodedObservations ?? []) {
    if (!obs.quoteVerbatim || obs.quoteVerbatim.trim() === "") {
      uncodedRejected.push({
        category: obs.category,
        note: obs.note,
        quoteVerbatim: obs.quoteVerbatim,
        reason: "EMPTY_QUOTE",
      });
      continue;
    }
    const matches = findAllOccurrences(parsed.flatText, obs.quoteVerbatim);
    if (matches.length === 0) {
      uncodedRejected.push({
        category: obs.category,
        note: obs.note,
        quoteVerbatim: obs.quoteVerbatim,
        reason: "QUOTE_NOT_FOUND",
      });
      continue;
    }
    if (matches.length > 1) {
      uncodedRejected.push({
        category: obs.category,
        note: obs.note,
        quoteVerbatim: obs.quoteVerbatim,
        reason: "AMBIGUOUS_QUOTE",
        detail: `appears ${matches.length} times`,
      });
      continue;
    }
    const idx = matches[0];
    const span = spanContaining(parsed.speakerSpans, idx, idx + obs.quoteVerbatim.length);
    if (!span || span.speakerRole !== "participant") {
      uncodedRejected.push({
        category: obs.category,
        note: obs.note,
        quoteVerbatim: obs.quoteVerbatim,
        reason: "QUOTE_SPANS_NON_PARTICIPANT",
      });
      continue;
    }
    uncodedAccepted.push({
      category: obs.category,
      note: obs.note,
      citation: buildCitation(entry, parsed, obs.quoteVerbatim, idx, span),
    });
  }

  const validated: ValidatedExtraction = {
    participantId: raw.participantId,
    transcriptSha256: raw.transcriptSha256,
    skillVersion: raw.skillVersion,
    codebookVersion: raw.codebookVersion,
    generatedAt: raw.generatedAt,
    validatedAt: new Date().toISOString(),
    codedQuotes: accepted,
    rejected,
    mvpAdversarialAudit: raw.mvpAdversarialAudit,
    summary: raw.summary,
    ...(uncodedAccepted.length || uncodedRejected.length
      ? {
          uncodedObservationsValidated: uncodedAccepted,
          uncodedObservationsRejected: uncodedRejected,
        }
      : {}),
  };

  const acceptedTotal = Object.values(perCategoryAccepted).reduce((a, b) => a + b, 0);
  const rejectedTotal = Object.values(perCategoryRejected).reduce((a, b) => a + b, 0);

  return {
    participantId: raw.participantId,
    validated,
    counts: {
      accepted: acceptedTotal,
      rejected: rejectedTotal,
      perCategoryAccepted,
      perCategoryRejected,
      uncodedAccepted: uncodedAccepted.length,
      uncodedRejected: uncodedRejected.length,
    },
  };
}

// =====================================================================
// Batch entry point
// =====================================================================

function loadManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

function loadRawExtraction(participantId: string): RawExtraction | null {
  const p = path.join(EXTRACTIONS_DIR, `${participantId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as RawExtraction;
}

export function runValidation(filter?: string[]) {
  const manifest = loadManifest();
  const codebook = loadCodebook(CODEBOOK_PATH);
  const ids =
    filter && filter.length > 0 ? manifest.entries.filter((e) => filter.includes(e.id)) : manifest.entries;

  const allOutcomes: ValidationOutcome[] = [];
  const missing: string[] = [];

  for (const entry of ids) {
    const raw = loadRawExtraction(entry.id);
    if (!raw) {
      missing.push(entry.id);
      continue;
    }
    const outcome = validateExtraction(raw, entry, codebook);
    allOutcomes.push(outcome);

    const outPath = path.join(EXTRACTIONS_DIR, `${entry.id}.validated.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(outcome.validated, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalExtractions: allOutcomes.length,
    missingExtractions: missing,
    perParticipant: allOutcomes.map((o) => ({
      participantId: o.participantId,
      accepted: o.counts.accepted,
      rejected: o.counts.rejected,
      uncodedAccepted: o.counts.uncodedAccepted,
      uncodedRejected: o.counts.uncodedRejected,
      perCategoryAccepted: o.counts.perCategoryAccepted,
      perCategoryRejected: o.counts.perCategoryRejected,
      rejectionsByReason: o.validated.rejected.reduce<Record<string, number>>((acc, r) => {
        acc[r.reason] = (acc[r.reason] ?? 0) + 1;
        return acc;
      }, {}),
    })),
    totals: {
      accepted: allOutcomes.reduce((s, o) => s + o.counts.accepted, 0),
      rejected: allOutcomes.reduce((s, o) => s + o.counts.rejected, 0),
      uncodedAccepted: allOutcomes.reduce((s, o) => s + o.counts.uncodedAccepted, 0),
      uncodedRejected: allOutcomes.reduce((s, o) => s + o.counts.uncodedRejected, 0),
    },
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[validate] Validated ${allOutcomes.length} extraction(s).`);
  if (missing.length > 0) {
    console.warn(`[validate] Missing raw extractions for: ${missing.join(", ")}`);
  }
  console.log(
    `[validate] Totals: accepted=${report.totals.accepted}, rejected=${report.totals.rejected}, uncodedAccepted=${report.totals.uncodedAccepted}, uncodedRejected=${report.totals.uncodedRejected}`,
  );
  console.log(`[validate] Per-participant:`);
  for (const p of report.perParticipant) {
    const flag = p.rejected > 0 ? "⚠ " : "  ";
    const reasons = Object.entries(p.rejectionsByReason)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    console.log(
      `${flag}${p.participantId}  accepted=${p.accepted.toString().padStart(3)}  rejected=${p.rejected.toString().padStart(2)}${reasons ? `  (${reasons})` : ""}`,
    );
  }
  console.log(`[validate] Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log(
    `[validate] Per-extraction validated files in ${path.relative(process.cwd(), EXTRACTIONS_DIR)}/INT###.validated.json`,
  );
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const entryArg = process.argv[1];
if (entryArg && path.resolve(entryArg) === thisFile) {
  const args = process.argv.slice(2);
  runValidation(args.length > 0 ? args : undefined);
}
