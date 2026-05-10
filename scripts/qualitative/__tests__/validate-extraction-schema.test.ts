import { describe, it, expect } from "vitest";
import * as path from "node:path";
import type { RawCodedQuote } from "../../../src/types/qualitative";
import { validateExtractionSchema, loadCodebook } from "../validate-extraction-schema";

const codebook = loadCodebook(path.resolve("data/qualitative/CODEBOOK.json"));

const emptyQuotes = (): RawCodedQuote[] => [];

const validBase = () => ({
  participantId: "INT001",
  transcriptSha256: "a".repeat(64),
  skillVersion: "v1.0.0",
  codebookVersion: codebook.version,
  generatedAt: new Date().toISOString(),
  summary: "A short summary.",
  codedQuotes: {
    lifeAndRoutineChanges: emptyQuotes(),
    emotionalImpact: emptyQuotes(),
    recoveryChallengesAndPainPoints: emptyQuotes(),
    needsOverTime: emptyQuotes(),
    technologyForRecovery: emptyQuotes(),
    aiAttitudesAndBeliefs: emptyQuotes(),
    mvpFeedback: emptyQuotes(),
    crossCutting: emptyQuotes(),
  },
  mvpAdversarialAudit: {
    endorsementsAttempted: true,
    hesitationsAttempted: true,
    notes: "Looked for both.",
  },
});

describe("validateExtractionSchema", () => {
  it("accepts a minimal valid extraction", () => {
    expect(validateExtractionSchema(validBase(), codebook)).toEqual([]);
  });

  it("rejects a malformed participantId", () => {
    const bad = { ...validBase(), participantId: "P001" };
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.path === "$.participantId")).toBe(true);
  });

  it("rejects unknown code ids", () => {
    const bad = validBase();
    bad.codedQuotes.lifeAndRoutineChanges.push({
      quoteVerbatim: "I had no idea what any of this meant.",
      codeIds: ["routine_collapse", "this_is_not_a_real_code"],
    });
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.message.includes('"this_is_not_a_real_code"'))).toBe(true);
  });

  it("rejects empty codeIds arrays", () => {
    const bad = validBase();
    bad.codedQuotes.lifeAndRoutineChanges.push({
      quoteVerbatim: "I had no idea what any of this meant.",
      codeIds: [],
    });
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.message.includes("non-empty array"))).toBe(true);
  });

  it("rejects empty quoteVerbatim", () => {
    const bad = validBase();
    bad.codedQuotes.emotionalImpact.push({
      quoteVerbatim: "",
      codeIds: ["grief_specific_loss"],
    });
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.message.includes("Missing or empty quoteVerbatim"))).toBe(true);
  });

  it("rejects missing mvpAdversarialAudit", () => {
    const bad = validBase() as Record<string, unknown>;
    delete bad.mvpAdversarialAudit;
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.path === "$.mvpAdversarialAudit")).toBe(true);
  });

  it("requires all 9 categories present in codedQuotes", () => {
    const bad = validBase();
    delete (bad.codedQuotes as Record<string, unknown>).crossCutting;
    const errs = validateExtractionSchema(bad, codebook);
    expect(errs.some((e) => e.path === "$.codedQuotes.crossCutting")).toBe(true);
  });

  it("accepts an extraction with uncodedObservations", () => {
    const ext = validBase() as Record<string, unknown>;
    ext.uncodedObservations = [
      {
        category: "emotionalImpact",
        quoteVerbatim: "It felt apocalyptic.",
        note: "No existing code captures this register.",
      },
    ];
    expect(validateExtractionSchema(ext, codebook)).toEqual([]);
  });

  it("rejects uncodedObservations with bad category", () => {
    const ext = validBase() as Record<string, unknown>;
    ext.uncodedObservations = [{ category: "notACategory", quoteVerbatim: "foo bar baz", note: "x" }];
    const errs = validateExtractionSchema(ext, codebook);
    expect(errs.some((e) => e.message.includes("CategoryKey"))).toBe(true);
  });
});
