import { describe, it, expect } from "vitest";
import { parseResearcherNotesMd } from "../parse-researcher-notes";

const FIXTURE = `# Researcher Notes Summaries

**Version:** v1.0.0
**Generated:** 2026-05-12

---

## INT001

**Summary**

Retiree with smooth insurance. Defining insight: process is the bottleneck.

**Life and routine changes:** Routines collapsed; insurance dominated first weeks.

**Emotional impact:** Grief stayed specific.

**ChatGPT insights:** Procedural scaffolding reduces distress.

---

## INT002

**Summary**

Activist mode.

**Life and routine changes:** Recovery became infrastructure-building.
`;

describe("parseResearcherNotesMd", () => {
  it("extracts version and generatedAt", () => {
    const r = parseResearcherNotesMd(FIXTURE);
    expect(r.version).toBe("v1.0.0");
    expect(r.generatedAt).toContain("2026-05-12");
  });

  it("parses both participants", () => {
    const r = parseResearcherNotesMd(FIXTURE);
    expect(Object.keys(r.summaries).sort()).toEqual(["INT001", "INT002"]);
  });

  it("captures cross-category summary", () => {
    const r = parseResearcherNotesMd(FIXTURE);
    expect(r.summaries.INT001?.summary).toContain("Retiree with smooth insurance");
    expect(r.summaries.INT002?.summary).toBe("Activist mode.");
  });

  it("captures per-category one-liners by key", () => {
    const r = parseResearcherNotesMd(FIXTURE);
    expect(r.summaries.INT001?.perCategory.lifeAndRoutineChanges).toContain("Routines collapsed");
    expect(r.summaries.INT001?.perCategory.emotionalImpact).toContain("Grief stayed specific");
    expect(r.summaries.INT001?.perCategory.chatGptInsights).toContain("scaffolding");
    expect(r.summaries.INT002?.perCategory.lifeAndRoutineChanges).toContain("infrastructure-building");
  });

  it("returns empty perCategory for categories not present", () => {
    const r = parseResearcherNotesMd(FIXTURE);
    expect(r.summaries.INT002?.perCategory.emotionalImpact).toBeUndefined();
  });
});
