import * as fs from "node:fs";
import type { AffectFile, AffectVocabulary, QuoteAffect } from "../../src/types/qualitative";

export type AffectSchemaError = { path: string; message: string };

export function loadAffectVocabulary(absPath: string): AffectVocabulary {
  return JSON.parse(fs.readFileSync(absPath, "utf8")) as AffectVocabulary;
}

export function validateAffectFile(raw: unknown, vocab: AffectVocabulary): AffectSchemaError[] {
  const errors: AffectSchemaError[] = [];
  if (typeof raw !== "object" || raw === null) {
    return [{ path: "$", message: "Not an object" }];
  }
  const f = raw as Partial<AffectFile>;
  if (typeof f.participantId !== "string" || !/^INT\d{3,}$/.test(f.participantId)) {
    errors.push({ path: "$.participantId", message: "Missing/malformed participantId" });
  }
  if (typeof f.affectSkillVersion !== "string") {
    errors.push({ path: "$.affectSkillVersion", message: "Missing version" });
  }
  if (typeof f.affectVocabularyVersion !== "string") {
    errors.push({ path: "$.affectVocabularyVersion", message: "Missing version" });
  }
  if (!Array.isArray(f.annotations)) {
    errors.push({ path: "$.annotations", message: "Must be an array" });
    return errors;
  }
  const validEmotions = new Set(vocab.emotions.map((e) => e.id));
  f.annotations.forEach((a, i) => {
    const ann = a as Partial<QuoteAffect>;
    const at = (k: string) => `$.annotations[${i}].${k}`;
    if (typeof ann.quoteId !== "string" || !/^INT\d{3,}:cue\d+:\d+$/.test(ann.quoteId)) {
      errors.push({ path: at("quoteId"), message: "Missing/malformed quoteId" });
    }
    if (typeof ann.participantId !== "string") {
      errors.push({ path: at("participantId"), message: "Missing participantId" });
    }
    if (typeof ann.primaryEmotion !== "string" || !validEmotions.has(ann.primaryEmotion as QuoteAffect["primaryEmotion"])) {
      errors.push({ path: at("primaryEmotion"), message: `Invalid emotion: ${ann.primaryEmotion}` });
    }
    if (ann.secondaryEmotion !== null && ann.secondaryEmotion !== undefined) {
      if (!validEmotions.has(ann.secondaryEmotion as QuoteAffect["primaryEmotion"])) {
        errors.push({ path: at("secondaryEmotion"), message: `Invalid emotion: ${ann.secondaryEmotion}` });
      } else if (ann.secondaryEmotion === ann.primaryEmotion) {
        errors.push({ path: at("secondaryEmotion"), message: "Must differ from primary" });
      }
    }
    const inRange = (n: unknown, lo: number, hi: number) => typeof n === "number" && n >= lo && n <= hi;
    if (!inRange(ann.intensity, 0, 1)) {
      errors.push({ path: at("intensity"), message: "Must be 0..1" });
    }
    if (!inRange(ann.stance, -1, 1)) {
      errors.push({ path: at("stance"), message: "Must be -1..1" });
    }
    if (!inRange(ann.confidence, 0, 1)) {
      errors.push({ path: at("confidence"), message: "Must be 0..1" });
    }
  });
  return errors;
}
