// ─── Question / Variable types ───────────────────────────────────────────────

export type QuestionType =
  | "numeric"
  | "single-select"
  | "multi-select"
  | "likert"
  | "open-text";

// ─── Core result types ────────────────────────────────────────────────────────

export interface CategoricalRow {
  label: string;
  n: number;
  pct: number;
  /** For conditional questions, subset this came from */
  subsetLabel?: string;
}

export interface CategoricalResult {
  question: string;
  type: QuestionType;
  validN: number;
  missingN: number;
  rows: CategoricalRow[];
}

export interface LikertResult {
  question: string;
  type: "likert";
  validN: number;
  missingN: number;
  /** Labels ordered lowest to highest */
  labels: string[];
  /** Counts parallel to labels */
  counts: number[];
  mean: number;
  sd: number;
  min: number;
  max: number;
}

export interface NumericResult {
  question: string;
  type: "numeric";
  validN: number;
  missingN: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  /** Histogram bins: [rangeLabel, count] */
  histogram: Array<{ label: string; count: number }>;
}

export interface MultiSelectResult {
  question: string;
  type: "multi-select";
  totalRespondents: number;
  rows: CategoricalRow[];
  /** Some multi-selects have an "Other" open text column */
  otherResponses?: string[];
}

// ─── KPI / stat card values ───────────────────────────────────────────────────

export interface KPIValue {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}

// ─── Open text / respondent model ─────────────────────────────────────────────

export type FireAffected = "Eaton Fire" | "Palisade Fire";
export type Gender = "Female" | "Male" | "Non-binary / another identity" | "Prefer not to say";
export type LivingSituation =
  | "In my rebuilt or original home"
  | "In temporary housing (rental, hotel, trailer, etc.)"
  | "Living with family/friends"
  | "Unhoused/unstable housing"
  | "Other";
export type WellbeingRating = "Excellent" | "Good" | "Fair" | "Poor" | "Very poor";
export type RecoveryStage =
  | "Still trying to meet basic needs"
  | "Actively rebuilding / navigating paperwork"
  | "Re-settled but still dealing with emotional or financial impacts"
  | "Feel mostly recovered"
  | "Other";
export type AIInterest = "Not interested at all" | "Somewhat interested" | "Very interested";
export type AIComfort =
  | "Very uncomfortable"
  | "Somewhat uncomfortable"
  | "Neutral"
  | "Somewhat comfortable"
  | "Very comfortable";
export type DisplacementDuration =
  | "Not displaced"
  | "Less than 1 month"
  | "1–6 months"
  | "6–12 months"
  | "More than a year"
  | "Still displaced";
export type InsuranceSatisfaction =
  | "Very dissatisfied"
  | "Dissatisfied"
  | "Neutral"
  | "Satisfied"
  | "Very satisfied";
export type HumanHelperImportance =
  | "Not important"
  | "Slightly important"
  | "Somewhat important"
  | "Moderately important"
  | "Very important";

/** Same labels as `AGE_BINS` in `lib/compute.ts` (age histogram bands). */
export type AgeBandLabel = "<20" | "20–29" | "30–39" | "40–49" | "50–59" | "60–69" | "70+";

export interface SurveyRespondent {
  id: string; // e.g. "ID-001"
  submissionNum: number;

  // Section 1: Demographics
  age: number;
  gender: Gender;
  hasChildren: boolean;
  isCaregiver: boolean;
  hasPet: boolean;
  livingSituation: LivingSituation;
  livingSituationOther?: string;

  // Section 2: Fire Experience
  fireAffected: FireAffected;
  fireImpacts: string[];
  fireImpactsOther?: string;
  hadInsurance: "Yes" | "No" | "Not sure";
  filedClaim: "Yes" | "No" | "In progress" | "Not applicable";
  insuranceSatisfaction?: InsuranceSatisfaction;
  displacementDuration: DisplacementDuration;
  recoveryStage: RecoveryStage;
  recoveryStageOther?: string;

  // Section 3: Recovery Pain Points
  challengingAreas: string[];
  challengingAreasOther?: string;
  mostOverwhelming: string;
  mostHelpful: string;
  whatWouldHaveHelped: string;

  // Section 4: Wellbeing & Support
  wellbeing: WellbeingRating;
  mentalHealthSupport: string;
  supportBarriers: string[];
  supportBarriersOther?: string;
  copingStrategies: string;

  // Section 5: Resource Access
  helpNeeded: string[];
  helpNeededOther?: string;
  infoEase: "Very difficult" | "Difficult" | "Neutral" | "Easy" | "Very easy";
  infoSources: string[];
  infoSourcesOther?: string;
  preferredChannel: string[];
  preferredChannelOther?: string;

  // Section 6: AI Attitudes
  usedAI: "Yes" | "No" | "Not sure";
  aiInterest: AIInterest;
  aiComfort: AIComfort;
  aiToolInterests: string[];
  aiToolInterestsOther?: string;
  aiConcerns: string[];
  aiConcernsOther?: string;
  humanHelperImportance: HumanHelperImportance;
  aiOneThingText: string;

  // Closing
  anythingElse: string;
  advice: string;
  mayShare: boolean;
}

// ─── Filter state ─────────────────────────────────────────────────────────────

export interface FilterState {
  fire: FireAffected | "All";
  gender: Gender | "All";
  ageBand: AgeBandLabel | "All";
  parent: "Yes" | "No" | "All";
  caregiver: "Yes" | "No" | "All";
  insurance: "Yes" | "No" | "Not sure" | "All";
  recoveryStage: RecoveryStage | "All";
  displacement: DisplacementDuration | "All";
  aiExperience: "Yes" | "No" | "Not sure" | "All";
}

export const DEFAULT_FILTER_STATE: FilterState = {
  fire: "All",
  gender: "All",
  ageBand: "All",
  parent: "All",
  caregiver: "All",
  insurance: "All",
  recoveryStage: "All",
  displacement: "All",
  aiExperience: "All",
};

// ─── Nav items ────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard/overview" },
  { label: "Demographics", href: "/dashboard/demographics" },
  { label: "Fire Impact", href: "/dashboard/fire-impact" },
  { label: "Recovery Challenges", href: "/dashboard/recovery-challenges" },
  { label: "Wellbeing & Support", href: "/dashboard/wellbeing" },
  { label: "Resource Access", href: "/dashboard/resource-access" },
  { label: "AI Attitudes", href: "/dashboard/ai-attitudes" },
  { label: "Open Responses", href: "/dashboard/open-responses" },
  { label: "Tables & Export", href: "/dashboard/tables" },
  { label: "Codebook", href: "/codebook" },
  { label: "Inferential Tests", href: "/inferential" },
];

// ─── Compare options ──────────────────────────────────────────────────────────

export const COMPARE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gender", label: "Gender" },
  { value: "fire", label: "Fire" },
  { value: "parent", label: "Parent" },
  { value: "caregiver", label: "Caregiver" },
  { value: "ai-experience", label: "AI Experience" },
  { value: "recovery-stage", label: "Recovery Stage" },
] as const;

export type CompareBy = (typeof COMPARE_OPTIONS)[number]["value"];

/** Canonical slot index sets stable compare bar colors (`--compare-{n}`). */
export interface SubgroupSlice {
  key: string;
  label: string;
  respondents: SurveyRespondent[];
  n: number;
  slotIndex: number;
}

/**
 * Use with shouldSuppressCompareForChart when the chart’s outcome is the same dimension as compare
 * (e.g. gender breakdown while comparing by gender).
 */
export type CompareChartId =
  | "gender"
  | "fire-affected"
  | "children"
  | "caregiver"
  | "prior-ai"
  | "recovery-stage";
