import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { QualitativeDataProvider, useQualitativeData } from "../QualitativeDataContext";
import { makeQuoteId } from "@/types/qualitative";
import type {
  QualitativeBundle,
  ParticipantId,
  ValidatedExtraction,
  CategoryKey,
  QuoteAffect,
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

const affectAnn = (
  participantId: ParticipantId,
  cueNumber: number,
  idx: number,
  primaryEmotion: QuoteAffect["primaryEmotion"],
): QuoteAffect => ({
  quoteId: makeQuoteId(participantId, cueNumber, idx),
  participantId,
  primaryEmotion,
  secondaryEmotion: null,
  intensity: 0.72,
  stance: 0.1,
  confidence: 0.91,
});

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
  affect: {
    INT001: {
      participantId: "INT001",
      affectSkillVersion: "v0-test",
      affectVocabularyVersion: "v1.0.0",
      generatedAt: new Date().toISOString(),
      annotations: [
        affectAnn("INT001", 5, 0, "anger"),
        affectAnn("INT001", 7, 0, "hope"),
      ],
    },
    INT002: {
      participantId: "INT002",
      affectSkillVersion: "v0-test",
      affectVocabularyVersion: "v1.0.0",
      generatedAt: new Date().toISOString(),
      annotations: [affectAnn("INT002", 3, 0, "grief")],
    },
  },
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
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QualitativeDataProvider bundle={FIXTURE}>{children}</QualitativeDataProvider>
);

describe("fingerprintsByParticipant", () => {
  it("returns one fingerprint per participant", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    const ids = Object.keys(result.current.fingerprintsByParticipant);
    expect(ids.sort()).toEqual(FIXTURE.manifest.entries.map((e) => e.id).sort());
  });

  it("each fingerprint's n equals that participant's quote count", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    for (const entry of FIXTURE.manifest.entries) {
      const fp = result.current.fingerprintsByParticipant[entry.id];
      const expected = result.current.quotesByParticipant(entry.id).length;
      expect(fp.n).toBe(expected);
    }
  });

  it("emotionCounts sum to n (each annotation counted once via primaryEmotion)", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    for (const entry of FIXTURE.manifest.entries) {
      const fp = result.current.fingerprintsByParticipant[entry.id];
      const sum = Object.values(fp.emotionCounts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(fp.n);
    }
  });

  it("emotion-filtered quote lookup matches affectByQuote primary", () => {
    const { result } = renderHook(() => useQualitativeData(), { wrapper });
    const matches = result.current.allQuotes.filter((q) => {
      const a = result.current.affectByQuote(q.quoteId);
      return a?.primaryEmotion === "anger";
    });
    for (const q of matches) {
      expect(result.current.affectByQuote(q.quoteId)?.primaryEmotion).toBe("anger");
    }
    expect(matches.length).toBeGreaterThan(0);
  });
});
