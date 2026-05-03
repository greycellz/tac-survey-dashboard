"use client";

import { useSurveyData } from "@/contexts/SurveyDataContext";
import { useFeatureBundle } from "@/contexts/FeatureContext";
import {
  adjustForFDR,
  COHEN_D_CI_METHODS_NOTE,
  INSURANCE_SATISFACTION_METHODS_NOTE,
  runAllTests,
  SPEARMAN_METHODS_NOTE,
  skippedLabel,
  type CellDisplay,
  type TestResult,
} from "@/lib/inferential";
import PageHeader from "@/components/dashboard/PageHeader";
import type { VariableDef } from "@/lib/featurize";

const FAMILY_A = "FAMILY_A_CORR" as const;
const FAMILY_B = "FAMILY_B_GROUP_DIFF" as const;
const FAMILY_C = "FAMILY_C_CHISQ" as const;

function refHintsFor(varName: string, schema: VariableDef[]): string[] {
  const d = schema.find((s) => s.name === varName);
  const w: string[] = [];
  const rd = d?.referenceDistribution;
  if (!rd) return w;
  if (Math.abs(rd.skewness) > 1 || Math.abs(rd.kurtosis) > 1) {
    w.push(
      `Distribution non-normal in full sample (skew=${rd.skewness.toFixed(2)}, excess kurtosis=${rd.kurtosis.toFixed(
        2
      )}); prefer non-parametric result where available (heuristic, not a formal normality test).`
    );
  }
  if (rd.outliersAbove2SD > 0) {
    w.push(`${rd.outliersAbove2SD} values beyond ±2 SD in full-sample reference distribution.`);
  }
  return w;
}

export default function InferentialClient() {
  const { filteredRespondents, filters } = useSurveyData();
  const { bundle } = useFeatureBundle();
  const { schema, matrix } = bundle;

  const rawResults = runAllTests(matrix as Record<string, number | null>[]);
  const results = adjustForFDR(rawResults);

  const famA = results.filter((r) => r.family === FAMILY_A);
  const famB = results.filter((r) => r.family === FAMILY_B);
  const famC = results.filter((r) => r.family === FAMILY_C);

  const hasInsuranceOutcome = [...famA, ...famB].some((r) => r.variables.outcome === "insurance_satisfaction_num");

  return (
    <div>
      <div className="sticky top-[var(--header-height)] z-30 bg-bg border-b border-border py-4 mb-6 -mx-8 px-8">
        <p className="text-sm text-text-secondary leading-snug mb-3">
          <strong>Exploratory analysis.</strong> Tests run on the current filtered sample only. The survey was not
          pre-registered or powered for confirmatory inference. Subgroup comparisons with small n should be treated as
          hypothesis generating. Within each enumerated family (<code>FAMILY_A_CORR</code>,{" "}
          <code>FAMILY_B_GROUP_DIFF</code>, <code>FAMILY_C_CHISQ</code>), raw <strong>p</strong> ranks into
          Benjamini–Hochberg <strong>q</strong> (skipped tests excluded from BH ordering).
        </p>
        <p className="text-xs text-text-muted">
          Filters: <code>{JSON.stringify(filters)}</code> · N<sub>filtered</sub>={filteredRespondents.length}{" "}
          respondents in matrix.
        </p>
      </div>
      <PageHeader
        hideCompare
        title="Inferential Tests"
        description="Parametric + non-parametric pairs across Families A–C (Welch/Kruskal omnibus where specified)."
      />
      <p className="text-[11px] text-text-muted mb-6 bg-card-alt border border-border rounded px-3 py-2">
        The <strong>Compare by</strong> control applies to descriptive dashboards only — each inferential contrast splits
        the sample by its own grouping variable or composite-derived field.
      </p>

      {hasInsuranceOutcome ? (
        <p className="text-[11px] text-text-secondary bg-sky-50 border border-sky-200 rounded px-3 py-2 mb-6 leading-snug">
          {INSURANCE_SATISFACTION_METHODS_NOTE}
        </p>
      ) : null}

      <section className="space-y-10">
        <FamilyBlock title="Family A · correlations" subtitle={SPEARMAN_METHODS_NOTE} results={famA} schema={schema} />
        <FamilyBlock title="Family B · group differences" subtitle={COHEN_D_CI_METHODS_NOTE} results={famB} schema={schema} />
        <FamilyBlock title="Family C · contingency tables" results={famC} schema={schema} />
      </section>

      <div className="mt-10 flex justify-end">
        <button
          type="button"
          onClick={() =>
            exportResultsCsv(results, `inferential-results-${new Date().toISOString().slice(0, 10)}`)
          }
          className="text-xs px-3 py-2 border rounded border-accent text-accent hover:bg-accent-light"
        >
          Export all results (CSV)
        </button>
      </div>
    </div>
  );
}

function FamilyBlock({
  title,
  subtitle,
  results,
  schema,
}: {
  title: string;
  subtitle?: string;
  results: TestResult[];
  schema: VariableDef[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">{title}</h2>
      {subtitle && (
        <p className="text-[11px] text-text-secondary bg-card-alt border border-border rounded px-3 py-2 mb-4">{subtitle}</p>
      )}
      <div className="grid gap-4">
        {results.map((r) => (
          <TestCard key={r.id} result={r} schema={schema} />
        ))}
      </div>
    </div>
  );
}

function TestCard({ result, schema }: { result: TestResult; schema: VariableDef[] }) {
  const varHints =
    [...refHintsFor(result.variables.outcome, schema), ...refHintsFor(result.variables.predictor, schema)].filter(
      Boolean
    );
  const allHints = [...varHints, ...result.warnings];

  const skippedBanner = result.skipped ? (
    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 mb-3">
      <strong>Test not run</strong> — {skippedLabel(result.skipped.reason)}.{" "}
      <span className="text-text-secondary">{result.skipped.detail}</span>
    </div>
  ) : null;

  return (
    <article className="border border-border rounded-lg p-4 bg-card shadow-sm">
      <header className="mb-3">
        <p className="text-[11px] text-text-muted font-mono">{result.id}</p>
        <h3 className="text-sm font-semibold">{result.question}</h3>
        <p className="text-[11px] text-text-muted">
          outcome: <strong>{result.variables.outcome}</strong> · predictor:{" "}
          <strong>{result.variables.predictor}</strong> · N={result.n}
        </p>
      </header>

      {skippedBanner}

      {result.groups && result.groups.length > 0 && (
        <table className="w-full text-[11px] border border-border rounded overflow-hidden mb-3">
          <thead className="bg-card-alt text-text-muted">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Group</th>
              <th className="text-right px-2 py-1 font-medium">n</th>
              <th className="text-right px-2 py-1 font-medium">Mean (SD)</th>
              <th className="text-right px-2 py-1 font-medium">Median</th>
            </tr>
          </thead>
          <tbody>
            {result.groups.map((g, idx) => (
              <tr key={`${result.id}-g-${idx}`} className="border-t border-border">
                <td className="px-2 py-1">{g.label}</td>
                <td className="text-right px-2 py-1 font-mono">{g.n}</td>
                <td className="text-right px-2 py-1 font-mono">
                  {fmtNum(g.mean)} ({fmtNum(g.sd)})
                </td>
                <td className="text-right px-2 py-1 font-mono">{fmtNum(g.median)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.contingency && (
        <ContingencyTable block={result.contingency} resultId={result.id} />
      )}

      {!result.skipped && (
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
          <div>
            <dt className="text-text-muted">Test</dt>
            <dd className="font-mono text-text-secondary">{result.testName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Statistic</dt>
            <dd className="font-mono">{fmtNum(result.statistic)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">df</dt>
            <dd className="font-mono">
              {fmtDf(result.df)}
              {typeof result.denomDf === "number" && Number.isFinite(result.denomDf) ? (
                <span title="Welch denominator df"> · denom {fmtDf(result.denomDf)}</span>
              ) : (
                ""
              )}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Raw p</dt>
            <dd className="font-mono">{fmtNum(result.p)}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-text-muted">FDR-adjusted q</dt>
            <dd className="font-mono text-accent font-semibold" title="Benjamini–Hochberg within this test family">
              {typeof result.qFDR === "number" && Number.isFinite(result.qFDR) ? result.qFDR.toFixed(4) : "—"}
            </dd>
          </div>
        </dl>
      )}

      {result.effectSize?.name && !result.skipped && (
        <p className="text-[11px] mt-2">
          Effect: {result.effectSize.name}={fmtNum(result.effectSize.value)}
          {Array.isArray(result.effectSize.ci95)
            ? ` [${fmtNum(result.effectSize.ci95[0])}, ${fmtNum(result.effectSize.ci95[1])}]`
            : ""}
        </p>
      )}

      {allHints.length > 0 && (
        <ul className="mt-3 text-[11px] text-amber-900 space-y-1 list-disc ml-5">
          {allHints.map((h, i) => (
            <li key={`${result.id}-warn-${i}`}>{h}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ContingencyTable({
  block,
  resultId,
}: {
  block: NonNullable<TestResult["contingency"]>;
  resultId: string;
}) {
  function cellDisplay(rIndex: number, cIndex: number): string {
    const hit = block.cells?.find((c: CellDisplay) => c.r === rIndex && c.c === cIndex);
    return hit?.text ?? String(block.counts[rIndex]?.[cIndex] ?? "");
  }

  return (
    <div className="overflow-x-auto mb-3">
      <table className="min-w-[360px] text-[11px] border border-border">
        <thead>
          <tr className="bg-card-alt">
            <th className="px-2 py-1 text-left border-b border-border" />
            {block.colLabels.map((lab, ci) => (
              <th key={`${resultId}-ch-${ci}`} className="px-2 py-1 text-left border-b border-l border-border">
                {lab}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rowLabels.map((rlab, ri) => (
            <tr key={`${resultId}-rr-${ri}`} className="border-t border-border align-top">
              <td className="px-2 py-1 font-medium bg-card-alt border-r border-border">{rlab}</td>
              {block.colLabels.map((_c, ci) => (
                <td key={`${resultId}-cid-${ri}-${ci}`} className="px-2 py-1 border-l border-border max-w-[180px]">
                  {cellDisplay(ri, ci)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtNum(v: number | undefined): string {
  if (v === undefined) return "";
  if (!Number.isFinite(v)) return "";
  return v.toFixed(4);
}

function fmtDf(v: number | undefined): string {
  if (v === undefined) return "";
  if (!Number.isFinite(v)) return "";
  return v.toFixed(4);
}

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvValueForResult(r: TestResult, key: string): unknown {
  if (key === "variables") return `${r.variables.outcome}~${r.variables.predictor}`;
  if (key === "skipped_reason") return r.skipped?.reason ?? "";
  if (key === "skipped_detail") return r.skipped?.detail ?? "";
  if (key === "denomDf") return typeof r.denomDf === "number" && Number.isFinite(r.denomDf) ? r.denomDf : "";
  if (key === "contingency_blob") return r.contingency ? JSON.stringify(r.contingency) : "";
  if (key === "statistic") {
    if (r.skipped) return "";
    if (typeof r.statistic !== "number" || !Number.isFinite(r.statistic)) return "";
    return r.statistic;
  }
  if (key === "p") {
    if (r.skipped) return "";
    if (typeof r.p !== "number" || !Number.isFinite(r.p)) return "";
    return r.p;
  }
  if (key === "qFDR") {
    if (r.skipped) return "";
    if (typeof r.qFDR !== "number" || !Number.isFinite(r.qFDR)) return "";
    return r.qFDR;
  }
  if (key === "df") {
    if (r.skipped) return "";
    if (typeof r.df !== "number" || !Number.isFinite(r.df)) return "";
    return r.df;
  }
  const val = (r as unknown as Record<string, unknown>)[key];
  if (Array.isArray(val) || (typeof val === "object" && val !== null)) return JSON.stringify(val);
  return val ?? "";
}

function exportResultsCsv(rows: TestResult[], basename: string) {
  const keys = [
    "id",
    "family",
    "question",
    "testName",
    "variables",
    "n",
    "groups",
    "skipped_reason",
    "skipped_detail",
    "statistic",
    "df",
    "denomDf",
    "p",
    "qFDR",
    "effectSize",
    "contingency_blob",
    "warnings",
  ] as const;

  const header = keys.map((k) => escapeCsvCell(String(k))).join(",");
  const lines = rows.map((r) =>
    keys
      .map((k) => {
        const val = csvValueForResult(r, k);
        return escapeCsvCell(val);
      })
      .join(",")
  );
  const blob = new Blob([[header, ...lines.map((l) => `${l}\n`)].join("\n")], { type: "text/csv;charset=utf-8" });
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = `${basename}.csv`;
  a.click();
  URL.revokeObjectURL(u);
}
