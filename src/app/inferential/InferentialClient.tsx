"use client";

import { useSurveyData } from "@/contexts/SurveyDataContext";
import { useFeatureBundle } from "@/contexts/FeatureContext";
import { adjustForFDR, runAllTests, type TestResult } from "@/lib/inferential";
import PageHeader from "@/components/dashboard/PageHeader";
import type { VariableDef } from "@/lib/featurize";

function refHintsFor(varName: string, schema: VariableDef[]): string[] {
  const d = schema.find((s) => s.name === varName);
  const w: string[] = [];
  const rd = d?.referenceDistribution;
  if (!rd) return w;
  if (Math.abs(rd.skewness) > 1 || Math.abs(rd.kurtosis) > 1) {
    w.push(
      `Distribution non-normal in full sample (skew=${rd.skewness.toFixed(2)}, excess kurtosis=${rd.kurtosis.toFixed(
        2
      )}); prefer non-parametric result where available.`
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

  return (
    <div>
      <div className="sticky top-[var(--header-height)] z-30 bg-bg border-b border-border py-4 mb-6 -mx-8 px-8">
        <p className="text-sm text-text-secondary leading-snug mb-3">
          <strong>Exploratory analysis.</strong> Tests run on the current filtered sample only. The survey was not
          pre-registered or powered for confirmatory inference. Subgroup comparisons with n &lt; 20 should be read as
          hypothesis-generating. <strong>q</strong> uses Benjamini–Hochberg FDR within each test family (A / B / C).
        </p>
        <p className="text-xs text-text-muted">
          Filters: <code>{JSON.stringify(filters)}</code> · N<sub>filtered</sub>={filteredRespondents.length}{" "}
          respondents in matrix.
        </p>
      </div>
      <PageHeader
        hideCompare
        title="Inferential Tests"
        description="Parametric + non-parametric pairs for Family A correlations; Families B/C are next."
      />
      <p className="text-[11px] text-text-muted mb-6 bg-card-alt border border-border rounded px-3 py-2">
        The <strong>Compare by</strong> control applies to descriptive dashboards only — each inferential contrast
        splits the sample by its own grouping variable.
      </p>
      <section className="space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">Family A · Correlations</h2>
          <div className="grid gap-4">
            {results.filter((r) => r.family.startsWith("A")).map((r) => (
              <TestCard key={r.id} result={r} schema={schema} />
            ))}
          </div>
        </div>
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

function TestCard({
  result,
  schema,
}: {
  result: TestResult;
  schema: VariableDef[];
}) {
  const varHints =
    [...refHintsFor(result.variables.outcome, schema), ...refHintsFor(result.variables.predictor, schema)].filter(
      Boolean
    );
  const allHints = [...varHints, ...result.warnings];
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
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <dt className="text-text-muted">{result.testName}</dt>
          <dd className="font-mono">
            statistic={fmt(result.statistic)} · p={fmt(result.p)}{" "}
            {typeof result.df === "number" ? `· df=${result.df}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">FDR-adjusted q</dt>
          <dd className="font-mono text-accent font-semibold">
            q={fmt(result.qFDR ?? result.p)} <span className="text-text-muted font-normal"> (raw p in pair)</span>
          </dd>
        </div>
      </dl>
      {result.effectSize?.name && (
        <p className="text-[11px] mt-2">
          Effect: {result.effectSize.name}={fmt(result.effectSize.value)}
          {Array.isArray(result.effectSize.ci95)
            ? ` [${fmt(result.effectSize.ci95[0])}, ${fmt(result.effectSize.ci95[1])}]`
            : ""}
        </p>
      )}
      {allHints.length > 0 && (
        <ul className="mt-3 text-[11px] text-amber-900 space-y-1 list-disc ml-5">
          {allHints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function fmt(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return v.toFixed(4);
  return String(v);
}

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportResultsCsv(rows: TestResult[], basename: string) {
  const keys: (keyof TestResult | "qFDR_rawp")[] = [
    "id",
    "family",
    "question",
    "testName",
    "variables",
    "n",
    "groups",
    "statistic",
    "df",
    "p",
    "qFDR",
    "effectSize",
    "warnings",
  ];
  const header = keys.map((k) => escapeCsvCell(String(k))).join(",");
  const lines = rows.map((r) =>
    keys
      .map((k) => {
        let val: unknown;
        if (k === "variables") val = `${r.variables.outcome}~${r.variables.predictor}`;
        else if (k === "qFDR_rawp") val = `${r.qFDR ?? ""}/${r.p}`;
        else val = r[k as keyof TestResult];
        if (Array.isArray(val) || typeof val === "object") return escapeCsvCell(JSON.stringify(val));
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
