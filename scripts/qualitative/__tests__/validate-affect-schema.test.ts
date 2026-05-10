import { describe, it, expect } from "vitest";
import { validateAffectFile, loadAffectVocabulary } from "../validate-affect-schema";
import * as path from "node:path";

const vocab = loadAffectVocabulary(path.resolve("data/qualitative/AFFECT_VOCABULARY.json"));

const baseAnn = {
  quoteId: "INT001:cue5:0",
  participantId: "INT001",
  primaryEmotion: "grief" as string,
  secondaryEmotion: null as string | null,
  intensity: 0.7,
  stance: -0.3,
  confidence: 0.85,
};

const validAnnotation = () => ({ ...baseAnn });

const validBase = () => ({
  participantId: "INT001",
  affectSkillVersion: "v1.0.0",
  affectVocabularyVersion: vocab.version,
  generatedAt: new Date().toISOString(),
  annotations: [validAnnotation()],
});

describe("validateAffectFile", () => {
  it("accepts a minimal valid file", () => {
    expect(validateAffectFile(validBase(), vocab)).toEqual([]);
  });

  it("rejects an unknown emotion", () => {
    const bad = validBase();
    bad.annotations[0].primaryEmotion = "ennui";
    const errs = validateAffectFile(bad, vocab);
    expect(errs.some((e) => e.message.includes("Invalid emotion"))).toBe(true);
  });

  it("rejects intensity out of range", () => {
    const bad = validBase();
    bad.annotations[0].intensity = 1.5;
    const errs = validateAffectFile(bad, vocab);
    expect(errs.some((e) => e.path.endsWith("intensity"))).toBe(true);
  });

  it("rejects stance out of range", () => {
    const bad = validBase();
    bad.annotations[0].stance = -2;
    const errs = validateAffectFile(bad, vocab);
    expect(errs.some((e) => e.path.endsWith("stance"))).toBe(true);
  });

  it("rejects secondary == primary", () => {
    const bad = validBase();
    bad.annotations[0].secondaryEmotion = bad.annotations[0].primaryEmotion;
    const errs = validateAffectFile(bad, vocab);
    expect(errs.some((e) => e.message.includes("differ"))).toBe(true);
  });
});
