import * as fs from "node:fs";
import type { RawExtraction, CategoryKey, Codebook } from "../../src/types/qualitative";

const CATEGORY_KEYS: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];

export type SchemaError = {
  path: string;
  message: string;
};

export function loadCodebook(absPath: string): Codebook {
  const text = fs.readFileSync(absPath, "utf8");
  const cb = JSON.parse(text) as Codebook;
  return cb;
}

export function validateExtractionSchema(raw: unknown, codebook: Codebook): SchemaError[] {
  const errors: SchemaError[] = [];
  const codeIds = new Set(codebook.entries.map((e) => e.id));

  if (typeof raw !== "object" || raw === null) {
    return [{ path: "$", message: "Not an object" }];
  }
  const r = raw as Partial<RawExtraction>;

  if (typeof r.participantId !== "string" || !/^INT\d{3,}$/.test(r.participantId)) {
    errors.push({ path: "$.participantId", message: "Missing or malformed participantId" });
  }
  if (typeof r.transcriptSha256 !== "string" || r.transcriptSha256.length !== 64) {
    errors.push({ path: "$.transcriptSha256", message: "Missing or malformed sha256" });
  }
  if (typeof r.skillVersion !== "string") {
    errors.push({ path: "$.skillVersion", message: "Missing skillVersion" });
  }
  if (typeof r.codebookVersion !== "string") {
    errors.push({ path: "$.codebookVersion", message: "Missing codebookVersion" });
  }
  if (typeof r.summary !== "string") {
    errors.push({ path: "$.summary", message: "Missing summary" });
  }

  const cq = r.codedQuotes as Record<string, unknown> | undefined;
  if (!cq || typeof cq !== "object") {
    errors.push({ path: "$.codedQuotes", message: "Missing codedQuotes object" });
  } else {
    for (const k of CATEGORY_KEYS) {
      if (!Array.isArray(cq[k])) {
        errors.push({ path: `$.codedQuotes.${k}`, message: "Must be an array (use [] when empty)" });
        continue;
      }
      const arr = cq[k] as unknown[];
      arr.forEach((item, i) => {
        if (typeof item !== "object" || item === null) {
          errors.push({ path: `$.codedQuotes.${k}[${i}]`, message: "Must be an object" });
          return;
        }
        const q = item as Record<string, unknown>;
        if (typeof q.quoteVerbatim !== "string" || q.quoteVerbatim.trim() === "") {
          errors.push({
            path: `$.codedQuotes.${k}[${i}].quoteVerbatim`,
            message: "Missing or empty quoteVerbatim",
          });
        }
        if (!Array.isArray(q.codeIds) || q.codeIds.length === 0) {
          errors.push({
            path: `$.codedQuotes.${k}[${i}].codeIds`,
            message: "codeIds must be a non-empty array",
          });
        } else {
          (q.codeIds as unknown[]).forEach((id, j) => {
            if (typeof id !== "string") {
              errors.push({
                path: `$.codedQuotes.${k}[${i}].codeIds[${j}]`,
                message: "codeId must be a string",
              });
            } else if (!codeIds.has(id)) {
              errors.push({
                path: `$.codedQuotes.${k}[${i}].codeIds[${j}]`,
                message: `Unknown code id: "${id}"`,
              });
            }
          });
        }
        if (q.rationale !== undefined && typeof q.rationale !== "string") {
          errors.push({
            path: `$.codedQuotes.${k}[${i}].rationale`,
            message: "rationale must be a string if present",
          });
        }
      });
    }
  }

  const audit = (r as { mvpAdversarialAudit?: unknown }).mvpAdversarialAudit;
  if (!audit || typeof audit !== "object") {
    errors.push({ path: "$.mvpAdversarialAudit", message: "Missing mvpAdversarialAudit" });
  } else {
    const a = audit as Record<string, unknown>;
    if (typeof a.endorsementsAttempted !== "boolean") {
      errors.push({
        path: "$.mvpAdversarialAudit.endorsementsAttempted",
        message: "Must be boolean",
      });
    }
    if (typeof a.hesitationsAttempted !== "boolean") {
      errors.push({
        path: "$.mvpAdversarialAudit.hesitationsAttempted",
        message: "Must be boolean",
      });
    }
    if (typeof a.notes !== "string") {
      errors.push({ path: "$.mvpAdversarialAudit.notes", message: "Must be a string" });
    }
  }

  const uo = (r as { uncodedObservations?: unknown }).uncodedObservations;
  if (uo !== undefined) {
    if (!Array.isArray(uo)) {
      errors.push({ path: "$.uncodedObservations", message: "Must be an array if present" });
    } else {
      uo.forEach((item, i) => {
        if (typeof item !== "object" || item === null) {
          errors.push({ path: `$.uncodedObservations[${i}]`, message: "Must be an object" });
          return;
        }
        const o = item as Record<string, unknown>;
        if (typeof o.category !== "string" || !CATEGORY_KEYS.includes(o.category as CategoryKey)) {
          errors.push({
            path: `$.uncodedObservations[${i}].category`,
            message: "Must be a valid CategoryKey",
          });
        }
        if (typeof o.quoteVerbatim !== "string" || o.quoteVerbatim.trim() === "") {
          errors.push({
            path: `$.uncodedObservations[${i}].quoteVerbatim`,
            message: "Missing or empty quoteVerbatim",
          });
        }
        if (typeof o.note !== "string") {
          errors.push({ path: `$.uncodedObservations[${i}].note`, message: "Missing note" });
        }
      });
    }
  }

  return errors;
}
