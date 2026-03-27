import type {
  SurveyRespondent,
  CompareBy,
  SubgroupSlice,
  CompareChartId,
  Gender,
  FireAffected,
  RecoveryStage,
} from "@/types/survey";
import { RECOVERY_STAGE_ORDER } from "@/lib/compute";

const GENDER_ORDER: Gender[] = [
  "Female",
  "Male",
  "Non-binary / another identity",
  "Prefer not to say",
];

const FIRE_ORDER: FireAffected[] = ["Eaton Fire", "Palisade Fire"];

const USED_AI_ORDER = ["Yes", "No", "Not sure"] as const;

type YesNoSlug = "yes" | "no";

/** Non-empty subgroups only; `slotIndex` is stable for `--compare-*` colors. */
export function splitByCompareDimension(
  respondents: SurveyRespondent[],
  compareBy: CompareBy
): SubgroupSlice[] {
  if (compareBy === "none") return [];

  if (compareBy === "gender") {
    return GENDER_ORDER.map((g, slotIndex) => {
      const inGroup = respondents.filter((r) => r.gender === g);
      return {
        key: g,
        label: g,
        respondents: inGroup,
        n: inGroup.length,
        slotIndex,
      };
    }).filter((s) => s.n > 0);
  }

  if (compareBy === "fire") {
    return FIRE_ORDER.map((f, slotIndex) => {
      const inGroup = respondents.filter((r) => r.fireAffected === f);
      return {
        key: f,
        label: f,
        respondents: inGroup,
        n: inGroup.length,
        slotIndex,
      };
    }).filter((s) => s.n > 0);
  }

  if (compareBy === "parent") {
    const defs: Array<{
      key: YesNoSlug;
      label: string;
      slotIndex: number;
      pick: (r: SurveyRespondent) => boolean;
    }> = [
      { key: "yes", label: "Yes", slotIndex: 0, pick: (r) => r.hasChildren },
      { key: "no", label: "No", slotIndex: 1, pick: (r) => !r.hasChildren },
    ];
    return defs
      .map(({ key, label, slotIndex, pick }) => {
        const inGroup = respondents.filter(pick);
        return {
          key,
          label,
          respondents: inGroup,
          n: inGroup.length,
          slotIndex,
        };
      })
      .filter((s) => s.n > 0);
  }

  if (compareBy === "caregiver") {
    const defs: Array<{
      key: YesNoSlug;
      label: string;
      slotIndex: number;
      pick: (r: SurveyRespondent) => boolean;
    }> = [
      { key: "yes", label: "Yes", slotIndex: 0, pick: (r) => r.isCaregiver },
      { key: "no", label: "No", slotIndex: 1, pick: (r) => !r.isCaregiver },
    ];
    return defs
      .map(({ key, label, slotIndex, pick }) => {
        const inGroup = respondents.filter(pick);
        return {
          key,
          label,
          respondents: inGroup,
          n: inGroup.length,
          slotIndex,
        };
      })
      .filter((s) => s.n > 0);
  }

  if (compareBy === "ai-experience") {
    return USED_AI_ORDER.map((u, slotIndex) => {
      const inGroup = respondents.filter((r) => r.usedAI === u);
      return {
        key: u,
        label: u,
        respondents: inGroup,
        n: inGroup.length,
        slotIndex,
      };
    }).filter((s) => s.n > 0);
  }

  if (compareBy === "recovery-stage") {
    return (RECOVERY_STAGE_ORDER as readonly RecoveryStage[]).map((stage, slotIndex) => {
      const inGroup = respondents.filter((r) => r.recoveryStage === stage);
      return {
        key: stage,
        label: stage,
        respondents: inGroup,
        n: inGroup.length,
        slotIndex,
      };
    }).filter((s) => s.n > 0);
  }

  return [];
}

export function shouldSuppressCompareForChart(compareBy: CompareBy, chartId: CompareChartId | null): boolean {
  if (compareBy === "none" || chartId === null) return false;
  if (compareBy === "gender" && chartId === "gender") return true;
  if (compareBy === "fire" && chartId === "fire-affected") return true;
  if (compareBy === "parent" && chartId === "children") return true;
  if (compareBy === "caregiver" && chartId === "caregiver") return true;
  if (compareBy === "ai-experience" && chartId === "prior-ai") return true;
  if (compareBy === "recovery-stage" && chartId === "recovery-stage") return true;
  return false;
}
