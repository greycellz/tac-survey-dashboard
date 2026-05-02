import { describe, expect, it } from "vitest";
import { featurize } from "./featurize";
import type { SurveyRespondent } from "@/types/survey";

/** Minimal respondent for shape checks only (many fields intentionally blank). */
function base(id: number, patch: Partial<SurveyRespondent>): SurveyRespondent {
  return {
    id: String(id),
    submissionNum: id,
    age: 40,
    gender: "Female",
    hasChildren: true,
    isCaregiver: false,
    hasPet: false,
    livingSituation: "In my rebuilt or original home",
    fireAffected: "Eaton Fire",
    fireImpacts: [],
    hadInsurance: "Yes",
    filedClaim: "Yes",
    displacementDuration: "Not displaced",
    recoveryStage: "Feel mostly recovered",
    challengingAreas: [],
    mostOverwhelming: "x".repeat(25),
    mostHelpful: "friends",
    whatWouldHaveHelped: "x".repeat(15),
    wellbeing: "Good",
    mentalHealthSupport: "Yes, from a therapist or counselor",
    supportBarriers: [],
    copingStrategies: "x".repeat(15),
    helpNeeded: [],
    infoEase: "Easy",
    infoSources: [],
    preferredChannel: [],
    usedAI: "Yes",
    aiInterest: "Somewhat interested",
    aiComfort: "Neutral",
    aiToolInterests: [],
    aiConcerns: [],
    humanHelperImportance: "Moderately important",
    aiOneThingText: "",
    anythingElse: "",
    advice: "",
    mayShare: true,
    ...patch,
  } as SurveyRespondent;
}

describe("featurize", () => {
  it("computes demographics binarization from booleans", () => {
    const all = [
      base(1, {}),
      base(2, { gender: "Male", age: -1, aiInterest: "Very interested", fireImpacts: ["Home completely destroyed"] }),
    ];
    const f = featurize(all, all.slice(0, 1));
    expect(f.matrix[0]!.submission_num).toBe(1);
    expect(f.matrix[0]!.is_female).toBe(1);
    expect(f.matrix[0]!.ai_interest_num).toBe(3);
    expect(f.schema.find((x) => x.name === "is_eaton")).toBeTruthy();
    expect(f.matrix[0]!.still_displaced).toBe(0);
  });
});
