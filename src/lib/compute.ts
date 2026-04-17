import type {
  SurveyRespondent,
  CategoricalResult,
  LikertResult,
  NumericResult,
  MultiSelectResult,
  KPIValue,
  AgeBandLabel,
} from "@/types/survey";

// ─── Predefined sort orders ───────────────────────────────────────────────────

/** Canonical recovery-stage order for filters, compare-by subgroups, and chart sorting. */
export const RECOVERY_STAGE_ORDER = [
  "Still trying to meet basic needs",
  "Actively rebuilding / navigating paperwork",
  "Re-settled but still dealing with emotional or financial impacts",
  "Feel mostly recovered",
  "Other",
] as const;

const DISPLACEMENT_ORDER = [
  "Not displaced",
  "Less than 1 month",
  "1–6 months",
  "6–12 months",
  "More than a year",
  "Still displaced",
];

const INSURANCE_CLAIM_ORDER = ["Yes", "In progress", "No", "Not applicable"];

/** Age histogram bands; also used by dashboard age-band filter. */
export const AGE_BINS = [
  { label: "<20", min: 0, max: 19 },
  { label: "20–29", min: 20, max: 29 },
  { label: "30–39", min: 30, max: 39 },
  { label: "40–49", min: 40, max: 49 },
  { label: "50–59", min: 50, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70+", min: 70, max: 999 },
] as const;

/** Matches `numericResult` age histogram rules: invalid/missing age (≤0) never matches a band. */
export function respondentInAgeBand(age: number, label: AgeBandLabel): boolean {
  const bin = AGE_BINS.find((b) => b.label === label);
  if (!bin) return false;
  if (typeof age !== "number" || Number.isNaN(age) || age <= 0) return false;
  return age >= bin.min && age <= bin.max;
}

// ─── Likert scale configurations ──────────────────────────────────────────────

const LIKERT_CONFIGS: Record<string, { labels: string[]; scale: Record<string, number> }> = {
  wellbeing: {
    labels: ["Very poor", "Poor", "Fair", "Good", "Excellent"],
    scale: { "Very poor": 1, Poor: 2, Fair: 3, Good: 4, Excellent: 5 },
  },
  insuranceSatisfaction: {
    labels: ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"],
    scale: {
      "Very dissatisfied": 1,
      Dissatisfied: 2,
      Neutral: 3,
      Satisfied: 4,
      "Very satisfied": 5,
    },
  },
  infoEase: {
    labels: ["Very difficult", "Difficult", "Neutral", "Easy", "Very easy"],
    scale: { "Very difficult": 1, Difficult: 2, Neutral: 3, Easy: 4, "Very easy": 5 },
  },
  aiComfort: {
    labels: [
      "Very uncomfortable",
      "Somewhat uncomfortable",
      "Neutral",
      "Somewhat comfortable",
      "Very comfortable",
    ],
    scale: {
      "Very uncomfortable": 1,
      "Somewhat uncomfortable": 2,
      Neutral: 3,
      "Somewhat comfortable": 4,
      "Very comfortable": 5,
    },
  },
  humanHelperImportance: {
    labels: [
      "Not important",
      "Slightly important",
      "Somewhat important",
      "Moderately important",
      "Very important",
    ],
    scale: {
      "Not important": 1,
      "Slightly important": 2,
      "Somewhat important": 3,
      "Moderately important": 4,
      "Very important": 5,
    },
  },
};

// ─── Primitive helpers ────────────────────────────────────────────────────────

function roundPct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 10;
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function sortByOrder(rows: CategoricalResult["rows"], order: string[]) {
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    if (ai === -1 && bi === -1) return b.n - a.n;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ─── Core compute helpers ─────────────────────────────────────────────────────

function categoricalResult(
  respondents: SurveyRespondent[],
  field: keyof SurveyRespondent,
  question: string,
  type: "single-select" | "multi-select" = "single-select",
  order?: string[]
): CategoricalResult {
  const valid = respondents.filter((r) => {
    const v = r[field];
    return v !== undefined && v !== null && v !== "";
  });
  const N = valid.length;
  const counts: Record<string, number> = {};
  valid.forEach((r) => {
    const val = String(r[field]);
    counts[val] = (counts[val] ?? 0) + 1;
  });

  let rows = Object.entries(counts).map(([label, n]) => ({
    label,
    n,
    pct: roundPct(n, N),
  }));

  rows = order ? sortByOrder(rows, order) : rows.sort((a, b) => b.n - a.n);

  return { question, type, validN: N, missingN: respondents.length - N, rows };
}

/** For boolean fields — returns "Yes"/"No" labels sorted by frequency. */
function boolCategoricalResult(
  respondents: SurveyRespondent[],
  field: keyof SurveyRespondent,
  question: string
): CategoricalResult {
  const N = respondents.length;
  const yesN = respondents.filter((r) => r[field] === true).length;
  const noN = N - yesN;
  const rows = [
    { label: "Yes", n: yesN, pct: roundPct(yesN, N) },
    { label: "No", n: noN, pct: roundPct(noN, N) },
  ].sort((a, b) => b.n - a.n);
  return { question, type: "single-select", validN: N, missingN: 0, rows };
}

function multiSelectResult(
  respondents: SurveyRespondent[],
  field: keyof SurveyRespondent,
  question: string,
  otherField?: keyof SurveyRespondent
): MultiSelectResult {
  const N = respondents.length;
  const counts: Record<string, number> = {};
  const otherTexts: string[] = [];

  respondents.forEach((r) => {
    const arr = r[field] as string[];
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      counts[item] = (counts[item] ?? 0) + 1;
    });
    if (otherField) {
      const ot = r[otherField] as string | undefined;
      if (ot) otherTexts.push(ot);
    }
  });

  const rows = Object.entries(counts)
    .map(([label, n]) => ({ label, n, pct: roundPct(n, N) }))
    .sort((a, b) => b.n - a.n);

  return {
    question,
    type: "multi-select",
    totalRespondents: N,
    rows,
    otherResponses: otherTexts.length > 0 ? otherTexts : undefined,
  };
}

function likertResult(
  respondents: SurveyRespondent[],
  field: keyof SurveyRespondent,
  question: string,
  configKey: string
): LikertResult {
  const config = LIKERT_CONFIGS[configKey];
  const valid = respondents.filter((r) => {
    const v = r[field] as string;
    return v && config.scale[v] !== undefined;
  });
  const N = valid.length;
  const counts = config.labels.map((label) => valid.filter((r) => r[field] === label).length);
  const scores = valid.map((r) => config.scale[r[field] as string]);
  const mean = N === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / N;
  const variance = N === 0 ? 0 : scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / N;

  return {
    question,
    type: "likert",
    validN: N,
    missingN: respondents.length - N,
    labels: config.labels,
    counts,
    mean: roundTo(mean, 1),
    sd: roundTo(Math.sqrt(variance), 1),
    min: N === 0 ? 0 : Math.min(...scores),
    max: N === 0 ? 0 : Math.max(...scores),
  };
}

function numericResult(
  respondents: SurveyRespondent[],
  field: keyof SurveyRespondent,
  question: string
): NumericResult {
  const valid = respondents.filter((r) => {
    const v = r[field];
    return typeof v === "number" && !isNaN(v) && v > 0;
  });
  const N = valid.length;
  const empty: NumericResult = {
    question,
    type: "numeric",
    validN: 0,
    missingN: respondents.length,
    mean: 0,
    sd: 0,
    min: 0,
    max: 0,
    histogram: AGE_BINS.map((b) => ({ label: b.label, count: 0 })),
  };
  if (N === 0) return empty;

  const vals = valid.map((r) => r[field] as number);
  const mean = vals.reduce((a, b) => a + b, 0) / N;
  const variance = vals.reduce((sum, x) => sum + (x - mean) ** 2, 0) / N;

  return {
    question,
    type: "numeric",
    validN: N,
    missingN: respondents.length - N,
    mean: roundTo(mean, 1),
    sd: roundTo(Math.sqrt(variance), 1),
    min: Math.min(...vals),
    max: Math.max(...vals),
    histogram: AGE_BINS.map((bin) => ({
      label: bin.label,
      count: vals.filter((v) => v >= bin.min && v <= bin.max).length,
    })),
  };
}

function truncLabel(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface ComputedData {
  N: number;
  claimFilersN: number;

  // KPIs
  overviewKPIs: KPIValue[];
  demographicsKPIs: KPIValue[];
  fireImpactKPIs: KPIValue[];
  recoveryKPIs: KPIValue[];
  wellbeingKPIs: KPIValue[];
  resourceKPIs: KPIValue[];
  aiKPIs: KPIValue[];

  // Demographics
  ageResult: NumericResult;
  genderResult: CategoricalResult;
  childrenResult: CategoricalResult;
  caregiverResult: CategoricalResult;
  petResult: CategoricalResult;
  livingSituationResult: CategoricalResult;

  // Fire Impact
  fireAffectedResult: CategoricalResult;
  fireImpactResult: MultiSelectResult;
  insuranceAtTimeResult: CategoricalResult;
  insuranceClaimResult: CategoricalResult;
  insuranceSatisfactionResult: LikertResult;
  displacementResult: CategoricalResult;
  recoveryStageResult: CategoricalResult;

  // Recovery
  challengingAreasResult: MultiSelectResult;

  // Wellbeing
  wellbeingResult: LikertResult;
  mentalHealthSupportResult: CategoricalResult;
  supportBarriersResult: MultiSelectResult;

  // Resources
  helpNeededResult: MultiSelectResult;
  infoEaseResult: LikertResult;
  infoSourcesResult: MultiSelectResult;
  preferredChannelResult: MultiSelectResult;

  // AI
  priorAIUseResult: CategoricalResult;
  aiInterestResult: CategoricalResult;
  aiComfortResult: LikertResult;
  aiToolInterestsResult: MultiSelectResult;
  aiConcernsResult: MultiSelectResult;
  humanHelperResult: LikertResult;

  // Tables
  likertData: LikertResult[];
  categoricalData: CategoricalResult[];
  multiSelectData: MultiSelectResult[];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeAll(respondents: SurveyRespondent[]): ComputedData {
  const N = respondents.length;

  // ── Demographics ───────────────────────────────────────────────────────────
  const ageResult = numericResult(respondents, "age", "What is your age?");
  const genderResult = categoricalResult(respondents, "gender", "What is your gender?");
  const childrenResult = boolCategoricalResult(
    respondents,
    "hasChildren",
    "Do you have children under the age of 18?"
  );
  const caregiverResult = boolCategoricalResult(
    respondents,
    "isCaregiver",
    "Are you a caregiver for a relative with a disability or health condition?"
  );
  const petResult = boolCategoricalResult(
    respondents,
    "hasPet",
    "Are you currently caring for a pet?"
  );
  const livingSituationResult = categoricalResult(
    respondents,
    "livingSituation",
    "How would you describe your current living situation?"
  );

  // ── Fire Impact ────────────────────────────────────────────────────────────
  const fireAffectedResult = categoricalResult(
    respondents,
    "fireAffected",
    "Which fire(s) affected you most directly?"
  );
  const fireImpactResult = multiSelectResult(
    respondents,
    "fireImpacts",
    "How were you impacted by the fire? (check all that apply)",
    "fireImpactsOther"
  );
  const insuranceAtTimeResult = categoricalResult(
    respondents,
    "hadInsurance",
    "Did you have homeowners or renters insurance at the time?"
  );
  const insuranceClaimResult = categoricalResult(
    respondents,
    "filedClaim",
    "Have you filed an insurance claim?",
    "single-select",
    INSURANCE_CLAIM_ORDER
  );

  // Conditional N: insurance satisfaction applies only to claim filers
  const claimFilers = respondents.filter(
    (r) => r.filedClaim === "Yes" || r.filedClaim === "In progress"
  );
  const claimFilersN = claimFilers.length;
  const insuranceSatisfactionResult = likertResult(
    claimFilers,
    "insuranceSatisfaction",
    "If yes, how satisfied are you with your insurance process so far?",
    "insuranceSatisfaction"
  );

  const displacementResult = categoricalResult(
    respondents,
    "displacementDuration",
    "How long were you displaced from your home (if applicable)?",
    "single-select",
    DISPLACEMENT_ORDER
  );
  const recoveryStageResult = categoricalResult(
    respondents,
    "recoveryStage",
    "What stage of recovery are you currently in?",
    "single-select",
    [...RECOVERY_STAGE_ORDER]
  );

  // ── Recovery ───────────────────────────────────────────────────────────────
  const challengingAreasResult = multiSelectResult(
    respondents,
    "challengingAreas",
    "Since the fire, which areas have been most challenging for you? (Select up to 3)",
    "challengingAreasOther"
  );

  // ── Wellbeing ──────────────────────────────────────────────────────────────
  const wellbeingResult = likertResult(
    respondents,
    "wellbeing",
    "How would you describe your emotional wellbeing right now?",
    "wellbeing"
  );
  const mentalHealthSupportResult = categoricalResult(
    respondents,
    "mentalHealthSupport",
    "Have you sought any emotional or mental health support since the fire?"
  );
  const supportBarriersResult = multiSelectResult(
    respondents,
    "supportBarriers",
    "What barriers make it hard to get emotional or mental health support? (check all that apply)",
    "supportBarriersOther"
  );

  // ── Resources ──────────────────────────────────────────────────────────────
  const helpNeededResult = multiSelectResult(
    respondents,
    "helpNeeded",
    "Which types of help do you most need right now? (Select all that apply)",
    "helpNeededOther"
  );
  const infoEaseResult = likertResult(
    respondents,
    "infoEase",
    "How easy has it been to find accurate and up-to-date information about available resources?",
    "infoEase"
  );
  const infoSourcesResult = multiSelectResult(
    respondents,
    "infoSources",
    "Where do you usually look for assistance, guidance, or information?",
    "infoSourcesOther"
  );
  const preferredChannelResult = multiSelectResult(
    respondents,
    "preferredChannel",
    "How would you prefer to receive support or information?",
    "preferredChannelOther"
  );

  // ── AI ─────────────────────────────────────────────────────────────────────
  const priorAIUseResult = categoricalResult(
    respondents,
    "usedAI",
    "Have you ever used an AI tool or chatbot before?"
  );
  const aiInterestResult = categoricalResult(
    respondents,
    "aiInterest",
    "How interested would you be in using an AI chatbot as part of your fire recovery process?"
  );
  const aiComfortResult = likertResult(
    respondents,
    "aiComfort",
    "How comfortable would you feel using an AI-powered Disaster Recovery Coach?",
    "aiComfort"
  );
  const aiToolInterestsResult = multiSelectResult(
    respondents,
    "aiToolInterests",
    "Interest in AI tools (select any that apply)",
    "aiToolInterestsOther"
  );
  const aiConcernsResult = multiSelectResult(
    respondents,
    "aiConcerns",
    "What concerns, if any, do you have about using AI for disaster recovery or emotional support?",
    "aiConcernsOther"
  );
  const humanHelperResult = likertResult(
    respondents,
    "humanHelperImportance",
    "How important is it to you that a human helper is available alongside an AI tool?",
    "humanHelperImportance"
  );

  // ── KPI derivations ────────────────────────────────────────────────────────
  const pctOf = (count: number) =>
    N > 0 ? `${Math.round((count / N) * 100)}%` : "—";

  const stillDisplacedN = respondents.filter((r) => r.displacementDuration === "Still displaced").length;
  const poorWBN = respondents.filter((r) => r.wellbeing === "Very poor" || r.wellbeing === "Poor").length;
  const aiInterestedN = respondents.filter(
    (r) => r.aiInterest === "Somewhat interested" || r.aiInterest === "Very interested"
  ).length;
  const parentsN = respondents.filter((r) => r.hasChildren).length;
  const caregiversN = respondents.filter((r) => r.isCaregiver).length;
  const petsN = respondents.filter((r) => r.hasPet).length;
  const totalLossN = respondents.filter((r) =>
    r.fireImpacts.includes("Home completely destroyed")
  ).length;
  const filedClaimN = respondents.filter(
    (r) => r.filedClaim === "Yes" || r.filedClaim === "In progress"
  ).length;
  const stillRebuildingN = respondents.filter(
    (r) =>
      r.recoveryStage === "Actively rebuilding / navigating paperwork" ||
      r.recoveryStage === "Still trying to meet basic needs"
  ).length;
  const soughtSupportN = respondents.filter((r) =>
    r.mentalHealthSupport.startsWith("Yes")
  ).length;
  const wantSupportN = respondents.filter(
    (r) => r.mentalHealthSupport === "No, but I would like to"
  ).length;
  const hardInfoN = respondents.filter(
    (r) => r.infoEase === "Very difficult" || r.infoEase === "Difficult"
  ).length;
  const usedAIN = respondents.filter((r) => r.usedAI === "Yes").length;
  const humanHelperImportantN = respondents.filter(
    (r) =>
      r.humanHelperImportance === "Moderately important" ||
      r.humanHelperImportance === "Very important"
  ).length;

  const topChallenge = challengingAreasResult.rows[0]?.label ?? "—";
  const topNeed = helpNeededResult.rows[0]?.label ?? "—";
  const topInfoSource = infoSourcesResult.rows[0]?.label ?? "—";
  const topChannel = preferredChannelResult.rows[0]?.label ?? "—";
  const openTextN = respondents.filter((r) => r.mostOverwhelming.length > 20).length;

  const overviewKPIs: KPIValue[] = [
    { label: "Respondents", value: N, subtext: "Valid submissions" },
    { label: "Mean Age", value: N > 0 ? ageResult.mean.toFixed(1) : "—", subtext: `Range: ${ageResult.min}–${ageResult.max}` },
    { label: "% Still Displaced", value: pctOf(stillDisplacedN), subtext: `${stillDisplacedN} respondents` },
    { label: "% Poor/Very Poor WB", value: pctOf(poorWBN), subtext: `${poorWBN} respondents` },
    { label: "% AI Interested", value: pctOf(aiInterestedN), subtext: "Somewhat or Very" },
  ];

  const demographicsKPIs: KPIValue[] = [
    { label: "Respondents", value: N, subtext: "Valid submissions" },
    { label: "Mean Age", value: N > 0 ? ageResult.mean.toFixed(1) : "—", subtext: `SD ${ageResult.sd.toFixed(1)}` },
    { label: "% Parents", value: pctOf(parentsN), subtext: "Children under 18" },
    { label: "% Caregivers", value: pctOf(caregiversN), subtext: "For relative with disability" },
    { label: "% Pet Care", value: pctOf(petsN), subtext: "Currently caring for pet" },
  ];

  const fireImpactKPIs: KPIValue[] = [
    { label: "% Total Loss", value: pctOf(totalLossN), subtext: "Home completely destroyed" },
    { label: "% Still Displaced", value: pctOf(stillDisplacedN), subtext: "Currently displaced" },
    { label: "% Filed Claim", value: pctOf(filedClaimN), subtext: "Filed or in progress" },
    { label: "% Still Rebuilding", value: pctOf(stillRebuildingN), subtext: "Still in active recovery" },
  ];

  const recoveryKPIs: KPIValue[] = [
    { label: "Top Challenge", value: truncLabel(topChallenge), subtext: "Most selected area" },
    { label: "Open-Text Responses", value: openTextN, subtext: "With overwhelming text" },
    { label: "Top Helpful Source", value: "See breakdown", subtext: "Open text — manual review" },
  ];

  const wellbeingKPIs: KPIValue[] = [
    { label: "Mean Wellbeing", value: N > 0 ? `${wellbeingResult.mean.toFixed(1)} / 5` : "—", subtext: "1=Very poor, 5=Excellent" },
    { label: "% Poor/Very Poor", value: pctOf(poorWBN), subtext: `${poorWBN} respondents` },
    { label: "% Sought Support", value: pctOf(soughtSupportN), subtext: "Any mental health support" },
    { label: "% Want Support", value: pctOf(wantSupportN), subtext: "Would like to but haven't" },
  ];

  const resourceKPIs: KPIValue[] = [
    { label: "Top Need", value: truncLabel(topNeed), subtext: "Most selected" },
    { label: "% Hard to Find Info", value: pctOf(hardInfoN), subtext: "Difficult or Very difficult" },
    { label: "Top Info Source", value: truncLabel(topInfoSource), subtext: "Most cited" },
    { label: "Top Channel", value: truncLabel(topChannel), subtext: "Preferred delivery" },
  ];

  const aiKPIs: KPIValue[] = [
    { label: "% Used AI Before", value: pctOf(usedAIN), subtext: "Yes to prior AI use" },
    { label: "% AI Interested", value: pctOf(aiInterestedN), subtext: "Somewhat or Very interested" },
    { label: "Mean AI Comfort", value: N > 0 ? `${aiComfortResult.mean.toFixed(1)} / 5` : "—", subtext: "1=Very uncomfortable" },
    { label: "% Human Helper Important", value: pctOf(humanHelperImportantN), subtext: "Moderately or Very important" },
  ];

  // ── Tables groupings ───────────────────────────────────────────────────────
  const likertData: LikertResult[] = [
    insuranceSatisfactionResult,
    wellbeingResult,
    aiComfortResult,
    humanHelperResult,
    infoEaseResult,
  ];

  const categoricalData: CategoricalResult[] = [
    genderResult,
    childrenResult,
    caregiverResult,
    petResult,
    livingSituationResult,
    fireAffectedResult,
    insuranceAtTimeResult,
    insuranceClaimResult,
    displacementResult,
    recoveryStageResult,
    mentalHealthSupportResult,
    priorAIUseResult,
    aiInterestResult,
  ];

  const multiSelectData: MultiSelectResult[] = [
    fireImpactResult,
    challengingAreasResult,
    helpNeededResult,
    supportBarriersResult,
    aiToolInterestsResult,
    aiConcernsResult,
    infoSourcesResult,
    preferredChannelResult,
  ];

  return {
    N,
    claimFilersN,
    overviewKPIs,
    demographicsKPIs,
    fireImpactKPIs,
    recoveryKPIs,
    wellbeingKPIs,
    resourceKPIs,
    aiKPIs,
    ageResult,
    genderResult,
    childrenResult,
    caregiverResult,
    petResult,
    livingSituationResult,
    fireAffectedResult,
    fireImpactResult,
    insuranceAtTimeResult,
    insuranceClaimResult,
    insuranceSatisfactionResult,
    displacementResult,
    recoveryStageResult,
    challengingAreasResult,
    wellbeingResult,
    mentalHealthSupportResult,
    supportBarriersResult,
    helpNeededResult,
    infoEaseResult,
    infoSourcesResult,
    preferredChannelResult,
    priorAIUseResult,
    aiInterestResult,
    aiComfortResult,
    aiToolInterestsResult,
    aiConcernsResult,
    humanHelperResult,
    likertData,
    categoricalData,
    multiSelectData,
  };
}
