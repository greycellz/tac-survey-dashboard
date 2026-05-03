/**
 * Regenerate src/lib/__tests__/fixtures/inferential-references.json from the
 * canonical fixture. Uses jstat with the same formulas as src/lib/inferential.ts
 * (R-aligned defaults from Brief 3). Prefer R when available:
 *   Rscript scripts/generate-inferential-fixture-references.R
 *
 * Run: npx tsx scripts/generate-inferential-references.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { jStat } from "jstat";
import { fixtureMatrix } from "../src/lib/__tests__/fixtures/inferential-fixture";

type Row = Record<string, number>;

function sampleVariance(vals: number[]): number {
  if (vals.length < 2) return NaN;
  return jStat.variance(vals, true) as number;
}

function pearsonPFromR(r: number, nPairs: number): number {
  if (nPairs < 3 || Number.isNaN(r)) return NaN;
  const clamped = Math.min(0.999999, Math.max(-0.999999, r));
  const t = (clamped * Math.sqrt(nPairs - 2)) / Math.sqrt(1 - clamped * clamped);
  return 2 * (jStat.studentt.cdf(-Math.abs(t), nPairs - 2) as number);
}

function spearmanApproxP(rhoRank: number, nPairs: number): number {
  return pearsonPFromR(rhoRank, nPairs);
}

function pooledCohenD(x: number[], y: number[]): { d: number; lo: number; hi: number } | null {
  const n1 = x.length;
  const n2 = y.length;
  if (n1 < 2 || n2 < 2) return null;
  const v1 = sampleVariance(x);
  const v2 = sampleVariance(y);
  if (!(v1 >= 0) || !(v2 >= 0) || Number.isNaN(v1) || Number.isNaN(v2)) return null;
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  if (sp === 0 || Number.isNaN(sp)) return null;
  const d = ((jStat.mean(x) as number) - (jStat.mean(y) as number)) / sp;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2)));
  const z = 1.96;
  return { d, lo: d - z * se, hi: d + z * se };
}

function pooledAverageRanks(vals: number[]): number[] {
  const n = vals.length;
  const ranks = new Array<number>(n).fill(NaN);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    const v = vals[i]!;
    while (j < n && vals[j] === v) j++;
    const avg = ((i + 1) + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avg;
    i = j;
  }
  return ranks;
}

function wilcoxRankSumW(xVals: number[], yVals: number[]): { W: number; p: number } {
  const pairs = [
    ...xVals.map((v) => ({ v, g: 0 })),
    ...yVals.map((v) => ({ v, g: 1 })),
  ].sort((a, b) => a.v - b.v || a.g - b.g);
  const vals = pairs.map((p) => p.v);
  const ranks = pooledAverageRanks(vals);
  let W = 0;
  pairs.forEach((p, idx) => {
    if (p.g === 0) W += ranks[idx]!;
  });
  const n1 = xVals.length;
  const n2 = yVals.length;
  const N = n1 + n2;
  const mu = (n1 * (N + 1)) / 2;
  let tieAdj = 0;
  for (let k = 0; k < N; ) {
    let l = k + 1;
    while (l < N && vals[l] === vals[k]) l++;
    const len = l - k;
    tieAdj += len ** 3 - len;
    k = l;
  }
  let sigmaSq = (n1 * n2 / 12) * (N + 1);
  if (N > 1 && tieAdj !== 0) {
    sigmaSq -= (n1 * n2 * tieAdj) / (12 * N * (N - 1));
  }
  if (sigmaSq <= 0 || Number.isNaN(sigmaSq)) return { W, p: 1 };
  const sigma = Math.sqrt(sigmaSq);
  const zsc = (W - mu) / sigma;
  const cdf = jStat.normal.cdf(zsc, 0, 1) as number;
  const p = Math.min(1, Math.max(0, 2 * Math.min(cdf, 1 - cdf)));
  return { W, p };
}

function welchTwoSampleT(xVals: number[], yVals: number[]): { t: number; df: number; p: number } {
  const n1 = xVals.length;
  const n2 = yVals.length;
  if (n1 < 2 || n2 < 2) return { t: NaN, df: NaN, p: NaN };
  const v1 = sampleVariance(xVals);
  const v2 = sampleVariance(yVals);
  const m1 = jStat.mean(xVals) as number;
  const m2 = jStat.mean(yVals) as number;
  const se2 = v1 / n1 + v2 / n2;
  if (!(se2 > 0) || Number.isNaN(se2)) return { t: NaN, df: NaN, p: NaN };
  const t = (m1 - m2) / Math.sqrt(se2);
  const num = se2 ** 2;
  const den = (v1 * v1) / (n1 * n1 * (n1 - 1)) + (v2 * v2) / (n2 * n2 * (n2 - 1));
  const df = num / den;
  const p = 2 * (jStat.studentt.cdf(-Math.abs(t), df) as number);
  return { t, df, p: Math.min(1, Math.max(0, p)) };
}

function welchConfInt(x0: number[], x1: number[]): { lo: number; hi: number } {
  const m1 = jStat.mean(x0) as number;
  const m2 = jStat.mean(x1) as number;
  const v1 = sampleVariance(x0);
  const v2 = sampleVariance(x1);
  const n1 = x0.length;
  const n2 = x1.length;
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const { df } = welchTwoSampleT(x0, x1);
  if (!(se > 0) || !Number.isFinite(df)) return { lo: NaN, hi: NaN };
  const h = (jStat.studentt.inv(0.975, df) as number) * se;
  const diff = m1 - m2;
  return { lo: diff - h, hi: diff + h };
}

function welchOneWayANOVA(groupsIn: number[][]): { F: number; df1: number; df2: number; p: number } {
  const groups = groupsIn.filter((g) => g.length > 0);
  const k = groups.length;
  if (k < 2 || groups.some((g) => g.length < 2)) return { F: NaN, df1: NaN, df2: NaN, p: NaN };
  const nI = groups.map((g) => g.length);
  const mI = groups.map((g) => jStat.mean(g) as number);
  const vI = groups.map((g) => sampleVariance(g));
  const wI = nI.map((n, i) => n / vI[i]!);
  const sumWI = wI.reduce((a, b) => a + b, 0);
  const tmp = wI.reduce((acc, wi, i) => acc + (1 - wi / sumWI) ** 2 / (nI[i]! - 1), 0) / (k * k - 1);
  const m = wI.reduce((acc, wi, i) => acc + wi * mI[i]!, 0) / sumWI;
  const statistic =
    wI.reduce((acc, wi, i) => acc + wi * (mI[i]! - m) ** 2, 0) / ((k - 1) * (1 + 2 * (k - 2) * tmp));
  const df1 = k - 1;
  const df2 = 1 / (3 * tmp);
  const p = 1 - (jStat.centralF.cdf(statistic, df1, df2) as number);
  return { F: statistic, df1, df2, p: Math.min(1, Math.max(0, p)) };
}

function kruskalWallis(groupsAll: number[][]): { H: number; df: number; p: number } {
  const groups = groupsAll.filter((g) => g.length > 0);
  const k = groups.length;
  const pairs: { v: number; gi: number }[] = [];
  for (let gi = 0; gi < k; gi++) for (const v of groups[gi]!) pairs.push({ v, gi });
  pairs.sort((a, b) => a.v - b.v || a.gi - b.gi);
  const vals = pairs.map((p) => p.v);
  const ranks = pooledAverageRanks(vals);
  let tieAdj = 0;
  for (let b = 0; b < vals.length; ) {
    let e = b + 1;
    while (e < vals.length && vals[e] === vals[b]) e++;
    const len = e - b;
    tieAdj += len ** 3 - len;
    b = e;
  }
  const N = vals.length;
  const Rsums = Array<number>(k).fill(0);
  const counts = Array<number>(k).fill(0);
  pairs.forEach((p, idx) => {
    Rsums[p.gi] += ranks[idx]!;
    counts[p.gi] += 1;
  });
  let H = (12 / (N * (N + 1))) * Rsums.reduce((s, R, i) => s + R * R / counts[i]!, 0) - 3 * (N + 1);
  const tieCorrectionDen = N ** 3 - N;
  if (tieCorrectionDen !== 0 && tieAdj !== 0) {
    const tieFactor = 1 - tieAdj / tieCorrectionDen;
    if (tieFactor !== 0) H /= tieFactor;
  }
  const df = Math.max(0, k - 1);
  const p = df > 0 && Number.isFinite(H) ? Math.min(1, Math.max(0, 1 - (jStat.chisquare.cdf(H, df) as number))) : NaN;
  return { H, df, p };
}

function pearsonChiSquare(table: number[][]): { chi2: number; df: number; p: number } {
  const rDim = table.length;
  const cDim = table[0]?.length ?? 0;
  if (rDim <= 1 || cDim <= 1) return { chi2: NaN, df: NaN, p: NaN };
  const rowSum = table.map((row) => row.reduce((s, x) => s + x, 0));
  const colSum = Array<number>(cDim).fill(0);
  for (let i = 0; i < rDim; i++) for (let j = 0; j < cDim; j++) colSum[j] += table[i]![j]!;
  const nAll = rowSum.reduce((s, x) => s + x, 0);
  if (nAll === 0) return { chi2: NaN, df: NaN, p: NaN };
  let chi2 = 0;
  for (let i = 0; i < rDim; i++) {
    for (let j = 0; j < cDim; j++) {
      const o = table[i]![j]!;
      const e = (rowSum[i]! * colSum[j]!) / nAll;
      if (e <= 0) continue;
      const diff = o - e;
      chi2 += (diff * diff) / e;
    }
  }
  const df = (rDim - 1) * (cDim - 1);
  const pCore = df >= 1 && Number.isFinite(chi2) ? 1 - (jStat.chisquare.cdf(chi2, df) as number) : NaN;
  return { chi2, df, p: Number.isFinite(pCore) ? Math.min(1, Math.max(0, pCore)) : NaN };
}

function cramersV(chi: number, n: number, rDim: number, cDim: number): number {
  const denomDims = Math.min(rDim, cDim) - 1;
  if (!(n > 0) || denomDims <= 0 || !Number.isFinite(chi)) return NaN;
  return Math.sqrt(Math.max(0, chi) / (n * denomDims));
}

function logHypergeomPmfl(x: number, K: number, nDraw: number, Ntotal: number): number {
  return (
    (jStat.combinationln(K, x) as number) +
    (jStat.combinationln(Ntotal - K, nDraw - x) as number) -
    (jStat.combinationln(Ntotal, nDraw) as number)
  );
}

function fisherExactTwoSidedP(table: [[number, number], [number, number]]): number {
  const [[a, b], [cNum, d]] = table;
  const row1 = a + b;
  const row2 = cNum + d;
  const col1 = a + cNum;
  const K = col1;
  const nDraw = row1;
  const xMin = Math.max(0, K - row2);
  const xHigh = Math.min(row1, K);
  const xs: number[] = [];
  const lps: number[] = [];
  for (let x = xMin; x <= xHigh; x++) {
    xs.push(x);
    lps.push(logHypergeomPmfl(x, K, nDraw, row1 + row2));
  }
  let maxLp = Number.NEGATIVE_INFINITY;
  for (const lp of lps) maxLp = Math.max(maxLp, lp);
  let sumAll = 0;
  let sumTail = 0;
  let obsProbScaled = NaN;
  xs.forEach((x, idx) => {
    const scaled = Math.exp(lps[idx]! - maxLp);
    sumAll += scaled;
    if (x === a) obsProbScaled = scaled;
  });
  if (!(sumAll > 0) || !Number.isFinite(obsProbScaled)) return NaN;
  const obsLp = Math.log(obsProbScaled);
  xs.forEach((_, idx) => {
    const scaled = Math.exp(lps[idx]! - maxLp);
    const cmp = Math.log(scaled + 1e-300);
    if (cmp <= obsLp + 1e-12) sumTail += scaled;
  });
  return Math.min(1, sumTail / sumAll);
}

function oddsRatioWithHaldane(a: number, b: number, cNum: number, d: number): { or: number; lo: number; hi: number } {
  const usedHaldane = a * b * cNum * d === 0;
  const aa = usedHaldane ? a + 0.5 : a;
  const bb = usedHaldane ? b + 0.5 : b;
  const cc = usedHaldane ? cNum + 0.5 : cNum;
  const dd = usedHaldane ? d + 0.5 : d;
  const or = (aa * dd) / (bb * cc);
  const logOr = Math.log(or);
  const se = Math.sqrt(1 / aa + 1 / bb + 1 / cc + 1 / dd);
  const z = 1.96;
  return { or, lo: Math.exp(logOr - z * se), hi: Math.exp(logOr + z * se) };
}

function rowsWithPair(mx: Row[], a: string, b: string): { xa: number[]; xb: number[] } {
  const xa: number[] = [];
  const xb: number[] = [];
  for (const r of mx) {
    const va = r[a];
    const vb = r[b];
    if (typeof va === "number" && typeof vb === "number") {
      xa.push(va);
      xb.push(vb);
    }
  }
  return { xa, xb };
}

function splitBinary(mx: Row[], outcomeKey: string, groupKey: string): { g0: number[]; g1: number[] } {
  const g0: number[] = [];
  const g1: number[] = [];
  for (const r of mx) {
    const y = r[outcomeKey];
    const g = r[groupKey];
    if (typeof y !== "number" || typeof g !== "number") continue;
    if (g === 0) g0.push(y);
    else if (g === 1) g1.push(y);
  }
  return { g0, g1 };
}

function fisherBundle(tbl: [[number, number], [number, number]]): Record<string, number> {
  const [[a, b], [cNum, d]] = tbl;
  const p = fisherExactTwoSidedP(tbl);
  const orp = oddsRatioWithHaldane(a, b, cNum, d);
  return { p: p as number, or: orp.or, ci_low: orp.lo, ci_high: orp.hi };
}

function welchMwBundle(mx: Row[], outcome: string, group: string) {
  const { g0, g1 } = splitBinary(mx, outcome, group);
  const wt = welchTwoSampleT(g0, g1);
  const ci = welchConfInt(g0, g1);
  const cd = pooledCohenD(g0, g1);
  const ww = wilcoxRankSumW(g0, g1);
  return {
    welch: {
      statistic: wt.t,
      df: wt.df,
      p: wt.p,
      mean_group_0: jStat.mean(g0) as number,
      mean_group_1: jStat.mean(g1) as number,
      ci_low: ci.lo,
      ci_high: ci.hi,
      cohens_d: cd?.d ?? NaN,
      cohens_d_ci_low: cd?.lo ?? NaN,
      cohens_d_ci_high: cd?.hi ?? NaN,
    },
    mwu: { statistic: ww.W, p: ww.p },
  };
}

function corPair(mx: Row[], outcome: string, predictor: string) {
  const { xa: outc, xb: pred } = rowsWithPair(mx, outcome, predictor);
  const n = pred.length;
  const rP = jStat.corrcoeff(pred, outc) as number;
  const rx = jStat.rank(pred) as number[];
  const ry = jStat.rank(outc) as number[];
  const rS = jStat.corrcoeff(rx, ry) as number;
  const pPearson = pearsonPFromR(rP, n);
  const df = n - 2;
  return {
    pearson: {
      // Dashboard uses Pearson r as `statistic` (not Student t like R cor.test$t).
      statistic: rP,
      df,
      p: pPearson,
      estimate: rP,
    },
    spearman: { rho: rS, p: spearmanApproxP(rS, n) },
  };
}

function main() {
  const matrix = fixtureMatrix() as Row[];
  const genderMx = matrix.filter((r) => r.is_female === 1 || r.is_male === 1);
  const fireMx = matrix.filter(
    (r) =>
      typeof r.is_eaton === "number" &&
      typeof r.is_palisade === "number" &&
      ((r.is_eaton === 1 && r.is_palisade !== 1) || (r.is_palisade === 1 && r.is_eaton !== 1))
  );

  const family_A = {
    A1_age_ai_comfort: corPair(matrix, "ai_comfort_num", "age"),
    A2_age_ai_interest: corPair(matrix, "ai_interest_num", "age"),
    A3_age_human_helper: corPair(matrix, "human_helper_importance_num", "age"),
  };

  const family_B: Record<string, { welch: unknown; mwu: unknown } | { anova: unknown; kw: unknown }> = {
    B1a_aic_by_gender: welchMwBundle(genderMx, "ai_comfort_num", "is_female"),
    B1b_aii_by_gender: welchMwBundle(genderMx, "ai_interest_num", "is_female"),
    B2a_aic_by_fire: welchMwBundle(fireMx, "ai_comfort_num", "is_eaton"),
    B2b_aii_by_fire: welchMwBundle(fireMx, "ai_interest_num", "is_eaton"),
    B3a_aic_by_TL: welchMwBundle(matrix, "ai_comfort_num", "totalLoss"),
    B3b_aii_by_TL: welchMwBundle(matrix, "ai_interest_num", "totalLoss"),
    B3c_aic_by_aD: welchMwBundle(matrix, "ai_comfort_num", "anyDamage"),
    B3d_aii_by_aD: welchMwBundle(matrix, "ai_interest_num", "anyDamage"),
  };

  const etLevels = [0, 1, 2];
  function exposureGroups(outcome: string): number[][] {
    return etLevels.map((lv) =>
      matrix
        .filter((r) => r.exposureTier === lv && typeof r[outcome] === "number")
        .map((r) => r[outcome] as number)
    );
  }
  const egAic = exposureGroups("ai_comfort_num");
  const egAii = exposureGroups("ai_interest_num");
  const anovaA = welchOneWayANOVA(egAic);
  const kwA = kruskalWallis(egAic);
  const anovaIi = welchOneWayANOVA(egAii);
  const kwIi = kruskalWallis(egAii);
  family_B.B3e_aic_by_eT = {
    anova: {
      statistic: anovaA.F,
      num_df: anovaA.df1,
      denom_df: anovaA.df2,
      p: anovaA.p,
    },
    kw: { statistic: kwA.H, df: kwA.df, p: kwA.p },
  };
  family_B.B3f_aii_by_eT = {
    anova: { statistic: anovaIi.F, num_df: anovaIi.df1, denom_df: anovaIi.df2, p: anovaIi.p },
    kw: { statistic: kwIi.H, df: kwIi.df, p: kwIi.p },
  };

  family_B.B4a_aic_by_hC = welchMwBundle(matrix, "ai_comfort_num", "has_children");
  family_B.B4b_aii_by_hC = welchMwBundle(matrix, "ai_interest_num", "has_children");
  family_B.B5a_aic_by_iCg = welchMwBundle(matrix, "ai_comfort_num", "is_caregiver");
  family_B.B5b_aii_by_iCg = welchMwBundle(matrix, "ai_interest_num", "is_caregiver");
  family_B.B6a_aic_by_pAI = welchMwBundle(matrix, "ai_comfort_num", "prior_ai_use");
  family_B.B6b_aii_by_pAI = welchMwBundle(matrix, "ai_interest_num", "prior_ai_use");
  family_B.B7_wb_by_aES = welchMwBundle(matrix, "wellbeing_num", "ai_emo_support");
  family_B.B8_age_by_aMH = welchMwBundle(matrix, "age", "any_mh_util");

  function binBinTable(rowKey: string, colKey: string): [[number, number], [number, number]] {
    let a = 0,
      b = 0,
      c2 = 0,
      dd = 0;
    for (const r of matrix) {
      const rv = r[rowKey];
      const cv = r[colKey];
      if (typeof rv !== "number" || typeof cv !== "number") continue;
      if (rv === 0 && cv === 0) a++;
      else if (rv === 0 && cv === 1) b++;
      else if (rv === 1 && cv === 0) c2++;
      else if (rv === 1 && cv === 1) dd++;
    }
    return [
      [a, b],
      [c2, dd],
    ];
  }

  function mhEtTable(): number[][] {
    const t = [
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const r of matrix) {
      const y = r.any_mh_util;
      const x = r.exposureTier;
      if (typeof y !== "number" || typeof x !== "number") continue;
      const j = etLevels.indexOf(x as 0 | 1 | 2);
      if (j < 0) continue;
      if (y === 0) t[0]![j] += 1;
      else if (y === 1) t[1]![j] += 1;
    }
    return t;
  }

  const tabC1 = binBinTable("any_mh_util", "ai_emo_support");
  const tabC2 = binBinTable("accessBarrier", "ai_emo_support");
  const tabC3a = binBinTable("any_mh_util", "totalLoss");
  const tabC3b = binBinTable("any_mh_util", "anyDamage");
  const tabC3c = mhEtTable();

  const chi1 = pearsonChiSquare(tabC1);
  const chi2 = pearsonChiSquare(tabC2);
  const chi3a = pearsonChiSquare(tabC3a);
  const chi3b = pearsonChiSquare(tabC3b);
  const chi3c = pearsonChiSquare(tabC3c);
  const n1 = tabC1.flat().reduce((s, x) => s + x, 0);
  const n2 = tabC2.flat().reduce((s, x) => s + x, 0);
  const na = tabC3a.flat().reduce((s, x) => s + x, 0);
  const nb = tabC3b.flat().reduce((s, x) => s + x, 0);
  const nc = tabC3c.flat().reduce((s, x) => s + x, 0);

  const family_C = {
    C1_aMH_x_aES: {
      chisq: {
        statistic: chi1.chi2,
        df: chi1.df,
        p: chi1.p,
        cramers_v: cramersV(chi1.chi2, n1, 2, 2),
        table: tabC1,
      },
      fisher: fisherBundle(tabC1),
    },
    C2_aB_x_aES: {
      chisq: {
        statistic: chi2.chi2,
        df: chi2.df,
        p: chi2.p,
        cramers_v: cramersV(chi2.chi2, n2, 2, 2),
        table: tabC2,
      },
      fisher: fisherBundle(tabC2),
    },
    C3a_aMH_x_TL: {
      chisq: {
        statistic: chi3a.chi2,
        df: chi3a.df,
        p: chi3a.p,
        cramers_v: cramersV(chi3a.chi2, na, 2, 2),
        table: tabC3a,
      },
      fisher: fisherBundle(tabC3a),
    },
    C3b_aMH_x_aD: {
      chisq: {
        statistic: chi3b.chi2,
        df: chi3b.df,
        p: chi3b.p,
        cramers_v: cramersV(chi3b.chi2, nb, 2, 2),
        table: tabC3b,
      },
      fisher: fisherBundle(tabC3b),
    },
    C3c_aMH_x_eT: {
      chisq: {
        statistic: chi3c.chi2,
        df: chi3c.df,
        p: chi3c.p,
        cramers_v: cramersV(chi3c.chi2, nc, 2, 3),
        table: tabC3c,
      },
    },
  };

  const out = {
    generated_by:
      "scripts/generate-inferential-references.ts (jstat, aligned with inferential.ts; rerun R script when possible)",
    family_A,
    family_B,
    family_C,
  };

  const outPath = join(process.cwd(), "src/lib/__tests__/fixtures/inferential-references.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.error("Wrote", outPath);
}

main();
