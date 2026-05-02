import { jStat } from "@/lib/jstat-imports";
import type { FeatureValue } from "@/lib/featurize";

export interface TestResult {
  id: string;
  family: string;
  question: string;
  testName: string;
  variables: { outcome: string; predictor: string };
  n: number;
  groups?: { label: string; n: number; mean?: number; sd?: number; median?: number; proportion?: number }[];
  statistic: number;
  df?: number;
  p: number;
  qFDR?: number;
  effectSize: { name: string; value: number; ci95?: [number, number] };
  warnings: string[];
}

type Row = Record<string, FeatureValue>;

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

function pearsonP(r: number, n: number): number {
  if (n < 3 || Number.isNaN(r)) return 1;
  const clamped = Math.min(0.999999, Math.max(-0.999999, r));
  const t = (clamped * Math.sqrt(n - 2)) / Math.sqrt(1 - clamped * clamped);
  return 2 * (jStat.studentt.cdf(-Math.abs(t), n - 2) as number);
}

function spearmanRho(x: number[], y: number[]): number {
  const rx = jStat.rank(x) as number[];
  const ry = jStat.rank(y) as number[];
  return jStat.corrcoeff(rx, ry) as number;
}

function correlationPair(
  mx: Row[],
  outcome: string,
  predictor: string,
  idBase: string,
  label: string
): TestResult[] {
  const { xa, xb } = rowsWithPair(mx, outcome, predictor);
  const n = xa.length;
  const rP = n >= 3 ? (jStat.corrcoeff(xa, xb) as number) : NaN;
  const rS = n >= 3 ? spearmanRho(xa, xb) : NaN;
  const pP = n >= 3 ? pearsonP(rP, n) : 1;
  const pS = n >= 3 ? pearsonP(rS, n) : 1;

  const baseWarn =
    n < 5
      ? [`Very small effective n=${n} for correlation.`]
      : n < 10
        ? [`Small n=${n}; correlation is unstable.`]
        : [];

  return [
    {
      id: `${idBase}_pearson`,
      family: "A_corr",
      question: label,
      testName: "Pearson r",
      variables: { outcome, predictor },
      n,
      statistic: rP,
      df: n >= 3 ? n - 2 : undefined,
      p: pP,
      effectSize: { name: "r", value: rP },
      warnings: baseWarn,
    },
    {
      id: `${idBase}_spearman`,
      family: "A_corr",
      question: label,
      testName: "Spearman rho",
      variables: { outcome, predictor },
      n,
      statistic: rS,
      p: pS,
      effectSize: { name: "rho", value: rS },
      warnings: baseWarn,
    },
  ];
}

/** Full inferential battery (families B–C) is implemented incrementally; Family A correlations are complete. */
export function runAllTests(matrix: Row[]): TestResult[] {
  const out: TestResult[] = [];

  out.push(
    ...correlationPair(
      matrix,
      "ai_comfort_num",
      "age",
      "A1",
      "Age × AI comfort (ordinal numeric)"
    )
  );
  out.push(
    ...correlationPair(
      matrix,
      "ai_interest_num",
      "age",
      "A2",
      "Age × AI interest (ordinal numeric)"
    )
  );
  out.push(
    ...correlationPair(
      matrix,
      "human_helper_importance_num",
      "age",
      "A3",
      "Age × human-helper importance"
    )
  );

  return out;
}

function fdrBin(family: "A" | "B" | "C"): (r: TestResult) => boolean {
  return (r) => {
    if (family === "A") return r.family.startsWith("A");
    if (family === "B") return r.family.startsWith("B");
    return r.family.startsWith("C");
  };
}

/** Benjamini–Hochberg FDR within each top-level family (A, B, C). */
export function adjustForFDR(results: TestResult[]): TestResult[] {
  const copy = results.map((r) => ({ ...r }));
  for (const fam of ["A", "B", "C"] as const) {
    const idxs = copy
      .map((r, i) => ({ i, r }))
      .filter(({ r }) => fdrBin(fam)(r))
      .map(({ i }) => i);
    const m = idxs.length;
    if (m === 0) continue;

    const sortedIdx = [...idxs].sort((i, j) => copy[i]!.p - copy[j]!.p);
    const qSorted = new Array<number>(m);
    const pSorted = sortedIdx.map((i) => copy[i]!.p);
    qSorted[m - 1] = Math.min(1, pSorted[m - 1]!);
    for (let k = m - 2; k >= 0; k--) {
      const rank = k + 1;
      const adj = (pSorted[k]! * m) / rank;
      qSorted[k] = Math.min(1, Math.min(adj, qSorted[k + 1]!));
    }
    const qBySortedIndex = new Map<number, number>();
    sortedIdx.forEach((origIdx, k) => {
      qBySortedIndex.set(origIdx, qSorted[k]!);
    });
    for (const i of idxs) {
      copy[i]!.qFDR = qBySortedIndex.get(i) ?? copy[i]!.p;
    }
  }
  return copy;
}
