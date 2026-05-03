import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import refs from "./fixtures/inferential-references.json";
import { fixtureMatrix, INS_SAT_NUM } from "./fixtures/inferential-fixture";
import { adjustForFDR, runAllTests, type TestFamily, type TestResult } from "../inferential";

/** Fixture CSV uses no quoting; split is sufficient. */
function parseCsvColumn(fixtureCsvFileName: string, columnName: string): (number | null)[] {
  const dir = dirname(fileURLToPath(import.meta.url));
  const text = readFileSync(join(dir, "fixtures", fixtureCsvFileName), "utf8").trimEnd();
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0]!.split(",");
  const nCol = headers.length;
  const j = headers.indexOf(columnName);
  if (j < 0) throw new Error(`Column "${columnName}" not found in ${fixtureCsvFileName}`);
  const out: (number | null)[] = [];
  for (let ri = 1; ri < lines.length; ri++) {
    let parts = lines[ri]!.split(",");
    if (parts.length < nCol) parts = [...parts, ...Array(nCol - parts.length).fill("")];
    else if (parts.length > nCol) parts = parts.slice(0, nCol);
    const raw = (parts[j] ?? "").trim();
    if (raw === "") {
      out.push(null);
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Row ${ri + 1}: non-numeric "${raw}" in ${columnName}`);
    out.push(n);
  }
  return out;
}

const matrix = fixtureMatrix();
const results = adjustForFDR(runAllTests(matrix));

function find(id: string): TestResult | undefined {
  return results.find((r) => r.id === id);
}

const D6 = 6;
const D4 = 4;
const D3 = 3;
const FDR = 3;

it("INS_SAT_NUM matches insurance_satisfaction_num column in inferential-fixture.csv", () => {
  const csvValues = parseCsvColumn("inferential-fixture.csv", "insurance_satisfaction_num");
  expect(INS_SAT_NUM).toEqual(csvValues);
});

describe("Family A: correlations", () => {
  it("A1 Pearson matches reference", () => {
    const r = find("A1_pearson")!;
    const p = refs.family_A.A1_age_ai_comfort.pearson;
    expect(r.skipped).toBeUndefined();
    expect(r.statistic).toBeCloseTo(p.statistic, D6);
    expect(r.effectSize?.value).toBeCloseTo(p.estimate, D6);
    expect(r.df).toBeCloseTo(p.df, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A1 Spearman matches reference", () => {
    const r = find("A1_spearman")!;
    const p = refs.family_A.A1_age_ai_comfort.spearman;
    expect(r.skipped).toBeUndefined();
    expect(r.effectSize?.value).toBeCloseTo(p.rho, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
    expect(r.df).toBeUndefined();
  });

  it("A2 Pearson matches reference", () => {
    const r = find("A2_pearson")!;
    const p = refs.family_A.A2_age_ai_interest.pearson;
    expect(r.statistic).toBeCloseTo(p.statistic, D6);
    expect(r.effectSize?.value).toBeCloseTo(p.estimate, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A2 Spearman matches reference", () => {
    const r = find("A2_spearman")!;
    const p = refs.family_A.A2_age_ai_interest.spearman;
    expect(r.effectSize?.value).toBeCloseTo(p.rho, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
    expect(r.df).toBeUndefined();
  });

  it("A3 Pearson matches reference", () => {
    const r = find("A3_pearson")!;
    const p = refs.family_A.A3_age_human_helper.pearson;
    expect(r.statistic).toBeCloseTo(p.statistic, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A3 Spearman matches reference", () => {
    const r = find("A3_spearman")!;
    const p = refs.family_A.A3_age_human_helper.spearman;
    expect(r.effectSize?.value).toBeCloseTo(p.rho, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A4 Pearson matches reference (claim-filer subset)", () => {
    const r = find("A4_pearson")!;
    const p = refs.family_A.A4_age_ins_sat.pearson;
    expect(r.skipped).toBeUndefined();
    expect(r.statistic).toBeCloseTo(p.statistic, D6);
    expect(r.effectSize?.value).toBeCloseTo(p.estimate, D6);
    expect(r.df).toBeCloseTo(p.df, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A4 Spearman matches reference", () => {
    const r = find("A4_spearman")!;
    const p = refs.family_A.A4_age_ins_sat.spearman;
    expect(r.effectSize?.value).toBeCloseTo(p.rho, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
    expect(r.df).toBeUndefined();
  });

  it("A5 Pearson matches reference", () => {
    const r = find("A5_pearson")!;
    const p = refs.family_A.A5_wb_ins_sat.pearson;
    expect(r.skipped).toBeUndefined();
    expect(r.statistic).toBeCloseTo(p.statistic, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
  });

  it("A5 Spearman matches reference", () => {
    const r = find("A5_spearman")!;
    const p = refs.family_A.A5_wb_ins_sat.spearman;
    expect(r.effectSize?.value).toBeCloseTo(p.rho, D6);
    expect(r.p).toBeCloseTo(p.p, D6);
    expect(r.df).toBeUndefined();
  });
});

describe("Family B: group differences (implemented vs reference)", () => {
  function assertWelchMw(
    ids: [string, string],
    ref: { welch: Record<string, number>; mwu: { statistic: number; p: number } }
  ) {
    const rw = find(ids[0])!;
    const rm = find(ids[1])!;
    expect(rw.skipped).toBeUndefined();
    expect(rw.statistic).toBeCloseTo(ref.welch.statistic, D6);
    expect(rw.df).toBeCloseTo(ref.welch.df, D6);
    expect(rw.p).toBeCloseTo(ref.welch.p, D6);
    expect(rw.effectSize?.value).toBeCloseTo(ref.welch.cohens_d, D6);
    expect(rw.effectSize?.ci95?.[0]).toBeCloseTo(ref.welch.cohens_d_ci_low, D3);
    expect(rw.effectSize?.ci95?.[1]).toBeCloseTo(ref.welch.cohens_d_ci_high, D3);

    expect(rm.skipped).toBeUndefined();
    // Wilcox statistic W: R sums ranks for different reference group/order than dashboard (same tie-correct asymptotic p).
    expect(rm.p).toBeCloseTo(ref.mwu.p, D4);
  }

  it("B1a comfort × gender", () =>
    assertWelchMw(["B1a_welch", "B1a_mwu"], refs.family_B.B1a_aic_by_gender));
  it("B1b interest × gender", () =>
    assertWelchMw(["B1b_welch", "B1b_mwu"], refs.family_B.B1b_aii_by_gender));
  it("B2a comfort × fire", () =>
    assertWelchMw(["B2a_welch", "B2a_mwu"], refs.family_B.B2a_aic_by_fire));
  it("B2b interest × fire", () =>
    assertWelchMw(["B2b_welch", "B2b_mwu"], refs.family_B.B2b_aii_by_fire));
  it("B3a comfort × totalLoss", () =>
    assertWelchMw(["B3a_welch", "B3a_mwu"], refs.family_B.B3a_aic_by_TL));
  it("B3b interest × totalLoss", () =>
    assertWelchMw(["B3b_welch", "B3b_mwu"], refs.family_B.B3b_aii_by_TL));
  it("B3c comfort × anyDamage", () =>
    assertWelchMw(["B3c_welch", "B3c_mwu"], refs.family_B.B3c_aic_by_aD));
  it("B3d interest × anyDamage", () =>
    assertWelchMw(["B3d_welch", "B3d_mwu"], refs.family_B.B3d_aii_by_aD));

  it("B3e Welch ANOVA comfort × exposureTier", () => {
    const r = find("B3e_anova")!;
    const a = refs.family_B.B3e_aic_by_eT.anova;
    expect(r.statistic).toBeCloseTo(a.statistic, D6);
    expect(r.df).toBeCloseTo(a.num_df, D6);
    expect(r.denomDf).toBeCloseTo(a.denom_df, D6);
    expect(r.p).toBeCloseTo(a.p, D6);
  });

  it("B3f Kruskal–Wallis comfort × exposureTier (refs: B3e_aic KW)", () => {
    const r = find("B3f_kw")!;
    const k = refs.family_B.B3e_aic_by_eT.kw;
    expect(r.statistic).toBeCloseTo(k.statistic, D4);
    expect(r.df).toBeCloseTo(k.df, D4);
    expect(r.p).toBeCloseTo(k.p, D4);
  });

  it("B3g Welch ANOVA interest × exposureTier (refs: B3f_aii omnibus)", () => {
    const r = find("B3g_anova")!;
    const a = refs.family_B.B3f_aii_by_eT.anova;
    expect(r.statistic).toBeCloseTo(a.statistic, D6);
    expect(r.df).toBeCloseTo(a.num_df, D6);
    expect(r.denomDf).toBeCloseTo(a.denom_df, D6);
    expect(r.p).toBeCloseTo(a.p, D6);
  });

  it("B3g Kruskal–Wallis interest × exposureTier", () => {
    const r = find("B3g_kw")!;
    const k = refs.family_B.B3f_aii_by_eT.kw;
    expect(r.statistic).toBeCloseTo(k.statistic, D4);
    expect(r.df).toBeCloseTo(k.df, D4);
    expect(r.p).toBeCloseTo(k.p, D4);
  });

  it("B4a comfort × has_children", () =>
    assertWelchMw(["B4a_welch", "B4a_mwu"], refs.family_B.B4a_aic_by_hC));
  it("B4b interest × has_children", () =>
    assertWelchMw(["B4b_welch", "B4b_mwu"], refs.family_B.B4b_aii_by_hC));
  it("B6a comfort × prior_ai_use", () =>
    assertWelchMw(["B6a_welch", "B6a_mwu"], refs.family_B.B6a_aic_by_pAI));
  it("B6b interest × prior_ai_use", () =>
    assertWelchMw(["B6b_welch", "B6b_mwu"], refs.family_B.B6b_aii_by_pAI));
  it("B5a comfort × is_caregiver", () =>
    assertWelchMw(["B5a_welch", "B5a_mwu"], refs.family_B.B5a_aic_by_iCg));
  it("B5b interest × is_caregiver", () =>
    assertWelchMw(["B5b_welch", "B5b_mwu"], refs.family_B.B5b_aii_by_iCg));

  it("B7 wellbeing × ai_emo_support", () =>
    assertWelchMw(["B7_welch", "B7_mwu"], refs.family_B.B7_wb_by_aES));

  it("B8 age × any_mh_util", () =>
    assertWelchMw(["B8_welch", "B8_mwu"], refs.family_B.B8_age_by_aMH));

  it("B9a claim-filer insurance × totalLoss", () =>
    assertWelchMw(["B9a_welch", "B9a_mwu"], refs.family_B.B9a_ins_by_TL));
  it("B9b claim-filer insurance × anyDamage", () =>
    assertWelchMw(["B9b_welch", "B9b_mwu"], refs.family_B.B9b_ins_by_aD));
  it("B9c claim-filer insurance × fire location", () =>
    assertWelchMw(["B9c_welch", "B9c_mwu"], refs.family_B.B9c_ins_by_fire));

  it("B9d Welch ANOVA claim-filer insurance × exposureTier", () => {
    const r = find("B9d_anova")!;
    const a = refs.family_B.B9_ins_by_eT.anova;
    expect(r.statistic).toBeCloseTo(a.statistic, D6);
    expect(r.df).toBeCloseTo(a.num_df, D6);
    expect(r.denomDf).toBeCloseTo(a.denom_df, D6);
    expect(r.p).toBeCloseTo(a.p, D6);
  });

  it("B9e Kruskal–Wallis claim-filer insurance × exposureTier", () => {
    const r = find("B9e_kw")!;
    const k = refs.family_B.B9_ins_by_eT.kw;
    expect(r.statistic).toBeCloseTo(k.statistic, D4);
    expect(r.df).toBeCloseTo(k.df, D4);
    expect(r.p).toBeCloseTo(k.p, D4);
  });
});

describe("Family C: χ² and Fisher", () => {
  it("C1 χ²", () => {
    const r = find("C1_chi")!;
    const c = refs.family_C.C1_aMH_x_aES.chisq;
    expect(r.statistic).toBeCloseTo(c.statistic, D4);
    expect(r.df).toBeCloseTo(c.df, D4);
    expect(r.p).toBeCloseTo(c.p, D4);
    expect(r.effectSize?.value).toBeCloseTo(c.cramers_v, D4);
  });

  it("C1 Fisher", () => {
    const r = find("C1_fisher")!;
    const f = refs.family_C.C1_aMH_x_aES.fisher;
    expect(r.p).toBeCloseTo(f.p, D4);
    // Dashboard OR/CI uses Haldane when needed plus log-envelope Fisher p; differs from stats::fisher.test estimate.
    expect(Number.isFinite(r.effectSize!.value)).toBe(true);
  });

  it("C2 χ²", () => {
    const r = find("C2_chi")!;
    const c = refs.family_C.C2_aB_x_aES.chisq;
    expect(r.statistic).toBeCloseTo(c.statistic, D4);
    expect(r.p).toBeCloseTo(c.p, D4);
  });

  it("C2 Fisher", () => {
    const r = find("C2_fisher")!;
    const f = refs.family_C.C2_aB_x_aES.fisher;
    expect(r.p).toBeCloseTo(f.p, D4);
    expect(Number.isFinite(r.effectSize!.value)).toBe(true);
  });

  it("C3a χ²", () => {
    const r = find("C3a_chi")!;
    const c = refs.family_C.C3a_aMH_x_TL.chisq;
    expect(r.statistic).toBeCloseTo(c.statistic, D4);
    expect(r.p).toBeCloseTo(c.p, D4);
  });

  it("C3a Fisher", () => {
    const r = find("C3a_fisher")!;
    const f = refs.family_C.C3a_aMH_x_TL.fisher;
    expect(r.skipped).toBeUndefined();
    expect(r.p).toBeCloseTo(f.p, D4);
  });

  it("C3b χ²", () => {
    const r = find("C3b_chi")!;
    const c = refs.family_C.C3b_aMH_x_aD.chisq;
    expect(r.statistic).toBeCloseTo(c.statistic, D4);
    expect(r.p).toBeCloseTo(c.p, D4);
  });

  it("C3b Fisher", () => {
    const r = find("C3b_fisher")!;
    const f = refs.family_C.C3b_aMH_x_aD.fisher;
    expect(r.skipped).toBeUndefined();
    expect(r.p).toBeCloseTo(f.p, D4);
  });

  it("C3c χ² (2×3)", () => {
    const r = find("C3c_chi")!;
    const c = refs.family_C.C3c_aMH_x_eT.chisq;
    expect(r.statistic).toBeCloseTo(c.statistic, D4);
    expect(r.p).toBeCloseTo(c.p, D4);
  });

  it("C3c Fisher omitted (skipped in dashboard)", () => {
    expect(find("C3c_fisher")?.skipped).toBeDefined();
  });
});

describe("FDR adjustment", () => {
  it("BH q-values are non-decreasing in raw p within each family", () => {
    for (const family of ["FAMILY_A_CORR", "FAMILY_B_GROUP_DIFF", "FAMILY_C_CHISQ"] as TestFamily[]) {
      const inFamily = results
        .filter((r) => r.family === family && !r.skipped && r.p !== undefined)
        .sort((a, b) => (a.p ?? 0) - (b.p ?? 0));
      for (let i = 1; i < inFamily.length; i++) {
        expect(inFamily[i].qFDR!).toBeGreaterThanOrEqual((inFamily[i - 1].qFDR ?? 0) - 10 ** -FDR);
      }
    }
  });

  it("skipped tests do not receive qFDR", () => {
    for (const r of results) {
      if (r.skipped) expect(r.qFDR).toBeUndefined();
    }
  });
});
