import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Codebook, CategoryKey } from "../../../src/types/qualitative";

const CODEBOOK_PATH = path.resolve("data/qualitative/CODEBOOK.json");

const VALID_CATEGORIES: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];

describe("CODEBOOK.json", () => {
  const cb = JSON.parse(fs.readFileSync(CODEBOOK_PATH, "utf8")) as Codebook;

  it("has a semver-shaped version", () => {
    expect(cb.version).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("has a non-empty list of entries", () => {
    expect(cb.entries.length).toBeGreaterThan(20);
  });

  it("has unique code ids", () => {
    const ids = cb.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses snake_case ids only", () => {
    for (const e of cb.entries) {
      expect(e.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("places every code in a valid category", () => {
    for (const e of cb.entries) {
      expect(VALID_CATEGORIES).toContain(e.category);
    }
  });

  it("covers every category with at least one code", () => {
    for (const c of VALID_CATEGORIES) {
      const inCat = cb.entries.filter((e) => e.category === c);
      expect(inCat.length, `category "${c}" has no codes`).toBeGreaterThan(0);
    }
  });

  it("populates polarity on every mvpFeedback code", () => {
    for (const e of cb.entries) {
      if (e.category === "mvpFeedback") {
        expect(e.polarity, `mvp code "${e.id}" missing polarity`).toBeDefined();
        expect(["endorsement", "hesitation", "feature_request"]).toContain(e.polarity);
      }
    }
  });

  it("has at least one endorsement and one hesitation code under mvpFeedback", () => {
    const mvp = cb.entries.filter((e) => e.category === "mvpFeedback");
    expect(mvp.some((e) => e.polarity === "endorsement")).toBe(true);
    expect(mvp.some((e) => e.polarity === "hesitation")).toBe(true);
  });

  it("does NOT populate polarity on non-mvpFeedback codes", () => {
    for (const e of cb.entries) {
      if (e.category !== "mvpFeedback") {
        expect(e.polarity, `non-mvp code "${e.id}" should not have polarity`).toBeUndefined();
      }
    }
  });
});
