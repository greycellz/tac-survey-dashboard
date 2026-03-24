import Papa from "papaparse";
import type {
  SurveyRespondent,
  FireAffected,
  Gender,
  LivingSituation,
  WellbeingRating,
  RecoveryStage,
  AIInterest,
  AIComfort,
  DisplacementDuration,
  InsuranceSatisfaction,
  HumanHelperImportance,
} from "@/types/survey";

// ─── Column header map ────────────────────────────────────────────────────────

const COL = {
  submissionNum: "Submission #",
  age: "What is your age?",
  gender: "What is your gender?",
  hasChildren: "Do you have children under the age of 18?",
  isCaregiver: "Are you a caregiver for a relative with a disability or health condition?",
  hasPet: "Are you currently caring for a pet?",
  livingSituation: "How would you describe your current living situation?",
  fireAffected: "Which fire(s) affected you most directly?",
  fireImpacts: "How were you impacted by the fire? (check all that apply)",
  hadInsurance: "Did you have homeowners or renters insurance at the time?",
  filedClaim: "Have you filed an insurance claim?",
  insuranceSatisfaction: "If yes, how satisfied are you with your insurance process so far?",
  displacementDuration: "How long were you displaced from your home (if applicable)?",
  recoveryStage: "What stage of recovery are you currently in?",
  challengingAreas: "Since the fire, which areas have been most challenging for you? (Select up to 3)",
  mostOverwhelming: "When you think about your recovery process so far, what has felt most overwhelming?",
  mostHelpful: "Who or what has been most helpful in your recovery process?",
  whatWouldHaveHelped: "What would have made your recovery process easier?",
  wellbeing: "How would you describe your emotional wellbeing right now?",
  mentalHealthSupport: "Have you sought any emotional or mental health support since the fire?",
  supportBarriers: "What barriers make it hard to get emotional or mental health support? (check all that apply)",
  copingStrategies: "How do you currently cope with stress or difficult emotions?",
  helpNeeded: "Which types of help do you most need right now? (Select all that apply)",
  infoEase: "How easy has it been to find accurate and up-to-date information about available resources?",
  infoSources: "Where do you usually look for assistance, guidance, or information?",
  preferredChannel: "How would you prefer to receive support or information?",
  usedAI: "Have you ever used an AI tool or chatbot before?",
  aiInterest: "How interested would you be in using an AI chatbot as part of your fire recovery process?",
  aiComfort:
    "How comfortable would you feel using an AI-powered Disaster Recovery Coach to help with information, paperwork, or emotional support?",
  aiToolInterests: "Interest in AI tools (select any that apply)",
  aiConcerns: "What concerns, if any, do you have about using AI for disaster recovery or emotional support?",
  humanHelperImportance: "How important is it to you that a human helper is available alongside an AI tool?",
  aiOneThingText:
    "If an AI coach could help you with one thing in your fire recovery right now, what would it be?",
  anythingElse:
    "Is there anything else you'd like to share about your experience or ideas for how to reduce stress in the recovery process and empower survivors?",
  advice: "What advice would you give to someone who just experienced a disaster?",
  mayShare: "May we share these words (anonymously)?",
} as const;

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseBool(val: string): boolean {
  return val.trim().toLowerCase() === "yes";
}

function splitMulti(val: string): string[] {
  if (!val?.trim()) return [];
  return val.split(";").map((s) => s.trim()).filter(Boolean);
}

/**
 * In multi-select fields, "Other: [free text]" is embedded in the semicolon list.
 * This normalises the entry to "Other" and extracts the text.
 */
function extractOther(items: string[]): { items: string[]; otherText?: string } {
  let otherText: string | undefined;
  const cleaned = items.map((item) => {
    if (item.startsWith("Other:")) {
      otherText = (otherText ? otherText + "; " : "") + item.slice(6).trim();
      return "Other";
    }
    return item;
  });
  return { items: cleaned, otherText };
}

/**
 * Some single-select fields in this CSV are exported as "N (Label)" (e.g. "2 (Somewhat interested)").
 * This strips the numeric prefix and returns just the label text.
 */
function normalizeNumericLabel(val: string): string {
  const match = val.trim().match(/^\d+\s+\((.+)\)$/);
  return match ? match[1] : val.trim();
}

/**
 * Single-value field may be "Other: [free text]".
 * Also handles the edge case where respondents chose multiple options on a single-select field
 * (semicolon-separated): takes the first recognizable non-Other value as the primary, and
 * collects any "Other:" text.
 */
function extractSingleOther(val: string): { value: string; otherText?: string } {
  const trimmed = val.trim();
  if (!trimmed) return { value: "" };

  // If semicolons present, treat as accidental multi-select: take first clean value
  const segments = trimmed.split(";").map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    let primaryValue = "";
    let otherText: string | undefined;
    for (const seg of segments) {
      if (seg.startsWith("Other:")) {
        const text = seg.slice(6).trim();
        otherText = otherText ? `${otherText}; ${text}` : text;
      } else if (!primaryValue) {
        primaryValue = seg;
      }
    }
    return { value: primaryValue || "Other", otherText };
  }

  if (trimmed.startsWith("Other:")) {
    return { value: "Other", otherText: trimmed.slice(6).trim() };
  }
  return { value: trimmed };
}

// ─── Row parser ───────────────────────────────────────────────────────────────

function parseRow(row: Record<string, string>): SurveyRespondent | null {
  try {
    const submissionRaw = row[COL.submissionNum] ?? "";
    const submissionNum = parseInt(submissionRaw.replace(/[^0-9]/g, ""), 10);
    if (isNaN(submissionNum)) return null;

    const ageRaw = parseFloat(row[COL.age] ?? "");

    // Single-value fields with possible "Other:"
    const { value: livingSituationVal, otherText: livingSituationOther } = extractSingleOther(
      row[COL.livingSituation] ?? ""
    );
    const { value: recoveryStageVal, otherText: recoveryStageOther } = extractSingleOther(
      row[COL.recoveryStage] ?? ""
    );

    // Multi-select fields with possible "Other:" entries
    const { items: fireImpacts, otherText: fireImpactsOther } = extractOther(
      splitMulti(row[COL.fireImpacts] ?? "")
    );
    const { items: challengingAreas, otherText: challengingAreasOther } = extractOther(
      splitMulti(row[COL.challengingAreas] ?? "")
    );
    const { items: supportBarriers, otherText: supportBarriersOther } = extractOther(
      splitMulti(row[COL.supportBarriers] ?? "")
    );
    const { items: helpNeeded, otherText: helpNeededOther } = extractOther(
      splitMulti(row[COL.helpNeeded] ?? "")
    );
    const { items: infoSources, otherText: infoSourcesOther } = extractOther(
      splitMulti(row[COL.infoSources] ?? "")
    );
    const { items: preferredChannel, otherText: preferredChannelOther } = extractOther(
      splitMulti(row[COL.preferredChannel] ?? "")
    );
    const { items: aiToolInterests, otherText: aiToolInterestsOther } = extractOther(
      splitMulti(row[COL.aiToolInterests] ?? "")
    );
    const { items: aiConcerns, otherText: aiConcernsOther } = extractOther(
      splitMulti(row[COL.aiConcerns] ?? "")
    );

    const insuranceSatisfactionRaw = row[COL.insuranceSatisfaction]?.trim() ?? "";

    return {
      id: String(submissionNum),
      submissionNum,

      age: isNaN(ageRaw) ? 0 : ageRaw,
      gender: (row[COL.gender]?.trim() ?? "") as Gender,
      hasChildren: parseBool(row[COL.hasChildren] ?? ""),
      isCaregiver: parseBool(row[COL.isCaregiver] ?? ""),
      hasPet: parseBool(row[COL.hasPet] ?? ""),
      livingSituation: livingSituationVal as LivingSituation,
      livingSituationOther,

      fireAffected: (row[COL.fireAffected]?.trim() ?? "") as FireAffected,
      fireImpacts,
      fireImpactsOther,
      hadInsurance: (row[COL.hadInsurance]?.trim() ?? "") as "Yes" | "No" | "Not sure",
      filedClaim: (row[COL.filedClaim]?.trim() ?? "") as "Yes" | "No" | "In progress" | "Not applicable",
      insuranceSatisfaction: insuranceSatisfactionRaw
        ? (insuranceSatisfactionRaw as InsuranceSatisfaction)
        : undefined,
      displacementDuration: (row[COL.displacementDuration]?.trim() ?? "") as DisplacementDuration,
      recoveryStage: recoveryStageVal as RecoveryStage,
      recoveryStageOther,

      challengingAreas,
      challengingAreasOther,
      mostOverwhelming: row[COL.mostOverwhelming]?.trim() ?? "",
      mostHelpful: row[COL.mostHelpful]?.trim() ?? "",
      whatWouldHaveHelped: row[COL.whatWouldHaveHelped]?.trim() ?? "",

      wellbeing: (row[COL.wellbeing]?.trim() ?? "") as WellbeingRating,
      mentalHealthSupport: row[COL.mentalHealthSupport]?.trim() ?? "",
      supportBarriers,
      supportBarriersOther,
      copingStrategies: row[COL.copingStrategies]?.trim() ?? "",

      helpNeeded,
      helpNeededOther,
      infoEase: (row[COL.infoEase]?.trim() ?? "") as
        | "Very difficult"
        | "Difficult"
        | "Neutral"
        | "Easy"
        | "Very easy",
      infoSources,
      infoSourcesOther,
      preferredChannel,
      preferredChannelOther,

      usedAI: (row[COL.usedAI]?.trim() ?? "") as "Yes" | "No" | "Not sure",
      aiInterest: normalizeNumericLabel(row[COL.aiInterest] ?? "") as AIInterest,
      aiComfort: (row[COL.aiComfort]?.trim() ?? "") as AIComfort,
      aiToolInterests,
      aiToolInterestsOther,
      aiConcerns,
      aiConcernsOther,
      humanHelperImportance: (row[COL.humanHelperImportance]?.trim() ?? "") as HumanHelperImportance,
      aiOneThingText: row[COL.aiOneThingText]?.trim() ?? "",

      anythingElse: row[COL.anythingElse]?.trim() ?? "",
      advice: row[COL.advice]?.trim() ?? "",
      mayShare: parseBool(row[COL.mayShare] ?? ""),
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ParseResult {
  respondents: SurveyRespondent[];
  errors: string[];
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const errors: string[] = [];
        const respondents: SurveyRespondent[] = [];

        results.data.forEach((row, i) => {
          const respondent = parseRow(row);
          if (respondent) {
            respondents.push(respondent);
          } else {
            errors.push(`Row ${i + 1}: could not parse (Submission # missing or invalid)`);
          }
        });

        resolve({ respondents, errors });
      },
      error(err) {
        resolve({ respondents: [], errors: [err.message] });
      },
    });
  });
}
