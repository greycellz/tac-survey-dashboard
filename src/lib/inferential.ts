import { jStat } from "@/lib/jstat-imports";
import type { FeatureValue } from "@/lib/featurize";

export type TestFamily = "FAMILY_A_CORR" | "FAMILY_B_GROUP_DIFF" | "FAMILY_C_CHISQ";

export type SkippedReason =
  | "insufficient_data"
  | "group_too_small"
  | "composite_unconfigured"
  | "zero_variance";

export interface CellDisplay {
  r: number;
  c: number;
  text: string;
}

export interface ContingencyBlock {
  rowLabels: string[];
  colLabels: string[];
  counts: number[][];
  cells: CellDisplay[];
}

/** Yates continuity correction toggle for Pearson χ² (not surfaced in UI). */
export const USE_YATES_CHI_SQ_FLAG = false;

export interface TestResult {
  id: string;
  family: TestFamily;
  question: string;
  testName: string;
  variables: { outcome: string; predictor: string };
  n: number;
  groups?: { label: string; n: number; mean?: number; sd?: number; median?: number; proportion?: number }[];
  statistic?: number;
  /** Primary df where applicable (e.g. Welch t, Pearson χ², Kruskal–Wallis). */
  df?: number;
  /** Extra df for Welch F tests (matches R denom df column). */
  denomDf?: number;
  p?: number;
  qFDR?: number;
  effectSize?: { name: string; value: number; ci95?: [number, number] };
  warnings: string[];
  skipped?: { reason: SkippedReason; detail: string };
  contingency?: ContingencyBlock;
}

type Row = Record<string, FeatureValue>;

const WARN_GENDER_NB =
  "Gender contrast uses Female vs Male only — respondents coded Non-binary / PNTS are excluded.";
const WARN_FIRE_EXCLUDED =
  "Eaton-vs-Palisade contrast requires respondents with exclusively Eaton or exclusively Palisade on the fireAffected field (exactly one of is_eaton / is_palisade set to 1).";
const SKIP_MIN_PAIRS_CORR = 3;
const SKIP_MIN_GROUP = 3;

export const SPEARMAN_METHODS_NOTE =
  "Spearman ρ p-values use the Student-t large-sample approximation (the default in R's cor.test(..., exact=FALSE) and SciPy's spearmanr). At small n or with extensive ties, exact or permutation-based methods would be more appropriate. Effect size (ρ) is exact regardless.";

export const COHEN_D_CI_METHODS_NOTE =
  "Cohen's d 95% CIs use the Hedges & Olkin normal approximation with SE²=(n₁+n₂)/(n₁·n₂)+d²/(2(n₁+n₂)); non-central t inversion is not available via jstat in this dashboard.";

export const INSURANCE_SATISFACTION_METHODS_NOTE =
  "Insurance satisfaction correlations and contrasts use only rows with a numeric `insurance_satisfaction_num` (respondents who filed a claim \"Yes\"/\"In progress\" and answered satisfaction). Missing values are pairwise-deleted — non–claim-filers are not modeled as zeros or a baseline group.";

export function skippedLabel(reason: SkippedReason): string {
  switch (reason) {
    case "insufficient_data":
      return "insufficient non-missing pairs or rows";
    case "group_too_small":
      return "too few respondents in one or more groups";
    case "composite_unconfigured":
      return "composite is unconfigured (all missing)";
    case "zero_variance":
      return "variable has zero variance after dropping nulls";
    default:
      return reason;
  }
}

function pearsonPFromR(r: number, nPairs: number): number {
  if (nPairs < SKIP_MIN_PAIRS_CORR || Number.isNaN(r)) return NaN;
  const clamped = Math.min(0.999999, Math.max(-0.999999, r));
  const t = (clamped * Math.sqrt(nPairs - 2)) / Math.sqrt(1 - clamped * clamped);
  return 2 * (jStat.studentt.cdf(-Math.abs(t), nPairs - 2) as number);
}

function spearmanApproxP(rhoRank: number, nPairs: number): number {
  return pearsonPFromR(rhoRank, nPairs);
}

function sampleVariance(vals: number[]): number {
  if (vals.length < 2) return NaN;
  return jStat.variance(vals, true) as number;
}

function medianVals(vals: number[]): number {
  if (vals.length === 0) return NaN;
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : ((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function summariseNumeric(vals: number[]): { mean: number; sd: number; median: number } {
  return {
    mean: vals.length ? (jStat.mean(vals) as number) : NaN,
    sd: vals.length >= 2 ? Math.sqrt(sampleVariance(vals)) : NaN,
    median: medianVals(vals),
  };
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

function rankBiserialTwoSample(g0Vals: number[], g1Vals: number[]): number {
  const pairs: { val: number; g: number }[] = [
    ...g0Vals.map((val) => ({ val, g: 0 })),
    ...g1Vals.map((val) => ({ val, g: 1 })),
  ].sort((a, b) => a.val - b.val);
  const ranks = pooledAverageRanks(pairs.map((p) => p.val));
  const indicator = pairs.map((p) => (p.g === 0 ? 1 : 0));
  return jStat.corrcoeff(indicator, ranks) as number;
}

function wilcoxRankSumW(xVals: number[], yVals: number[]): { W: number; z: number; p: number } {
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
  if (sigmaSq <= 0 || Number.isNaN(sigmaSq)) return { W, z: 0, p: 1 };

  const sigma = Math.sqrt(sigmaSq);
  const z = (W - mu) / sigma;
  const cdf = jStat.normal.cdf(z, 0, 1) as number;
  const p = Math.min(1, Math.max(0, 2 * Math.min(cdf, 1 - cdf)));
  return { W, z, p };
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

/** R stats::oneway.test(..., var.equal=FALSE). */
function welchOneWayANOVA(groupsIn: number[][]): { F: number; df1: number; df2: number; p: number } {
  const groups = groupsIn.filter((g) => g.length > 0);
  const k = groups.length;
  if (k < 2 || groups.some((g) => g.length < 2)) return { F: NaN, df1: NaN, df2: NaN, p: NaN };
  const nI = groups.map((g) => g.length);
  const mI = groups.map((g) => jStat.mean(g) as number);
  const vI = groups.map((g) => sampleVariance(g));
  const wI = nI.map((n, i) => n / vI[i]!);
  const sumWI = wI.reduce((a, b) => a + b, 0);
  const tmp =
    wI.reduce((acc, wi, i) => acc + (1 - wi / sumWI) ** 2 / (nI[i]! - 1), 0) / (k * k - 1);
  const m = wI.reduce((acc, wi, i) => acc + wi * mI[i]!, 0) / sumWI;
  const statistic =
    wI.reduce((acc, wi, i) => acc + wi * (mI[i]! - m) ** 2, 0) / ((k - 1) * (1 + 2 * (k - 2) * tmp));
  const df1 = k - 1;
  const df2 = 1 / (3 * tmp);
  const p = 1 - (jStat.centralF.cdf(statistic, df1, df2) as number);
  return { F: statistic, df1, df2, p: Math.min(1, Math.max(0, p)) };
}

function etaSquaredOneWay(groups: number[][]): number {
  const all: number[] = [];
  for (const g of groups) all.push(...g);
  const N = all.length;
  if (N === 0) return NaN;
  const mu = jStat.mean(all) as number;
  const sst = all.reduce((s, y) => s + (y - mu) ** 2, 0);
  if (sst === 0) return 0;
  let ssb = 0;
  for (const g of groups) {
    const ni = g.length;
    if (ni === 0) continue;
    const mui = jStat.mean(g) as number;
    ssb += ni * (mui - mu) ** 2;
  }
  return ssb / sst;
}

function kruskalWallis(groupsAll: number[][]): { H: number; df: number; p: number; epsilonSquared: number } {
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

  let H =
    (12 / (N * (N + 1))) * Rsums.reduce((s, R, i) => s + R * R / counts[i]!, 0) - 3 * (N + 1);
  const tieCorrectionDen = N ** 3 - N;
  if (tieCorrectionDen !== 0 && tieAdj !== 0) {
    const tieFactor = 1 - tieAdj / tieCorrectionDen;
    if (tieFactor !== 0) H /= tieFactor;
  }

  const df = Math.max(0, k - 1);
  const p = df > 0 && Number.isFinite(H) ? Math.min(1, Math.max(0, 1 - (jStat.chisquare.cdf(H, df) as number))) : NaN;
  const NN = counts.reduce((a, b) => a + b, 0);
  const eps = NN > k && Number.isFinite(H) ? Math.max(0, (H - k + 1) / (NN - k)) : 0;
  return { H, df, p, epsilonSquared: eps };
}

function wilsonCI(success: number, trials: number, z = 1.96): [number, number] {
  if (trials <= 0) return [NaN, NaN];
  const phat = success / trials;
  const denom = 1 + (z * z) / trials;
  const centre = phat + (z * z) / (2 * trials);
  const inner = Math.sqrt((phat * (1 - phat) + (z * z) / (4 * trials)) / trials);
  const lo = Math.max(0, (centre - z * inner) / denom);
  const hi = Math.min(1, (centre + z * inner) / denom);
  return [lo, hi];
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
  const useYates = USE_YATES_CHI_SQ_FLAG && rDim === 2 && cDim === 2;
  for (let i = 0; i < rDim; i++) {
    for (let j = 0; j < cDim; j++) {
      const o = table[i]![j]!;
      const e = (rowSum[i]! * colSum[j]!) / nAll;
      if (e <= 0) continue;
      if (useYates) {
        const adj = Math.abs(o - e) - 0.5;
        const num = adj > 0 ? adj : 0;
        chi2 += (num * num) / e;
      } else {
        const diff = o - e;
        chi2 += (diff * diff) / e;
      }
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

/** log P(top-left successes = x), classic 2×2 margins fixed. */
function logHypergeomPmfl(x: number, K: number, nDraw: number, Ntotal: number): number {
  return (
    (jStat.combinationln(K, x) as number) +
    (jStat.combinationln(Ntotal - K, nDraw - x) as number) -
    (jStat.combinationln(Ntotal, nDraw) as number)
  );
}

/** Two-sided Fisher (sum of probs with likelihood ≤ observed), R-style tie handling on log-space. */
function fisherExactTwoSidedP(table: [[number, number], [number, number]]): number {
  const [[a, b], [cNum, d]] = table;
  const row1 = a + b;
  const row2 = cNum + d;
  const col1 = a + cNum;
  const N = row1 + row2;

  const K = col1;
  const nDraw = row1;
  const xMin = Math.max(0, K - row2);
  const xHigh = Math.min(row1, K);

  const xs: number[] = [];
  const lps: number[] = [];
  for (let x = xMin; x <= xHigh; x++) {
    xs.push(x);
    lps.push(logHypergeomPmfl(x, K, nDraw, N));
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

function oddsRatioWithHaldane(a: number, b: number, cNum: number, d: number): {
  or: number;
  lo: number;
  hi: number;
  usedHaldane: boolean;
} {
  const usedHaldane = a * b * cNum * d === 0;
  const aa = usedHaldane ? a + 0.5 : a;
  const bb = usedHaldane ? b + 0.5 : b;
  const cc = usedHaldane ? cNum + 0.5 : cNum;
  const dd = usedHaldane ? d + 0.5 : d;
  const or = (aa * dd) / (bb * cc);
  const logOr = Math.log(or);
  const se = Math.sqrt(1 / aa + 1 / bb + 1 / cc + 1 / dd);
  const z = 1.96;
  return { or, lo: Math.exp(logOr - z * se), hi: Math.exp(logOr + z * se), usedHaldane };
}

function matrixAllNull(mx: Row[], col: string): boolean {
  return mx.every((r) => r[col] === null || r[col] === undefined);
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

function baseResult(partial: Omit<TestResult, "warnings"> & { warnings?: string[] }): TestResult {
  return { warnings: [], ...partial };
}

function correlationPair(mx: Row[], outcome: string, predictor: string, idBase: string, label: string): TestResult[] {
  const { xa, xb } = rowsWithPair(mx, outcome, predictor);
  const n = xa.length;
  const smallN =
    n < 5
      ? [`Very small effective n=${n} for correlation.`]
      : n < 10
        ? [`Small n=${n}; correlation is unstable.`]
        : [];

  if (n < SKIP_MIN_PAIRS_CORR) {
    const detail = `n=${n} non-null pairs after dropping nulls; minimum ${SKIP_MIN_PAIRS_CORR} required`;
    return [
      baseResult({
        id: `${idBase}_pearson`,
        family: "FAMILY_A_CORR",
        question: label,
        testName: "Pearson r",
        variables: { outcome, predictor },
        n,
        skipped: { reason: "insufficient_data", detail },
        warnings: smallN,
      }),
      baseResult({
        id: `${idBase}_spearman`,
        family: "FAMILY_A_CORR",
        question: label,
        testName: "Spearman ρ (large-sample approximation)",
        variables: { outcome, predictor },
        n,
        skipped: { reason: "insufficient_data", detail },
        warnings: smallN,
      }),
    ];
  }

  const vX = sampleVariance(xa);
  const vY = sampleVariance(xb);
  if (vX === 0 || vY === 0 || Number.isNaN(vX) || Number.isNaN(vY)) {
    const detail = "one or both variables have zero variance after dropping nulls";
    return [
      baseResult({
        id: `${idBase}_pearson`,
        family: "FAMILY_A_CORR",
        question: label,
        testName: "Pearson r",
        variables: { outcome, predictor },
        n,
        skipped: { reason: "zero_variance", detail },
        warnings: smallN,
      }),
      baseResult({
        id: `${idBase}_spearman`,
        family: "FAMILY_A_CORR",
        question: label,
        testName: "Spearman ρ (large-sample approximation)",
        variables: { outcome, predictor },
        n,
        skipped: { reason: "zero_variance", detail },
        warnings: smallN,
      }),
    ];
  }

  const rP = pearsonCorrelation(xa, xb);
  const rS = spearmanRho(xa, xb);
  const pP = pearsonPFromR(rP, n);
  const pS = spearmanApproxP(rS, n);

  return [
    baseResult({
      id: `${idBase}_pearson`,
      family: "FAMILY_A_CORR",
      question: label,
      testName: "Pearson r",
      variables: { outcome, predictor },
      n,
      statistic: rP,
      df: n - 2,
      p: pP,
      effectSize: { name: "r", value: rP },
      warnings: smallN,
    }),
    baseResult({
      id: `${idBase}_spearman`,
      family: "FAMILY_A_CORR",
      question: label,
      testName: "Spearman ρ (large-sample approximation)",
      variables: { outcome, predictor },
      n,
      statistic: rS,
      p: pS,
      effectSize: { name: "ρ", value: rS },
      warnings: smallN,
    }),
  ];
}

function pearsonCorrelation(a: number[], b: number[]): number {
  return jStat.corrcoeff(a, b) as number;
}

function spearmanRho(a: number[], b: number[]): number {
  const rx = jStat.rank(a) as number[];
  const ry = jStat.rank(b) as number[];
  return jStat.corrcoeff(rx, ry) as number;
}

function splitBinaryOutcome(mx: Row[], outcomeKey: string, groupKey: string): { g0: number[]; g1: number[] } {
  const g0: number[] = [];
  const g1: number[] = [];
  for (const r of mx) {
    const y = r[outcomeKey];
    const g = r[groupKey];
    if (typeof y !== "number" || typeof g !== "number") continue;
    if (g === 0) g0.push(y);
    else if (g === 1) g1.push(y);
    else continue;
  }
  return { g0, g1 };
}

function twoSampleTests(params: {
  idWelch: string;
  idMw: string;
  question: string;
  outcomeKey: string;
  predictorKey: string;
  g0Label: string;
  g1Label: string;
  g0: number[];
  g1: number[];
  extras: string[];
}): [TestResult, TestResult] {
  const { idWelch, idMw, question, outcomeKey, predictorKey, g0Label, g1Label, g0, g1, extras } = params;
  const n = g0.length + g1.length;
  const groups = [
    { label: g0Label, n: g0.length, ...summariseNumeric(g0) },
    { label: g1Label, n: g1.length, ...summariseNumeric(g1) },
  ];

  if (g0.length < SKIP_MIN_GROUP || g1.length < SKIP_MIN_GROUP) {
    const detail = `groups have n=${g0.length} and n=${g1.length}; minimum ${SKIP_MIN_GROUP} per group`;
    const skip = (id: string, name: string) =>
      baseResult({
        id,
        family: "FAMILY_B_GROUP_DIFF",
        question,
        testName: name,
        variables: { outcome: outcomeKey, predictor: predictorKey },
        n,
        groups,
        skipped: { reason: "group_too_small", detail },
        warnings: [...extras],
      });
    return [skip(idWelch, "Welch two-sample t"), skip(idMw, "Mann–Whitney / Wilcoxon rank-sum")];
  }

  const pooled = [...g0, ...g1];
  const vv = sampleVariance(pooled);
  if (!Number.isFinite(vv) || vv === 0) {
    const detail = "outcome variance is zero in pooled filtered rows";
    const mk = (id: string, name: string) =>
      baseResult({
        id,
        family: "FAMILY_B_GROUP_DIFF",
        question,
        testName: name,
        variables: { outcome: outcomeKey, predictor: predictorKey },
        n,
        groups,
        skipped: { reason: "zero_variance", detail },
        warnings: [...extras],
      });
    return [mk(idWelch, "Welch two-sample t"), mk(idMw, "Mann–Whitney / Wilcoxon rank-sum")];
  }

  const welch = welchTwoSampleT(g0, g1);
  const cd = pooledCohenD(g0, g1);
  const ww = wilcoxRankSumW(g0, g1);
  const rb = rankBiserialTwoSample(g0, g1);

  return [
    baseResult({
      id: idWelch,
      family: "FAMILY_B_GROUP_DIFF",
      question,
      testName: "Welch two-sample t",
      variables: { outcome: outcomeKey, predictor: predictorKey },
      n,
      groups,
      statistic: welch.t,
      df: welch.df,
      p: welch.p,
      effectSize:
        cd && Number.isFinite(cd.d)
          ? { name: "Cohen's d (pooled SD)", value: cd.d, ci95: [cd.lo, cd.hi] }
          : undefined,
      warnings: [...extras],
    }),
    baseResult({
      id: idMw,
      family: "FAMILY_B_GROUP_DIFF",
      question,
      testName: "Mann–Whitney / Wilcoxon rank-sum",
      variables: { outcome: outcomeKey, predictor: predictorKey },
      n,
      groups,
      statistic: ww.W,
      p: ww.p,
      effectSize: { name: "Rank-biserial r", value: rb },
      warnings: [...extras],
    }),
  ];
}

function buildContingencyBlock(
  rowLabels: string[],
  colLabels: string[],
  counts: number[][]
): ContingencyBlock {
  const colTotals = colLabels.map((_, j) => counts.reduce((s, row) => s + row[j]!, 0));
  const cells: CellDisplay[] = [];
  for (let i = 0; i < counts.length; i++) {
    for (let j = 0; j < counts[i]!.length; j++) {
      const ct = counts[i]![j]!;
      const denom = colTotals[j]!;
      let text = `${ct}`;
      if (denom > 0 && Number.isFinite(ct)) {
        const prop = ct / denom;
        const [lo, hi] = wilsonCI(ct, denom);
        text = `${ct}/${denom} (${(prop * 100).toFixed(1)}%, 95% CI ${(lo * 100).toFixed(1)}–${(
          hi * 100
        ).toFixed(1)}%)`;
      }
      cells.push({ r: i, c: j, text });
    }
  }
  return { rowLabels, colLabels, counts, cells };
}

function contingencyPair(
  idChi: string,
  idFish: string,
  question: string,
  outcomeKey: string,
  predictorKey: string,
  block: ContingencyBlock,
  allowFisher2x2: boolean
): [TestResult, TestResult] {
  const chi = pearsonChiSquare(block.counts);
  const n = block.counts.flat().reduce((s, x) => s + x, 0);

  let lowE = false;
  const rSums = block.counts.map((r) => r.reduce((s, x) => s + x, 0));
  const cDim = block.counts[0]?.length ?? 0;
  const cSums = Array<number>(cDim).fill(0);
  for (let j = 0; j < cDim; j++) {
    for (let i = 0; i < block.counts.length; i++) cSums[j] += block.counts[i]![j]!;
  }
  for (let i = 0; i < block.counts.length; i++) {
    for (let j = 0; j < cDim; j++) {
      const e = (rSums[i]! * cSums[j]!) / n;
      if (e > 0 && e < 5) lowE = true;
    }
  }

  const warningsChi: string[] = [];
  if (lowE) warningsChi.push("One or more Pearson χ² expected cell counts are < 5.");

  const rDim = block.counts.length;
  const V = cramersV(chi.chi2, n, rDim, cDim);

  const chiRes = baseResult({
    id: idChi,
    family: "FAMILY_C_CHISQ",
    question,
    testName: "Pearson χ² (no continuity correction)",
    variables: { outcome: outcomeKey, predictor: predictorKey },
    n,
    statistic: chi.chi2,
    df: chi.df,
    p: chi.p,
    effectSize: Number.isFinite(V) ? { name: "Cramér's V", value: V } : undefined,
    contingency: block,
    warnings: warningsChi,
  });

  const fisherSkipped = (): TestResult =>
    baseResult({
      id: idFish,
      family: "FAMILY_C_CHISQ",
      question,
      testName: allowFisher2x2 ? "Fisher exact" : "Fisher exact (not defined for table size)",
      variables: { outcome: outcomeKey, predictor: predictorKey },
      n,
      skipped: {
        reason: "insufficient_data",
        detail: allowFisher2x2
          ? "Table was not Fisher-eligible internally."
          : "Fisher's exact test is undefined beyond 2×2; asymptotic χ² applies.",
      },
      contingency: block,
      warnings: [...warningsChi, "Fisher exact is only emitted for strictly 2×2 tables."],
    });

  if (!(allowFisher2x2 && rDim === 2 && cDim === 2)) {
    return [chiRes, fisherSkipped()];
  }

  const [[a, b], [cNum, d]] = block.counts as [[number, number], [number, number]];
  const pF = fisherExactTwoSidedP([[a, b], [cNum, d]]);
  const orPack = oddsRatioWithHaldane(a, b, cNum, d);

  const fishWarnings = [...warningsChi];
  if (orPack.usedHaldane)
    fishWarnings.push("Haldane–Anscombe +0.5 applied to every cell before odds ratio / CI (zero-cell table).");

  const fishRes = baseResult({
    id: idFish,
    family: "FAMILY_C_CHISQ",
    question,
    testName: "Fisher exact (two-sided probability mass envelope)",
    variables: { outcome: outcomeKey, predictor: predictorKey },
    n,
    statistic: orPack.or,
    p: pF,
    effectSize: { name: "Odds ratio", value: orPack.or, ci95: [orPack.lo, orPack.hi] },
    contingency: block,
    warnings: fishWarnings,
  });

  return [chiRes, fishRes];
}

function binaryBinaryContingency(
  mx: Row[],
  rowKey: string,
  colKey: string
): { counts: [[number, number], [number, number]]; n: number } | null {
  let a = 0,
    b = 0,
    cNum = 0,
    d = 0;
  for (const r of mx) {
    const rv = r[rowKey];
    const cv = r[colKey];
    if (typeof rv !== "number" || typeof cv !== "number") continue;
    if (rv === 0 && cv === 0) a++;
    else if (rv === 0 && cv === 1) b++;
    else if (rv === 1 && cv === 0) cNum++;
    else if (rv === 1 && cv === 1) d++;
    else continue;
  }
  const n = a + b + cNum + d;
  if (n === 0) return null;
  return { counts: [[a, b], [cNum, d]], n };
}

function binaryByLevelsContingency(
  mx: Row[],
  outcomeKey: string,
  predictorKey: string,
  levels: number[]
): number[][] | null {
  const table = [levels.map(() => 0), levels.map(() => 0)];
  let any = false;
  for (const r of mx) {
    const y = r[outcomeKey];
    const x = r[predictorKey];
    if (typeof y !== "number" || typeof x !== "number") continue;
    const j = levels.indexOf(x);
    if (j < 0) continue;
    any = true;
    if (y === 0) table[0]![j] += 1;
    else if (y === 1) table[1]![j] += 1;
    else continue;
  }
  return any ? table : null;
}

function skippedCompositeInsight(
  col: string,
  nice: string
): Pick<TestResult, "skipped" | "warnings"> {
  const detail = `\`${col}\` is entirely missing (${nice}); configure composite members`;
  return {
    skipped: { reason: "composite_unconfigured", detail },
    warnings: [`Composite-derived variable \`${col}\` is unavailable — configure it in Codebook.`],
  };
}

function pushTwoSkippedB(
  out: TestResult[],
  idW: string,
  idM: string,
  meta: {
    question: string;
    outcomeKey: string;
    predictorKey: string;
    nRows: number;
    insight: ReturnType<typeof skippedCompositeInsight>;
  }
) {
  const { question, outcomeKey, predictorKey, nRows, insight } = meta;
  out.push(
    baseResult({
      id: idW,
      family: "FAMILY_B_GROUP_DIFF",
      question,
      testName: "Welch two-sample t",
      variables: { outcome: outcomeKey, predictor: predictorKey },
      n: nRows,
      skipped: insight.skipped,
      warnings: [...insight.warnings],
    })
  );
  out.push(
    baseResult({
      id: idM,
      family: "FAMILY_B_GROUP_DIFF",
      question,
      testName: "Mann–Whitney / Wilcoxon rank-sum",
      variables: { outcome: outcomeKey, predictor: predictorKey },
      n: nRows,
      skipped: insight.skipped,
      warnings: [...insight.warnings],
    })
  );
}

export function runAllTests(matrix: Row[]): TestResult[] {
  const out: TestResult[] = [];

  out.push(...correlationPair(matrix, "ai_comfort_num", "age", "A1", "Age × AI comfort (ordinal numeric)"));
  out.push(...correlationPair(matrix, "ai_interest_num", "age", "A2", "Age × AI interest (ordinal numeric)"));
  out.push(
    ...correlationPair(matrix, "human_helper_importance_num", "age", "A3", "Age × human-helper importance")
  );

  out.push(
    ...correlationPair(
      matrix,
      "insurance_satisfaction_num",
      "age",
      "A4",
      "Claim-filer insurance satisfaction × age"
    )
  );
  out.push(
    ...correlationPair(
      matrix,
      "insurance_satisfaction_num",
      "wellbeing_num",
      "A5",
      "Claim-filer insurance satisfaction × wellbeing"
    )
  );

  const genderMx = matrix.filter((r) => r.is_female === 1 || r.is_male === 1);
  for (const spec of [
    ["B1a", "ai_comfort_num", "AI comfort (ordinal) × gender"],
    ["B1b", "ai_interest_num", "AI interest (ordinal) × gender"],
  ] as const) {
    const [idBase, oc, qlabel] = spec;
    const { g0, g1 } = splitBinaryOutcome(genderMx, oc, "is_female");
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey: oc,
        predictorKey: "is_female",
        g0Label: "Male",
        g1Label: "Female",
        g0,
        g1,
        extras: [WARN_GENDER_NB],
      })
    );
  }

  const fireMx = matrix.filter(
    (r) =>
      typeof r.is_eaton === "number" &&
      typeof r.is_palisade === "number" &&
      ((r.is_eaton === 1 && r.is_palisade !== 1) || (r.is_palisade === 1 && r.is_eaton !== 1))
  );
  for (const spec of [
    ["B2a", "ai_comfort_num", "AI comfort (ordinal) × fire location"],
    ["B2b", "ai_interest_num", "AI interest (ordinal) × fire location"],
  ] as const) {
    const [idBase, oc, qlabel] = spec;
    const { g0, g1 } = splitBinaryOutcome(fireMx, oc, "is_eaton");
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey: oc,
        predictorKey: "is_eaton",
        g0Label: "Palisade",
        g1Label: "Eaton",
        g0,
        g1,
        extras: [WARN_FIRE_EXCLUDED],
      })
    );
  }

  /** B3 totals / composite contrasts */
  for (const [idBase, outcomeKey, predKey, qlabel, insightNice] of [
    ["B3a", "ai_comfort_num", "totalLoss", "AI comfort × total-loss composite", "totalLoss composite"],
    ["B3c", "ai_comfort_num", "anyDamage", "AI comfort × selected-damage composite", "anyDamage composite"],
  ] as const) {
    if (matrixAllNull(matrix, predKey)) {
      const ins = skippedCompositeInsight(predKey, insightNice);
      pushTwoSkippedB(out, `${idBase}_welch`, `${idBase}_mwu`, {
        question: qlabel,
        outcomeKey,
        predictorKey: predKey,
        nRows: matrix.length,
        insight: ins,
      });
      continue;
    }
    const { g0, g1 } = splitBinaryOutcome(matrix, outcomeKey, predKey);
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey,
        predictorKey: predKey,
        g0Label: "No",
        g1Label: "Yes",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B3b / B3d — AI interest × damage composites */
  for (const [idBase, outcomeKey, predKey, qlabel, insightNice] of [
    ["B3b", "ai_interest_num", "totalLoss", "AI interest × total-loss composite", "totalLoss composite"],
    ["B3d", "ai_interest_num", "anyDamage", "AI interest × selected-damage composite", "anyDamage composite"],
  ] as const) {
    if (matrixAllNull(matrix, predKey)) {
      const ins = skippedCompositeInsight(predKey, insightNice);
      pushTwoSkippedB(out, `${idBase}_welch`, `${idBase}_mwu`, {
        question: qlabel,
        outcomeKey,
        predictorKey: predKey,
        nRows: matrix.length,
        insight: ins,
      });
      continue;
    }
    const { g0, g1 } = splitBinaryOutcome(matrix, outcomeKey, predKey);
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey,
        predictorKey: predKey,
        g0Label: "No",
        g1Label: "Yes",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B3e / B3f exposure tiers — AI comfort */
  {
    const predKey = "exposureTier";
    const insightNice = "exposureTier composite";
    const subset = matrix.filter((r) => typeof r[predKey] === "number");
    if (matrixAllNull(matrix, predKey)) {
      const ins = skippedCompositeInsight(predKey, insightNice);
      for (const spec of [
        ["B3e_anova", "Welch one-way ANOVA (oneway.test, var.eq FALSE)"],
        ["B3f_kw", "Kruskal–Wallis H"],
      ] as const) {
        out.push(
          baseResult({
            id: spec[0],
            family: "FAMILY_B_GROUP_DIFF",
            question: `AI comfort × ${predKey}`,
            testName: spec[1],
            variables: { outcome: "ai_comfort_num", predictor: predKey },
            n: matrix.length,
            skipped: ins.skipped,
            warnings: [...ins.warnings],
          })
        );
      }
    } else {
      const levels = [0, 1, 2];
      const groups = levels.map((lv) =>
        subset
          .filter((r) => (r[predKey] as number) === lv && typeof r.ai_comfort_num === "number")
          .map((r) => r.ai_comfort_num as number)
      );
      const ns = groups.map((g) => g.length);

      const labelFor = (lv: number) =>
        lv === 0 ? "Tier 0 (evac/no configured damage tier)" : lv === 1 ? "Tier 1 (partial/smoke)" : "Tier 2 (total loss)";
      const groupSummaries = levels.map((lv, idx) => ({ label: labelFor(lv), n: ns[idx]!, ...summariseNumeric(groups[idx]!) }));

      if (ns.some((n) => n < SKIP_MIN_GROUP)) {
        const detail = `tier ns=[${ns.join(", ")}]; need ≥${SKIP_MIN_GROUP} respondents per tier`;
        for (const spec of [
          ["B3e_anova", "Welch one-way ANOVA (oneway.test, var.eq FALSE)"],
          ["B3f_kw", "Kruskal–Wallis H"],
        ] as const) {
          const [tid, nm] = spec;
          const skip = (): TestResult =>
            baseResult({
              id: tid,
              family: "FAMILY_B_GROUP_DIFF",
              question: "AI comfort × exposureTier",
              testName: nm,
              variables: { outcome: "ai_comfort_num", predictor: predKey },
              n: subset.length,
              groups: groupSummaries,
              skipped: { reason: "group_too_small", detail },
              warnings: [],
            });
          out.push(skip());
        }
      } else {
        const anova = welchOneWayANOVA(groups);
        const eta = etaSquaredOneWay(groups);
        out.push(
          baseResult({
            id: "B3e_anova",
            family: "FAMILY_B_GROUP_DIFF",
            question: "AI comfort × exposureTier (Welch one-way ANOVA)",
            testName: "Welch one-way ANOVA (oneway.test, var.eq FALSE)",
            variables: { outcome: "ai_comfort_num", predictor: predKey },
            n: subset.length,
            groups: groupSummaries,
            statistic: anova.F,
            df: anova.df1,
            denomDf: anova.df2,
            p: anova.p,
            effectSize: Number.isFinite(eta) ? { name: "η² (eta-squared, omnibus SS)", value: eta } : undefined,
            warnings: [],
          })
        );

        const kw = kruskalWallis(groups);
        out.push(
          baseResult({
            id: "B3f_kw",
            family: "FAMILY_B_GROUP_DIFF",
            question: "AI comfort × exposureTier (Kruskal–Wallis)",
            testName: "Kruskal–Wallis H",
            variables: { outcome: "ai_comfort_num", predictor: predKey },
            n: subset.length,
            groups: groupSummaries,
            statistic: kw.H,
            df: kw.df,
            p: kw.p,
            effectSize: { name: "ε² (epsilon-squared)", value: kw.epsilonSquared },
            warnings: [],
          })
        );
      }
    }
  }

  /** B3g — AI interest × exposureTier (Welch omnibus + Kruskal–Wallis) */
  {
    const predKey = "exposureTier";
    const insightNice = "exposureTier composite";
    const outcomeKey = "ai_interest_num" as const;
    const subset = matrix.filter((r) => typeof r[predKey] === "number");
    if (matrixAllNull(matrix, predKey)) {
      const ins = skippedCompositeInsight(predKey, insightNice);
      for (const spec of [
        ["B3g_anova", "Welch one-way ANOVA (oneway.test, var.eq FALSE)"],
        ["B3g_kw", "Kruskal–Wallis H"],
      ] as const) {
        out.push(
          baseResult({
            id: spec[0],
            family: "FAMILY_B_GROUP_DIFF",
            question: `AI interest × ${predKey}`,
            testName: spec[1],
            variables: { outcome: outcomeKey, predictor: predKey },
            n: matrix.length,
            skipped: ins.skipped,
            warnings: [...ins.warnings],
          })
        );
      }
    } else {
      const levels = [0, 1, 2];
      const groups = levels.map((lv) =>
        subset
          .filter((r) => (r[predKey] as number) === lv && typeof r[outcomeKey] === "number")
          .map((r) => r[outcomeKey] as number)
      );
      const ns = groups.map((g) => g.length);

      const labelFor = (lv: number) =>
        lv === 0 ? "Tier 0 (evac/no configured damage tier)" : lv === 1 ? "Tier 1 (partial/smoke)" : "Tier 2 (total loss)";
      const groupSummaries = levels.map((lv, idx) => ({
        label: labelFor(lv),
        n: ns[idx]!,
        ...summariseNumeric(groups[idx]!),
      }));

      if (ns.some((n) => n < SKIP_MIN_GROUP)) {
        const detail = `tier ns=[${ns.join(", ")}]; need ≥${SKIP_MIN_GROUP} respondents per tier`;
        for (const spec of [
          ["B3g_anova", "Welch one-way ANOVA (oneway.test, var.eq FALSE)"],
          ["B3g_kw", "Kruskal–Wallis H"],
        ] as const) {
          const [tid, nm] = spec;
          out.push(
            baseResult({
              id: tid,
              family: "FAMILY_B_GROUP_DIFF",
              question: "AI interest × exposureTier",
              testName: nm,
              variables: { outcome: outcomeKey, predictor: predKey },
              n: subset.length,
              groups: groupSummaries,
              skipped: { reason: "group_too_small", detail },
              warnings: [],
            })
          );
        }
      } else {
        const anova = welchOneWayANOVA(groups);
        const eta = etaSquaredOneWay(groups);
        out.push(
          baseResult({
            id: "B3g_anova",
            family: "FAMILY_B_GROUP_DIFF",
            question: "AI interest × exposureTier (Welch one-way ANOVA)",
            testName: "Welch one-way ANOVA (oneway.test, var.eq FALSE)",
            variables: { outcome: outcomeKey, predictor: predKey },
            n: subset.length,
            groups: groupSummaries,
            statistic: anova.F,
            df: anova.df1,
            denomDf: anova.df2,
            p: anova.p,
            effectSize: Number.isFinite(eta) ? { name: "η² (eta-squared, omnibus SS)", value: eta } : undefined,
            warnings: [],
          })
        );

        const kw = kruskalWallis(groups);
        out.push(
          baseResult({
            id: "B3g_kw",
            family: "FAMILY_B_GROUP_DIFF",
            question: "AI interest × exposureTier (Kruskal–Wallis)",
            testName: "Kruskal–Wallis H",
            variables: { outcome: outcomeKey, predictor: predKey },
            n: subset.length,
            groups: groupSummaries,
            statistic: kw.H,
            df: kw.df,
            p: kw.p,
            effectSize: { name: "ε² (epsilon-squared)", value: kw.epsilonSquared },
            warnings: [],
          })
        );
      }
    }
  }

  /** B4 / B5 / B6 */
  for (const spec of [
    ["B4a", "has_children", "AI comfort × parent of child"],
    ["B6a", "prior_ai_use", "AI comfort × prior AI/chatbot experience"],
    ["B5a", "is_caregiver", "AI comfort × caregiver status"],
  ] as const) {
    const idBase = spec[0];
    const predictorKey = spec[1];
    const qlabel = spec[2];
    const { g0, g1 } = splitBinaryOutcome(matrix, "ai_comfort_num", predictorKey);
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey: "ai_comfort_num",
        predictorKey,
        g0Label: "No",
        g1Label: "Yes",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B4b / B5b / B6b — AI interest × demographics */
  for (const spec of [
    ["B4b", "has_children", "AI interest × parent of child"],
    ["B6b", "prior_ai_use", "AI interest × prior AI/chatbot experience"],
    ["B5b", "is_caregiver", "AI interest × caregiver status"],
  ] as const) {
    const idBase = spec[0];
    const predictorKey = spec[1];
    const qlabel = spec[2];
    const { g0, g1 } = splitBinaryOutcome(matrix, "ai_interest_num", predictorKey);
    out.push(
      ...twoSampleTests({
        idWelch: `${idBase}_welch`,
        idMw: `${idBase}_mwu`,
        question: qlabel,
        outcomeKey: "ai_interest_num",
        predictorKey,
        g0Label: "No",
        g1Label: "Yes",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B7 wellbeing × ai_emotional interest */
  if (matrixAllNull(matrix, "ai_emo_support")) {
    const ins = skippedCompositeInsight("ai_emo_support", "AI emotional-support interest composite");
    pushTwoSkippedB(out, "B7_welch", "B7_mwu", {
      question: "Wellbeing (ordinal numeric) × AI emotional-support composite",
      outcomeKey: "wellbeing_num",
      predictorKey: "ai_emo_support",
      nRows: matrix.length,
      insight: ins,
    });
  } else {
    const { g0, g1 } = splitBinaryOutcome(matrix, "wellbeing_num", "ai_emo_support");
    out.push(
      ...twoSampleTests({
        idWelch: "B7_welch",
        idMw: "B7_mwu",
        question: "Wellbeing × AI emotional-support interest",
        outcomeKey: "wellbeing_num",
        predictorKey: "ai_emo_support",
        g0Label: "Not interested composite",
        g1Label: "Interested composite",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B8 Age × mh utilisation */
  {
    const { g0, g1 } = splitBinaryOutcome(matrix, "age", "any_mh_util");
    out.push(
      ...twoSampleTests({
        idWelch: "B8_welch",
        idMw: "B8_mwu",
        question: "Age × any mental-health support utilisation",
        outcomeKey: "age",
        predictorKey: "any_mh_util",
        g0Label: "No utilisation coded",
        g1Label: "Utilisation coded Yes",
        g0,
        g1,
        extras: [],
      })
    );
  }

  /** B9 — claim-filer insurance satisfaction × composites / fire */
  {
    const outcomeKey = "insurance_satisfaction_num" as const;
    const insNote = INSURANCE_SATISFACTION_METHODS_NOTE;
    const allInsMiss = matrixAllNull(matrix, outcomeKey);

    if (allInsMiss) {
      const detail =
        "`insurance_satisfaction_num` is missing for all filtered rows — no claim-filers with satisfaction coded.";
      const insMissingInsight = {
        skipped: {
          reason: "insufficient_data" as const,
          detail,
        },
        warnings: [insNote],
      };
      for (const tup of [
        ["B9a_welch", "B9a_mwu", "Claim-filer insurance satisfaction × totalLoss", "totalLoss"],
        ["B9b_welch", "B9b_mwu", "Claim-filer insurance satisfaction × anyDamage", "anyDamage"],
        ["B9c_welch", "B9c_mwu", "Claim-filer insurance satisfaction × fire location", "is_eaton"],
      ] as const) {
        pushTwoSkippedB(out, tup[0], tup[1], {
          question: tup[2],
          outcomeKey,
          predictorKey: tup[3],
          nRows: matrix.length,
          insight: insMissingInsight,
        });
      }
      for (const tid of ["B9d_anova", "B9e_kw"] as const) {
        out.push(
          baseResult({
            id: tid,
            family: "FAMILY_B_GROUP_DIFF",
            question: "Claim-filer insurance satisfaction × exposureTier",
            testName: tid === "B9d_anova" ? "Welch one-way ANOVA (oneway.test, var.eq FALSE)" : "Kruskal–Wallis H",
            variables: { outcome: outcomeKey, predictor: "exposureTier" },
            n: matrix.length,
            skipped: insMissingInsight.skipped,
            warnings: [...insMissingInsight.warnings],
          })
        );
      }
    } else {
      /** B9a / B9b */
      for (const [idBase, predKey, qlabel, insightNice] of [
        ["B9a", "totalLoss", "Claim-filer insurance satisfaction × totalLoss", "totalLoss composite"],
        ["B9b", "anyDamage", "Claim-filer insurance satisfaction × anyDamage", "anyDamage composite"],
      ] as const) {
        if (matrixAllNull(matrix, predKey)) {
          const ins = skippedCompositeInsight(predKey, insightNice);
          pushTwoSkippedB(out, `${idBase}_welch`, `${idBase}_mwu`, {
            question: qlabel,
            outcomeKey,
            predictorKey: predKey,
            nRows: matrix.length,
            insight: ins,
          });
          continue;
        }
        const { g0, g1 } = splitBinaryOutcome(matrix, outcomeKey, predKey);
        out.push(
          ...twoSampleTests({
            idWelch: `${idBase}_welch`,
            idMw: `${idBase}_mwu`,
            question: qlabel,
            outcomeKey,
            predictorKey: predKey,
            g0Label: "No",
            g1Label: "Yes",
            g0,
            g1,
            extras: [insNote],
          })
        );
      }

      /** B9c Eaton vs Palisade among claim-filers */
      const fireMxIns = matrix.filter(
        (r) =>
          typeof r[outcomeKey] === "number" &&
          typeof r.is_eaton === "number" &&
          typeof r.is_palisade === "number" &&
          ((r.is_eaton === 1 && r.is_palisade !== 1) || (r.is_palisade === 1 && r.is_eaton !== 1))
      );
      const { g0, g1 } = splitBinaryOutcome(fireMxIns, outcomeKey, "is_eaton");
      out.push(
        ...twoSampleTests({
          idWelch: "B9c_welch",
          idMw: "B9c_mwu",
          question: "Claim-filer insurance satisfaction × fire location",
          outcomeKey,
          predictorKey: "is_eaton",
          g0Label: "Palisade",
          g1Label: "Eaton",
          g0,
          g1,
          extras: [WARN_FIRE_EXCLUDED, insNote],
        })
      );

      /** B9d / B9e exposure tiers */
      {
        const predKey = "exposureTier";
        const subset = matrix.filter((r) => typeof r[outcomeKey] === "number" && typeof r[predKey] === "number");

        if (matrixAllNull(matrix, predKey)) {
          const ins = skippedCompositeInsight(predKey, "exposureTier composite");
          out.push(
            baseResult({
              id: "B9d_anova",
              family: "FAMILY_B_GROUP_DIFF",
              question: "Claim-filer insurance satisfaction × exposureTier",
              testName: "Welch one-way ANOVA (oneway.test, var.eq FALSE)",
              variables: { outcome: outcomeKey, predictor: predKey },
              n: matrix.length,
              skipped: ins.skipped,
              warnings: [...ins.warnings, insNote],
            })
          );
          out.push(
            baseResult({
              id: "B9e_kw",
              family: "FAMILY_B_GROUP_DIFF",
              question: "Claim-filer insurance satisfaction × exposureTier",
              testName: "Kruskal–Wallis H",
              variables: { outcome: outcomeKey, predictor: predKey },
              n: matrix.length,
              skipped: ins.skipped,
              warnings: [...ins.warnings, insNote],
            })
          );
        } else {
          const levels = [0, 1, 2];
          const groups = levels.map((lv) =>
            subset
              .filter((r) => (r[predKey] as number) === lv)
              .map((r) => r[outcomeKey] as number)
          );
          const ns = groups.map((g) => g.length);

          const labelFor = (lv: number) =>
            lv === 0 ? "Tier 0 (evac/no configured damage tier)" : lv === 1 ? "Tier 1 (partial/smoke)" : "Tier 2 (total loss)";
          const groupSummaries = levels.map((lv, idx) => ({
            label: labelFor(lv),
            n: ns[idx]!,
            ...summariseNumeric(groups[idx]!),
          }));

          if (ns.some((n) => n < SKIP_MIN_GROUP)) {
            const detail = `tier ns=[${ns.join(", ")}]; need ≥${SKIP_MIN_GROUP} respondents per tier`;
            out.push(
              baseResult({
                id: "B9d_anova",
                family: "FAMILY_B_GROUP_DIFF",
                question: "Claim-filer insurance satisfaction × exposureTier (Welch one-way ANOVA)",
                testName: "Welch one-way ANOVA (oneway.test, var.eq FALSE)",
                variables: { outcome: outcomeKey, predictor: predKey },
                n: subset.length,
                groups: groupSummaries,
                skipped: { reason: "group_too_small", detail },
                warnings: [insNote],
              })
            );
            out.push(
              baseResult({
                id: "B9e_kw",
                family: "FAMILY_B_GROUP_DIFF",
                question: "Claim-filer insurance satisfaction × exposureTier (Kruskal–Wallis)",
                testName: "Kruskal–Wallis H",
                variables: { outcome: outcomeKey, predictor: predKey },
                n: subset.length,
                groups: groupSummaries,
                skipped: { reason: "group_too_small", detail },
                warnings: [insNote],
              })
            );
          } else {
            const anova = welchOneWayANOVA(groups);
            const eta = etaSquaredOneWay(groups);
            out.push(
              baseResult({
                id: "B9d_anova",
                family: "FAMILY_B_GROUP_DIFF",
                question: "Claim-filer insurance satisfaction × exposureTier (Welch one-way ANOVA)",
                testName: "Welch one-way ANOVA (oneway.test, var.eq FALSE)",
                variables: { outcome: outcomeKey, predictor: predKey },
                n: subset.length,
                groups: groupSummaries,
                statistic: anova.F,
                df: anova.df1,
                denomDf: anova.df2,
                p: anova.p,
                effectSize: Number.isFinite(eta) ? { name: "η² (eta-squared, omnibus SS)", value: eta } : undefined,
                warnings: [insNote],
              })
            );

            const kw = kruskalWallis(groups);
            out.push(
              baseResult({
                id: "B9e_kw",
                family: "FAMILY_B_GROUP_DIFF",
                question: "Claim-filer insurance satisfaction × exposureTier (Kruskal–Wallis)",
                testName: "Kruskal–Wallis H",
                variables: { outcome: outcomeKey, predictor: predKey },
                n: subset.length,
                groups: groupSummaries,
                statistic: kw.H,
                df: kw.df,
                p: kw.p,
                effectSize: { name: "ε² (epsilon-squared)", value: kw.epsilonSquared },
                warnings: [insNote],
              })
            );
          }
        }
      }
    }
  }

  /** C family — χ² + Fisher (2×2 only) */
  const emoMissing = matrixAllNull(matrix, "ai_emo_support");
  if (emoMissing) {
    const ins = skippedCompositeInsight("ai_emo_support", "AI emotional-support interest composite");
    for (const id of ["C1_chi", "C1_fisher", "C2_chi", "C2_fisher"] as const) {
      const isChi = id.endsWith("_chi");
      out.push(
        baseResult({
          id,
          family: "FAMILY_C_CHISQ",
          question: id.startsWith("C1")
            ? "any_mh_util × ai_emo_support"
            : "accessBarrier × ai_emo_support",
          testName: isChi ? "Pearson χ²" : "Fisher exact",
          variables: {
            outcome: id.startsWith("C1") ? "any_mh_util" : "accessBarrier",
            predictor: "ai_emo_support",
          },
          n: matrix.length,
          skipped: ins.skipped,
          warnings: [...ins.warnings],
        })
      );
    }
  } else {
    /** C1 */
    const c1Raw = binaryBinaryContingency(matrix, "any_mh_util", "ai_emo_support");
    if (!c1Raw) {
      const sk = {
        skipped: {
          reason: "insufficient_data" as const,
          detail: "no complete binary observations for both any_mh_util and ai_emo_support simultaneously",
        },
        warnings: [] as string[],
      };
      for (const id of ["C1_chi", "C1_fisher"] as const) {
        out.push(
          baseResult({
            id,
            family: "FAMILY_C_CHISQ",
            question: "any_mh_util × ai_emo_support",
            testName: id.endsWith("_chi") ? "Pearson χ²" : "Fisher exact",
            variables: { outcome: "any_mh_util", predictor: "ai_emo_support" },
            n: 0,
            skipped: sk.skipped,
            warnings: sk.warnings,
          })
        );
      }
    } else {
      const block = buildContingencyBlock(["MH util coded 0", "MH util coded 1"], ["AI emo 0", "AI emo 1"], c1Raw.counts);
      out.push(
        ...contingencyPair("C1_chi", "C1_fisher", "any_mh_util × ai_emo_support", "any_mh_util", "ai_emo_support", block, true)
      );
    }

    /** C2 */
    if (matrixAllNull(matrix, "accessBarrier")) {
      const ins = skippedCompositeInsight("accessBarrier", "accessBarrier composite");
      for (const id of ["C2_chi", "C2_fisher"] as const) {
        const isChi = id.endsWith("_chi");
        out.push(
          baseResult({
            id,
            family: "FAMILY_C_CHISQ",
            question: "accessBarrier × ai_emo_support",
            testName: isChi ? "Pearson χ²" : "Fisher exact",
            variables: { outcome: "accessBarrier", predictor: "ai_emo_support" },
            n: matrix.length,
            skipped: ins.skipped,
            warnings: [...ins.warnings],
          })
        );
      }
    } else {
      const c2Raw = binaryBinaryContingency(matrix, "accessBarrier", "ai_emo_support");
      if (!c2Raw) {
        const sk: TestResult["skipped"] = {
          reason: "insufficient_data",
          detail: "no complete 0/1 observations for accessBarrier × ai_emo_support",
        };
        for (const id of ["C2_chi", "C2_fisher"] as const) {
          out.push(
            baseResult({
              id,
              family: "FAMILY_C_CHISQ",
              question: "accessBarrier × ai_emo_support",
              testName: id.endsWith("_chi") ? "Pearson χ²" : "Fisher exact",
              variables: { outcome: "accessBarrier", predictor: "ai_emo_support" },
              n: 0,
              skipped: sk,
              warnings: [],
            })
          );
        }
      } else {
        const block = buildContingencyBlock(
          ["Barrier coded 0", "Barrier coded 1"],
          ["AI emo 0", "AI emo 1"],
          c2Raw.counts
        );
        out.push(
          ...contingencyPair(
            "C2_chi",
            "C2_fisher",
            "accessBarrier × ai_emo_support",
            "accessBarrier",
            "ai_emo_support",
            block,
            true
          )
        );
      }
    }
  }

  /** C3 — mental health util × exposure cuts (χ² only when >2×2) */
  for (const spec of [
    ["C3a", "totalLoss", "any_mh_util × totalLoss composite", "totalLoss composite"],
    ["C3b", "anyDamage", "any_mh_util × anyDamage composite", "anyDamage composite"],
  ] as const) {
    const [idBase, col, q, nice] = spec;
    if (matrixAllNull(matrix, col)) {
      const ins = skippedCompositeInsight(col, nice);
      out.push(
        baseResult({
          id: `${idBase}_chi`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Pearson χ²",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: ins.skipped,
          warnings: [...ins.warnings],
        })
      );
      out.push(
        baseResult({
          id: `${idBase}_fisher`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Fisher exact (not applicable)",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: {
            reason: "insufficient_data",
            detail: "Exposure column missing entirely — cannot form contingency.",
          },
          warnings: [...ins.warnings],
        })
      );
      continue;
    }

    const table = binaryByLevelsContingency(matrix, "any_mh_util", col, [0, 1]);
    if (!table) {
      out.push(
        baseResult({
          id: `${idBase}_chi`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Pearson χ²",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: { reason: "insufficient_data", detail: "contingency table unavailable" },
          warnings: [],
        })
      );
      out.push(
        baseResult({
          id: `${idBase}_fisher`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Fisher exact (not applicable)",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: { reason: "insufficient_data", detail: "Fisher stays undefined for asymmetric designs here." },
          warnings: [],
        })
      );
      continue;
    }

    const block = buildContingencyBlock(["MH util 0", "MH util 1"], [`${col} 0`, `${col} 1`], table);
    const [chiR, fisherR] = contingencyPair(`${idBase}_chi`, `${idBase}_fisher`, q, "any_mh_util", col, block, true);
    out.push(chiR, fisherR);
  }

  /** C3c — exposureTier (2×3) */
  {
    const col = "exposureTier";
    const idBase = "C3c";
    const q = "any_mh_util × exposureTier";
    if (matrixAllNull(matrix, col)) {
      const ins = skippedCompositeInsight(col, "exposureTier composite");
      out.push(
        baseResult({
          id: `${idBase}_chi`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Pearson χ²",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: ins.skipped,
          warnings: [
            ...ins.warnings,
            "Fisher's exact test does not extend to unordered 2×3 tables — χ² only.",
          ],
        })
      );
      out.push(
        baseResult({
          id: `${idBase}_fisher`,
          family: "FAMILY_C_CHISQ",
          question: q,
          testName: "Fisher exact (not defined)",
          variables: { outcome: "any_mh_util", predictor: col },
          n: matrix.length,
          skipped: {
            reason: "insufficient_data",
            detail: "Fisher's exact test has no standard multinomial analogue for generic r×k tables.",
          },
          warnings: [],
        })
      );
    } else {
      const table = binaryByLevelsContingency(matrix, "any_mh_util", col, [0, 1, 2]);
      if (!table) {
        out.push(
          baseResult({
            id: `${idBase}_chi`,
            family: "FAMILY_C_CHISQ",
            question: q,
            testName: "Pearson χ²",
            variables: { outcome: "any_mh_util", predictor: col },
            n: matrix.length,
            skipped: { reason: "insufficient_data", detail: "contingency table unavailable" },
            warnings: [],
          })
        );
        out.push(
          baseResult({
            id: `${idBase}_fisher`,
            family: "FAMILY_C_CHISQ",
            question: q,
            testName: "Fisher exact (not defined)",
            variables: { outcome: "any_mh_util", predictor: col },
            n: matrix.length,
            skipped: { reason: "insufficient_data", detail: "Table missing — Fisher undefined." },
            warnings: [],
          })
        );
      } else {
        const block = buildContingencyBlock(
          ["MH util 0", "MH util 1"],
          ["Tier 0", "Tier 1", "Tier 2"],
          table
        );
        const [chiR, fisherR] = contingencyPair(
          `${idBase}_chi`,
          `${idBase}_fisher`,
          q,
          "any_mh_util",
          col,
          block,
          false
        );
        out.push(chiR, {
          ...fisherR,
          warnings: [
            ...fisherR.warnings,
            "χ² contrasts a binary outcome against three exposure tiers; Fisher's exact omnibus is not shown.",
          ],
        });
      }
    }
  }

  return out;
}

export function adjustForFDR(results: TestResult[]): TestResult[] {
  const copy = results.map((r) => ({ ...r }));
  const families: TestFamily[] = ["FAMILY_A_CORR", "FAMILY_B_GROUP_DIFF", "FAMILY_C_CHISQ"];

  for (const fam of families) {
    const eligibleIdx = copy
      .map((r, i) => ({ r, i }))
      .filter(
        ({ r }) =>
          r.family === fam &&
          !r.skipped &&
          typeof r.p === "number" &&
          Number.isFinite(r.p)
      )
      .map(({ i }) => i);

    const m = eligibleIdx.length;
    if (m === 0) {
      for (const r of copy) {
        if (r.family === fam) r.qFDR = undefined;
      }
      continue;
    }

    const sortedIdx = [...eligibleIdx].sort((i, j) => {
      const pi = copy[i]!.p ?? 1;
      const pj = copy[j]!.p ?? 1;
      if (pi !== pj) return pi - pj;
      return copy[i]!.id.localeCompare(copy[j]!.id);
    });

    const pSorted = sortedIdx.map((i) => copy[i]!.p!);
    const qSorted = new Array<number>(m);
    qSorted[m - 1] = Math.min(1, pSorted[m - 1]!);
    for (let k = m - 2; k >= 0; k--) {
      const rank = k + 1;
      const adj = (pSorted[k]! * m) / rank;
      qSorted[k] = Math.min(1, Math.min(adj, qSorted[k + 1]!));
    }

    const qMap = new Map<number, number>();
    sortedIdx.forEach((idx, ord) => qMap.set(idx, qSorted[ord]!));

    for (let i = 0; i < copy.length; i++) {
      if (copy[i]!.family !== fam) continue;
      if (
        copy[i]!.skipped ||
        typeof copy[i]!.p !== "number" ||
        !Number.isFinite(copy[i]!.p)
      ) {
        copy[i]!.qFDR = undefined;
        continue;
      }
      copy[i]!.qFDR = qMap.get(i);
    }
  }

  return copy;
}

