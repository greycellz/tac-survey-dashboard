import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QualitativeDataProvider, useQualitativeData } from "../QualitativeDataContext";
import type {
  QualitativeBundle,
  ParticipantId,
  ValidatedExtraction,
  CategoryKey,
} from "@/types/qualitative";

function makeExt(
  participantId: ParticipantId,
  quotes: { codeIds: string[]; quoteVerbatim: string; cueNumber: number }[],
): ValidatedExtraction {
  const emotionalImpact = quotes.map((q) => ({
    quoteVerbatim: q.quoteVerbatim,
    codeIds: q.codeIds,
    citation: {
      participantId,
      transcriptPath: "x",
      transcriptSha256: "a".repeat(64),
      quoteVerbatim: q.quoteVerbatim,
      flatCharStart: 0,
      flatCharEnd: q.quoteVerbatim.length,
      cueNumber: q.cueNumber,
      startTime: "00:00:01.000",
      contextBefore: "",
      contextAfter: "",
    },
  }));

  const empty = (): [] => [];

  return {
    participantId,
    transcriptSha256: "a".repeat(64),
    skillVersion: "v1.2.0",
    codebookVersion: "v1.2.0",
    generatedAt: new Date().toISOString(),
    validatedAt: new Date().toISOString(),
    summary: "test",
    mvpAdversarialAudit: { endorsementsAttempted: true, hesitationsAttempted: true, notes: "" },
    rejected: [],
    codedQuotes: {
      lifeAndRoutineChanges: empty(),
      emotionalImpact,
      recoveryChallengesAndPainPoints: empty(),
      needsOverTime: empty(),
      technologyForRecovery: empty(),
      aiAttitudesAndBeliefs: empty(),
      mvpFeedback: empty(),
      crossCutting: empty(),
    },
  };
}

const FIXTURE: QualitativeBundle = {
  manifest: {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: [
      {
        id: "INT001",
        transcriptFilename: "INT001.md",
        transcriptPath: "INT001.md",
        transcriptSha256: "a".repeat(64),
        cueCount: 5,
        participantCueCount: 3,
        interviewerCueCount: 2,
        demographics: {
          age: 35,
          gender: "Female",
          hasChildrenUnder18: true,
          isCaregiverForRelative: false,
          hasPet: null,
          livingSituation: null,
          fireAffectedMost: null,
          displacementDuration: null,
          recoveryStage: "Active rebuild",
          emotionalWellbeing: null,
          hasSoughtMentalHealthSupport: null,
          hasUsedAiBefore: null,
          aiChatbotInterest: null,
          fireImpactTypes: null,
          challengingAreas: null,
          mentalHealthBarriers: null,
          helpNeededNow: null,
          mostOverwhelming: null,
          mostHelpful: null,
          whatWouldHaveHelped: null,
          copingMechanisms: null,
          aiCoachWish: null,
          additionalSharing: null,
          adviceForOthers: null,
        },
        mvpDemoShown: true,
        builtAt: new Date().toISOString(),
      },
      {
        id: "INT002",
        transcriptFilename: "INT002.md",
        transcriptPath: "INT002.md",
        transcriptSha256: "b".repeat(64),
        cueCount: 3,
        participantCueCount: 2,
        interviewerCueCount: 1,
        demographics: {
          age: 65,
          gender: "Male",
          hasChildrenUnder18: false,
          isCaregiverForRelative: true,
          hasPet: null,
          livingSituation: null,
          fireAffectedMost: null,
          displacementDuration: null,
          recoveryStage: "Stable",
          emotionalWellbeing: null,
          hasSoughtMentalHealthSupport: null,
          hasUsedAiBefore: null,
          aiChatbotInterest: null,
          fireImpactTypes: null,
          challengingAreas: null,
          mentalHealthBarriers: null,
          helpNeededNow: null,
          mostOverwhelming: null,
          mostHelpful: null,
          whatWouldHaveHelped: null,
          copingMechanisms: null,
          aiCoachWish: null,
          additionalSharing: null,
          adviceForOthers: null,
        },
        mvpDemoShown: true,
        builtAt: new Date().toISOString(),
      },
    ],
  },
  codebook: {
    version: "v1.2.0",
    generatedAt: new Date().toISOString(),
    entries: [
      { id: "x_code", category: "emotionalImpact" as CategoryKey, name: "X", definition: "x" },
      { id: "y_code", category: "emotionalImpact" as CategoryKey, name: "Y", definition: "y" },
    ],
  },
  extractions: {
    INT001: makeExt("INT001", [
      { codeIds: ["x_code"], quoteVerbatim: "first quote", cueNumber: 5 },
      { codeIds: ["y_code"], quoteVerbatim: "second quote", cueNumber: 7 },
    ]),
    INT002: makeExt("INT002", [{ codeIds: ["x_code", "y_code"], quoteVerbatim: "third quote", cueNumber: 3 }]),
  },
  transcripts: {
    INT001: {
      participantId: "INT001",
      cues: [],
      flatText: "",
      speakerSpans: [],
      participantCueCount: 0,
      interviewerCueCount: 0,
    },
    INT002: {
      participantId: "INT002",
      cues: [],
      flatText: "",
      speakerSpans: [],
      participantCueCount: 0,
      interviewerCueCount: 0,
    },
  },
  affect: {},
  affectVocabulary: {
    version: "v1.0.0",
    generatedAt: "",
    emotions: [
      { id: "grief", name: "Grief", definition: "" },
      { id: "fear", name: "Fear", definition: "" },
      { id: "anger", name: "Anger", definition: "" },
      { id: "weariness", name: "Weariness", definition: "" },
      { id: "hope", name: "Hope", definition: "" },
      { id: "relief", name: "Relief", definition: "" },
      { id: "numbness", name: "Numbness", definition: "" },
      { id: "resignation", name: "Resignation", definition: "" },
      { id: "defiance", name: "Defiance", definition: "" },
      { id: "gratitude", name: "Gratitude", definition: "" },
      { id: "pride", name: "Pride", definition: "" },
      { id: "neutral", name: "Neutral / procedural", definition: "" },
    ],
  },
  researcherNotes: {
    version: "test",
    generatedAt: "",
    summaries: {},
    fullNotes: {},
  },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QualitativeDataProvider bundle={FIXTURE}>{children}</QualitativeDataProvider>
);

describe("QualitativeDataContext", () => {
  it("flattens all quotes across participants", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    expect(result.current.allQuotes).toHaveLength(3);
  });

  it("assigns stable quoteIds", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    const ids = result.current.allQuotes.map((q) => q.quoteId);
    expect(ids).toContain("INT001:cue5:0");
    expect(ids).toContain("INT001:cue7:0");
    expect(ids).toContain("INT002:cue3:0");
    expect(new Set(ids).size).toBe(3);
  });

  it("quotesByCode returns all quotes coded with that id", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    expect(result.current.quotesByCode("x_code")).toHaveLength(2);
    expect(result.current.quotesByCode("y_code")).toHaveLength(2);
  });

  it("filter by ageBand reduces visible quotes", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    act(() => result.current.setFilter({ ...result.current.filter, ageBand: ["under40"] }));
    expect(result.current.filteredQuotes).toHaveLength(2);
    expect(result.current.quotesByCode("x_code")).toHaveLength(1);
  });

  it("filter by isCaregiver shows only matching participants", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    act(() => result.current.setFilter({ ...result.current.filter, isCaregiver: ["yes"] }));
    expect(result.current.filteredParticipantIds).toEqual(["INT002"]);
  });

  it("resetFilter clears all filters", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    act(() => result.current.setFilter({ ...result.current.filter, ageBand: ["under40"] }));
    act(() => result.current.resetFilter());
    expect(result.current.filteredQuotes).toHaveLength(3);
  });
});
