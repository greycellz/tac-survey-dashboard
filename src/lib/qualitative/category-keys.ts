import type { CategoryKey } from "@/types/qualitative";

/** Canonical iteration order for extraction categories (must match dashboard and affect coverage). */
export const QUALITATIVE_CATEGORY_KEYS: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];
