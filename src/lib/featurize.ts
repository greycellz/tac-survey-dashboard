/** Prepared analysis layer — turns survey rows into a wide matrix + codebook schema. */

import type { SurveyRespondent } from "@/types/survey";
import { LIKERT_CONFIGS } from "@/lib/compute";
import { jStat } from "@/lib/jstat-imports";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FeatureValue = number | null;

export interface ReferenceDistribution {
  scope: "full_sample";
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
  outliersAbove2SD: number;
}

export interface VariableDef {
  name: string;
  label: string;
  type: "numeric" | "binary" | "ordinal" | "nominal";
  source: {
    kind: "direct" | "likert" | "multiselect_member" | "categorical_match" | "composite" | "computed";
    sourceField: string;
    sourceQuestion?: string;
  };
  derivation: string;
  levels?: { value: number; label: string }[];
  notes?: string;
  referenceDistribution?: ReferenceDistribution;
}

export interface CompositeConfig {
  totalLoss: { members: string[] };
  anyDamage: { members: string[] };
  exposureTier: {
    totalLossMembers: string[];
    partialOrSmokeMembers: string[];
  };
  accessBarrier: { members: string[] };
  aiEmoSupport: { members: string[] };
}

export const DEFAULT_COMPOSITES: CompositeConfig = {
  totalLoss: { members: ["Home completely destroyed"] },
  anyDamage: {
    members: ["Home completely destroyed", "Home partially damaged", "Smoke damage only"],
  },
  exposureTier: {
    totalLossMembers: ["Home completely destroyed"],
    partialOrSmokeMembers: ["Home partially damaged", "Smoke damage only"],
  },
  accessBarrier: {
    members: [
      "Cost",
      "Lack of time",
      "Stigma / privacy concerns",
      "Hard to find trusted providers",
      "Don't know where to start",
      "Don\u2019t know where to start",
    ],
  },
  aiEmoSupport: {
    members: ["AI chatbot to deliver emotional support for navigating disaster"],
  },
};

export interface FeatureBundle {
  schema: VariableDef[];
  matrix: Record<string, FeatureValue>[];
  observedMultiSelectOptions: Record<string, string[]>;
  warnings: string[];
}

// ─── Question text mirrors `COL` in `csv-parser.ts` (for reviewer traceability only) ─

const SQ: Partial<Record<keyof SurveyRespondent | string, string>> = {
  submissionNum: "Submission #",
  age: "What is your age?",
  gender: "What is your gender?",
  hasChildren: "Do you have children under the age of 18?",
  isCaregiver: "Are you a caregiver for a relative with a disability or health condition?",
  hasPet: "Are you currently caring for a pet?",
  fireAffected: "Which fire(s) affected you most directly?",
  displacementDuration: "How long were you displaced from your home (if applicable)?",
  filedClaim: "Have you filed an insurance claim?",
  insuranceSatisfaction: "If yes, how satisfied are you with your insurance process so far?",
  wellbeing: "How would you describe your emotional wellbeing right now?",
  infoEase: "How easy has it been to find accurate and up-to-date information about available resources?",
  aiComfort: "How comfortable would you feel using an AI-powered Disaster Recovery Coach?",
  aiInterest: "How interested would you be in using an AI chatbot as part of your fire recovery process?",
  humanHelperImportance: "How important is it to you that a human helper is available alongside an AI tool?",
  mentalHealthSupport: "Have you sought any emotional or mental health support since the fire?",
  fireImpacts: "How were you impacted by the fire? (check all that apply)",
  challengingAreas: "Since the fire, which areas have been most challenging for you? (Select up to 3)",
  supportBarriers: "What barriers make it hard to get emotional or mental health support? (check all that apply)",
  helpNeeded: "Which types of help do you most need right now? (Select all that apply)",
  infoSources: "Where do you usually look for assistance, guidance, or information?",
  preferredChannel: "How would you prefer to receive support or information?",
  aiToolInterests: "Interest in AI tools (select any that apply)",
  aiConcerns: "What concerns, if any, do you have about using AI for disaster recovery or emotional support?",
};

const MULTI_CONFIG: ReadonlyArray<{
  field: keyof SurveyRespondent;
  prefix: string;
}> = [
  { field: "fireImpacts", prefix: "fi" },
  { field: "challengingAreas", prefix: "ca" },
  { field: "supportBarriers", prefix: "sb" },
  { field: "helpNeeded", prefix: "hn" },
  { field: "infoSources", prefix: "is" },
  { field: "preferredChannel", prefix: "pc" },
  { field: "aiToolInterests", prefix: "ait" },
  { field: "aiConcerns", prefix: "aic" },
];

/** Same pattern as `normalizeNumericLabel` in `csv-parser.ts`. */
function normalizeNumericLabel(val: string): string {
  const match = val.trim().match(/^\d+\s+\((.+)\)$/);
  return match ? match[1].trim() : val.trim();
}

function slugOption(s: string, maxLen = 40): string {
  let t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!t.length) t = "unknown";
  if (t.length > maxLen) t = t.slice(0, maxLen).replace(/_+$/g, "");
  return t;
}

/** Unique slugs across one multi-select vocabulary. */
function assignSlugs(options: string[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const opt of [...options].sort((a, b) => a.localeCompare(b))) {
    let slug = slugOption(opt);
    if (used.has(slug)) {
      let i = 2;
      while (used.has(`${slug}_${i}`)) i++;
      slug = `${slug}_${i}`;
    }
    used.add(slug);
    map.set(opt, slug);
  }
  return map;
}

function collectMultiOptions(all: SurveyRespondent[], field: keyof SurveyRespondent): string[] {
  const set = new Set<string>();
  for (const r of all) {
    const arr = r[field];
    if (!Array.isArray(arr)) continue;
    for (const x of arr) {
      if (typeof x === "string" && x.trim()) set.add(x.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function likertNum(value: string, configKey: keyof typeof LIKERT_CONFIGS): number | null {
  const v = value?.trim();
  if (!v) return null;
  const scale = LIKERT_CONFIGS[configKey]?.scale;
  if (!scale) return null;
  const n = scale[v];
  return typeof n === "number" ? n : null;
}

/** Three-point ordinal spread to 1 / 3 / 5 per brief (explicit in derivation). */
function aiInterestNum(r: SurveyRespondent): number | null {
  const label = normalizeNumericLabel(String(r.aiInterest ?? ""));
  const map: Record<string, number> = {
    "Not interested at all": 1,
    "Somewhat interested": 3,
    "Very interested": 5,
  };
  const n = map[label];
  return typeof n === "number" ? n : null;
}

function insuranceSatisfactionNum(r: SurveyRespondent): number | null {
  if (r.filedClaim !== "Yes" && r.filedClaim !== "In progress") return null;
  const s = r.insuranceSatisfaction;
  if (!s) return null;
  return likertNum(s, "insuranceSatisfaction");
}

function computeReferenceDistribution(vals: number[]): ReferenceDistribution | undefined {
  if (vals.length < 2) return undefined;
  const mean = jStat.mean(vals) as number;
  const sd = jStat.stdev(vals, true) as number;
  if (sd === 0 || Number.isNaN(sd)) {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return {
      scope: "full_sample",
      n: vals.length,
      mean,
      sd: 0,
      min,
      max,
      skewness: 0,
      kurtosis: 0,
      outliersAbove2SD: 0,
    };
  }
  let out = 0;
  for (const x of vals) {
    if (Math.abs((x - mean) / sd) > 2) out++;
  }
  return {
    scope: "full_sample",
    n: vals.length,
    mean,
    sd,
    min: Math.min(...vals),
    max: Math.max(...vals),
    skewness: jStat.skewness(vals) as number,
    kurtosis: jStat.kurtosis(vals) as number,
    outliersAbove2SD: out,
  };
}

function rowValues(
  r: SurveyRespondent,
  composite: CompositeConfig,
  optionSlugs: Map<string, Map<string, string>>
): Record<string, FeatureValue> {
  const row: Record<string, FeatureValue> = {};

  row.submission_num = r.submissionNum;
  row.age = typeof r.age === "number" && !Number.isNaN(r.age) && r.age > 0 ? r.age : null;

  row.is_female = r.gender === "Female" ? 1 : 0;
  row.is_male = r.gender === "Male" ? 1 : 0;

  row.has_children = r.hasChildren ? 1 : 0;
  row.is_caregiver = r.isCaregiver ? 1 : 0;
  row.has_pet = r.hasPet ? 1 : 0;

  row.had_insurance = r.hadInsurance === "Yes" ? 1 : 0;
  row.filed_claim = r.filedClaim === "Yes" || r.filedClaim === "In progress" ? 1 : 0;
  row.prior_ai_use = r.usedAI === "Yes" ? 1 : 0;
  row.is_eaton = r.fireAffected === "Eaton Fire" ? 1 : 0;
  row.is_palisade = r.fireAffected === "Palisade Fire" ? 1 : 0;
  /** Same rule as KPI "% Still Displaced" in `compute.ts` (`displacementDuration === "Still displaced"`). */
  row.still_displaced = r.displacementDuration === "Still displaced" ? 1 : 0;

  const mh = String(r.mentalHealthSupport ?? "");
  row.any_mh_util = mh.startsWith("Yes") ? 1 : 0;
  row.wants_mh_support = mh === "No, but I would like to" ? 1 : 0;

  row.wellbeing_num = likertNum(r.wellbeing, "wellbeing");
  row.insurance_satisfaction_num = insuranceSatisfactionNum(r);
  row.info_ease_num = likertNum(r.infoEase, "infoEase");
  row.ai_comfort_num = likertNum(r.aiComfort, "aiComfort");
  row.ai_interest_num = aiInterestNum(r);
  row.human_helper_importance_num = likertNum(r.humanHelperImportance, "humanHelperImportance");

  const tls = composite.totalLoss.members.some((m) => r.fireImpacts.includes(m)) ? 1 : 0;
  row.totalLoss = composite.totalLoss.members.length === 0 ? null : tls;

  const ad =
    composite.anyDamage.members.length === 0
      ? null
      : composite.anyDamage.members.some((m) => r.fireImpacts.includes(m))
        ? 1
        : 0;
  row.anyDamage = ad;

  let tier: FeatureValue = 0;
  if (
    composite.exposureTier.totalLossMembers.some((m) => r.fireImpacts.includes(m)) &&
    composite.exposureTier.totalLossMembers.length > 0
  ) {
    tier = 2;
  } else if (
    composite.exposureTier.partialOrSmokeMembers.some((m) => r.fireImpacts.includes(m)) &&
    composite.exposureTier.partialOrSmokeMembers.length > 0
  ) {
    tier = 1;
  }
  row.exposureTier =
    composite.exposureTier.totalLossMembers.length === 0 && composite.exposureTier.partialOrSmokeMembers.length === 0
      ? null
      : tier;

  const ab =
    composite.accessBarrier.members.length === 0
      ? null
      : composite.accessBarrier.members.some((m) => r.supportBarriers.includes(m))
        ? 1
        : 0;
  row.accessBarrier = ab;

  const aiEmo =
    composite.aiEmoSupport.members.length === 0
      ? null
      : composite.aiEmoSupport.members.some((m) => r.aiToolInterests.includes(m))
        ? 1
        : 0;
  row.ai_emo_support = aiEmo;

  for (const { field, prefix } of MULTI_CONFIG) {
    const slugMap = optionSlugs.get(field as string)!;
    const arr = (r[field] as string[]) ?? [];
    const set = new Set(arr.filter(Boolean));
    for (const opt of Array.from(slugMap.keys())) {
      const slug = slugMap.get(opt)!;
      row[`${prefix}_${slug}`] = set.has(opt) ? 1 : 0;
    }
  }

  return row;
}

/** Build slug map keyed by Respondent field names. */
function buildOptionSlugMaps(all: SurveyRespondent[]): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const { field } of MULTI_CONFIG) {
    const opts = collectMultiOptions(all, field);
    out.set(field as string, assignSlugs(opts));
  }
  return out;
}

function buildCompositeWarnings(all: SurveyRespondent[], composites: CompositeConfig): string[] {
  const w: string[] = [];
  const observedBarriers = new Set(collectMultiOptions(all, "supportBarriers"));
  const obsBarrierOverlap = composites.accessBarrier.members.filter((m) => observedBarriers.has(m)).length;
  if (composites.accessBarrier.members.length === 0) {
    w.push("accessBarrier composite has no configured members — `accessBarrier` is all missing.");
  } else if (obsBarrierOverlap === 0) {
    w.push(
      "None of the configured `accessBarrier` strings matched any observed `supportBarriers` option in this dataset — check apostrophe/spelling vs. CSV."
    );
  }

  const observedAITools = new Set(collectMultiOptions(all, "aiToolInterests"));
  const obsAiOverlap = composites.aiEmoSupport.members.filter((m) => observedAITools.has(m)).length;
  if (composites.aiEmoSupport.members.length === 0) {
    w.push("aiEmoSupport composite has no members — `ai_emo_support` is all missing.");
  } else if (obsAiOverlap === 0) {
    w.push(
      "aiEmoSupport default option(s) not found verbatim in aiToolInterests — configure composite on the Codebook page before interpreting B7 / C1 / C2."
    );
  }

  if (composites.totalLoss.members.length === 0) {
    w.push("totalLoss composite member list is empty — `totalLoss` is all missing.");
  }
  if (composites.anyDamage.members.length === 0) {
    w.push("anyDamage composite member list is empty — `anyDamage` is all missing.");
  }
  if (
    composites.exposureTier.totalLossMembers.length === 0 &&
    composites.exposureTier.partialOrSmokeMembers.length === 0
  ) {
    w.push("exposureTier composites unconfigured — `exposureTier` is all missing.");
  }

  return w;
}

function buildSchema(
  optionMaps: Map<string, Map<string, string>>,
  fullMatrix: Record<string, FeatureValue>[],
  composites: CompositeConfig
): VariableDef[] {
  const defs: VariableDef[] = [];

  defs.push({
    name: "submission_num",
    label: "Submission number",
    type: "nominal",
    source: { kind: "direct", sourceField: "submissionNum", sourceQuestion: SQ.submissionNum },
    derivation: "Numeric identifier from Submission #.",
    notes: "Row key for traceability — distribution statistics suppressed.",
  });
  defs.push({
    name: "age",
    label: SQ.age ?? "Age",
    type: "numeric",
    source: { kind: "direct", sourceField: "age", sourceQuestion: SQ.age },
    derivation: "Age in years where present; invalid/zero treated as missing (matches dashboard histogram rules).",
    notes: "Age ≤ 0 coded as missing to align with numeric summaries in descriptive pipeline.",
  });
  defs.push({
    name: "is_female",
    label: "Female (binary)",
    type: "binary",
    source: { kind: "categorical_match", sourceField: "gender", sourceQuestion: SQ.gender },
    derivation: `1 if gender === "Female"; else 0.`,
    levels: [
      { value: 0, label: "Not female" },
      { value: 1, label: "Female" },
    ],
    notes: "Non-binary / PNTS / missing gender coded 0.",
  });
  defs.push({
    name: "is_male",
    label: "Male (binary)",
    type: "binary",
    source: { kind: "categorical_match", sourceField: "gender", sourceQuestion: SQ.gender },
    derivation: `1 if gender === "Male"; else 0.`,
    levels: [
      { value: 0, label: "Not male" },
      { value: 1, label: "Male" },
    ],
  });
  defs.push({
    name: "has_children",
    label: "Parent of child under 18",
    type: "binary",
    source: { kind: "direct", sourceField: "hasChildren", sourceQuestion: SQ.hasChildren },
    derivation: "1 if boolean `hasChildren` true in parsed CSV.",
    notes: `CSV booleans mapped to booleans — not literal "Yes" strings.`,
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "is_caregiver",
    label: "Caregiver for relative with disability/health condition",
    type: "binary",
    source: { kind: "direct", sourceField: "isCaregiver", sourceQuestion: SQ.isCaregiver },
    derivation: "1 if `isCaregiver` true.",
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "has_pet",
    label: "Caring for pet",
    type: "binary",
    source: { kind: "direct", sourceField: "hasPet", sourceQuestion: SQ.hasPet },
    derivation: "1 if `hasPet` true.",
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "had_insurance",
    label: "Had homeowners/renters insurance at time",
    type: "binary",
    source: {
      kind: "categorical_match",
      sourceField: "hadInsurance",
      sourceQuestion: "Did you have homeowners or renters insurance at the time?",
    },
    derivation: `1 if hadInsurance === "Yes"; else 0.`,
  });
  defs.push({
    name: "filed_claim",
    label: "Filed insurance claim (or in progress)",
    type: "binary",
    source: { kind: "categorical_match", sourceField: "filedClaim", sourceQuestion: SQ.filedClaim },
    derivation: `1 if filedClaim is "Yes" or "In progress"; else 0.`,
    notes: `Treats an in-flight claim ("In progress") as having filed.`,
  });
  defs.push({
    name: "prior_ai_use",
    label: "Prior AI / chatbot use",
    type: "binary",
    source: {
      kind: "categorical_match",
      sourceField: "usedAI",
      sourceQuestion: "Have you ever used an AI tool or chatbot before?",
    },
    derivation: `1 if usedAI === "Yes".`,
  });
  defs.push({
    name: "is_eaton",
    label: "Affected primarily by Eaton Fire",
    type: "binary",
    source: {
      kind: "categorical_match",
      sourceField: "fireAffected",
      sourceQuestion: SQ.fireAffected,
    },
    derivation: `1 if fireAffected === "Eaton Fire"; else 0.`,
    notes: "Inferential Eaton-vs-Palisade contrasts restrict to respondents with exactly one of is_eaton or is_palisade equal to 1.",
  });
  defs.push({
    name: "is_palisade",
    label: "Affected primarily by Palisade Fire",
    type: "binary",
    source: {
      kind: "categorical_match",
      sourceField: "fireAffected",
      sourceQuestion: SQ.fireAffected,
    },
    derivation: `1 if fireAffected === "Palisade Fire"; else 0.`,
    notes: "Respondents coded to another fire/event are coded 0 on both binaries and omitted from Eaton-vs-Palisade tests.",
  });
  defs.push({
    name: "still_displaced",
    label: "Still displaced (current displacement status)",
    type: "binary",
    source: { kind: "categorical_match", sourceField: "displacementDuration", sourceQuestion: SQ.displacementDuration },
    derivation: `1 if displacementDuration === "Still displaced"; else 0.`,
    notes: "Matches KPI “% Still Displaced” in `compute.ts` (not inferred from recovery stage).",
  });
  defs.push({
    name: "any_mh_util",
    label: "Any mental-health support utilization",
    type: "binary",
    source: { kind: "computed", sourceField: "mentalHealthSupport", sourceQuestion: SQ.mentalHealthSupport },
    derivation: "1 if `mentalHealthSupport` string startsWith \"Yes\" (dashboard rule).",
  });
  defs.push({
    name: "wants_mh_support",
    label: "Wants MH support but has not attempted",
    type: "binary",
    source: { kind: "computed", sourceField: "mentalHealthSupport", sourceQuestion: SQ.mentalHealthSupport },
    derivation: `1 if equals exact string \"No, but I would like to\".`,
  });

  defs.push({
    name: "wellbeing_num",
    label: SQ.wellbeing ?? "Wellbeing (numeric)",
    type: "ordinal",
    source: { kind: "likert", sourceField: "wellbeing", sourceQuestion: SQ.wellbeing },
    derivation: `Maps wellbeing labels via shared LIKERT_CONFIGS wellbeing scale (${Object.keys(LIKERT_CONFIGS.wellbeing.scale).join(", ")}).`,
    notes: `${LIKERT_CONFIGS.wellbeing.scale["Very poor"]}=Very poor … ${LIKERT_CONFIGS.wellbeing.scale.Excellent}=Excellent.`,
    levels: LIKERT_CONFIGS.wellbeing.labels.map((l) => ({ value: LIKERT_CONFIGS.wellbeing.scale[l], label: l })),
  });
  defs.push({
    name: "insurance_satisfaction_num",
    label: "Insurance satisfaction (numeric)",
    type: "ordinal",
    source: {
      kind: "likert",
      sourceField: "insuranceSatisfaction",
      sourceQuestion: SQ.insuranceSatisfaction,
    },
    derivation: "Only defined for respondents with filedClaim \"Yes\" or \"In progress\" and non-empty satisfaction.",
    notes: `Null for non–claim-filers (${LIKERT_CONFIGS.insuranceSatisfaction.scale["Very dissatisfied"]}=dissatisfied pole).`,
    levels: LIKERT_CONFIGS.insuranceSatisfaction.labels.map((l) => ({
      value: LIKERT_CONFIGS.insuranceSatisfaction.scale[l],
      label: l,
    })),
  });
  defs.push({
    name: "info_ease_num",
    label: SQ.infoEase ?? "Finding info ease (numeric)",
    type: "ordinal",
    source: { kind: "likert", sourceField: "infoEase", sourceQuestion: SQ.infoEase },
    derivation: `Maps infoEase labels via LIKERT_CONFIGS infoEase.`,
    levels: LIKERT_CONFIGS.infoEase.labels.map((l) => ({ value: LIKERT_CONFIGS.infoEase.scale[l], label: l })),
  });
  defs.push({
    name: "ai_comfort_num",
    label: SQ.aiComfort ?? "AI comfort",
    type: "ordinal",
    source: { kind: "likert", sourceField: "aiComfort", sourceQuestion: SQ.aiComfort },
    derivation: `Maps aiComfort labels via LIKERT_CONFIGS aiComfort.`,
    levels: LIKERT_CONFIGS.aiComfort.labels.map((l) => ({ value: LIKERT_CONFIGS.aiComfort.scale[l], label: l })),
  });
  defs.push({
    name: "ai_interest_num",
    label: SQ.aiInterest ?? "AI interest",
    type: "ordinal",
    source: { kind: "likert", sourceField: "aiInterest", sourceQuestion: SQ.aiInterest },
    derivation:
      'After stripping optional "n (Label)" exporter prefix (`normalizeNumericLabel`), maps three labels to ordinal scores 1, 3, 5 for equal spacing.',
    notes: '"Not interested at all"→1; "Somewhat interested"→3; "Very interested"→5.',
    levels: [
      { value: 1, label: "Not interested at all" },
      { value: 3, label: "Somewhat interested" },
      { value: 5, label: "Very interested" },
    ],
  });
  defs.push({
    name: "human_helper_importance_num",
    label: SQ.humanHelperImportance ?? "Human helper importance",
    type: "ordinal",
    source: {
      kind: "likert",
      sourceField: "humanHelperImportance",
      sourceQuestion: SQ.humanHelperImportance,
    },
    derivation: `Maps labels via LIKERT_CONFIGS humanHelperImportance.`,
    levels: LIKERT_CONFIGS.humanHelperImportance.labels.map((l) => ({
      value: LIKERT_CONFIGS.humanHelperImportance.scale[l],
      label: l,
    })),
  });

  defs.push({
    name: "totalLoss",
    label: "Total property loss composite",
    type: "binary",
    source: { kind: "composite", sourceField: "fireImpacts", sourceQuestion: SQ.fireImpacts },
    derivation:
      `1 if any configured member occurs in fireImpacts; default members: ${composites.totalLoss.members.join("; ")}`,
    notes:
      composites.totalLoss.members.length === 0
        ? "Composite member list empty — values are missing."
        : undefined,
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "anyDamage",
    label: "Any selected property damage composite",
    type: "binary",
    source: { kind: "composite", sourceField: "fireImpacts", sourceQuestion: SQ.fireImpacts },
    derivation: `Default: OR of (${composites.anyDamage.members.join("; ")}). Evac-no-damage respondents stay 0.`,
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "exposureTier",
    label: "Exposure tier (ordinal)",
    type: "ordinal",
    source: { kind: "composite", sourceField: "fireImpacts", sourceQuestion: SQ.fireImpacts },
    derivation:
      `2 if any loss in totalLossMembers; else 1 if any partial/smoke hit; else 0 (evac-only / unrelated).`,
    levels: [
      { value: 0, label: "Evac/no configured damage tier" },
      { value: 1, label: "Partial / smoke tier" },
      { value: 2, label: "Total loss tier" },
    ],
    notes:
      composites.exposureTier.totalLossMembers.length === 0 && composites.exposureTier.partialOrSmokeMembers.length === 0
        ? "Exposure tier composites empty — coded missing."
        : undefined,
  });
  defs.push({
    name: "accessBarrier",
    label: "Any configured access-barrier cited",
    type: "binary",
    source: { kind: "composite", sourceField: "supportBarriers", sourceQuestion: SQ.supportBarriers },
    derivation: `1 if any barrier string matches composite member list verbatim.`,
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });
  defs.push({
    name: "ai_emo_support",
    label: "AI emotional-support tool interest composite",
    type: "binary",
    source: { kind: "composite", sourceField: "aiToolInterests", sourceQuestion: SQ.aiToolInterests },
    derivation: `1 if any configured member string equals an element of aiToolInterests (verbatim; semicolon-split in CSV).`,
    levels: [
      { value: 0, label: "No" },
      { value: 1, label: "Yes" },
    ],
  });

  for (const { field, prefix } of MULTI_CONFIG) {
    const q = SQ[field];
    const map = optionMaps.get(field as string)!;
    for (const opt of Array.from(map.keys()).sort((a, b) => a.localeCompare(b))) {
      const slug = map.get(opt)!;
      defs.push({
        name: `${prefix}_${slug}`,
        label: `${opt}`,
        type: "binary",
        source: {
          kind: "multiselect_member",
          sourceField: field as string,
          sourceQuestion: q,
        },
        derivation: `1 if respondent’s ${field} array includes exactly this label (semicolon-split in CSV).`,
      });
    }
  }

  for (const def of defs) {
    if (def.type !== "numeric" && def.type !== "ordinal") continue;
    const col = fullMatrix
      .map((row) => row[def.name])
      .filter((v): v is number => typeof v === "number" && v !== null);
    def.referenceDistribution = computeReferenceDistribution(col);
  }

  return defs;
}

export function observedMultiSelectVocab(allRespondents: SurveyRespondent[]): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const { field } of MULTI_CONFIG) {
    o[field as string] = collectMultiOptions(allRespondents, field);
  }
  return o;
}

export function featurize(
  allRespondents: SurveyRespondent[],
  filteredRespondents: SurveyRespondent[],
  composites: CompositeConfig = DEFAULT_COMPOSITES
): FeatureBundle {
  const optionMaps = buildOptionSlugMaps(allRespondents);
  const warnings = buildCompositeWarnings(allRespondents, composites);

  const fullMatrix = allRespondents.map((r) => rowValues(r, composites, optionMaps));

  const schema = buildSchema(optionMaps, fullMatrix, composites);

  const matrix = filteredRespondents.map((r) => rowValues(r, composites, optionMaps));

  const observedMultiSelectOptions = observedMultiSelectVocab(allRespondents);

  return { schema, matrix, observedMultiSelectOptions, warnings };
}
