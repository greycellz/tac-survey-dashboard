"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import { useFeatureBundle } from "@/contexts/FeatureContext";
import type { FeatureValue, VariableDef } from "@/lib/featurize";
import { useSurveyData } from "@/contexts/SurveyDataContext";

function escapeCsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadMatrixCsv(
  rows: Record<string, string | number>[],
  columnOrder: string[],
  filenamePrefix = "tac-survey-matrix"
) {
  const date = new Date().toISOString().slice(0, 10);
  const headers = columnOrder.map(escapeCsvCell).join(",");
  const lines = rows.map((row) =>
    columnOrder.map((c) => escapeCsvCell(row[c] ?? "")).join(",")
  );
  const csvBody = `${headers}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
  const blob = new Blob([csvBody], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCodebookCsv(defs: VariableDef[]) {
  const date = new Date().toISOString().slice(0, 10);
  const headers = ["name", "label", "type", "derivation"];
  const line0 = headers.map(escapeCsvCell).join(",");
  const rows = defs.map((d) =>
    [d.name, d.label, d.type, d.derivation].map(escapeCsvCell).join(",")
  );
  const csvBody = `${line0}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
  const blob = new Blob([csvBody], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tac-survey-codebook-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DistCells({ def }: { def: VariableDef }) {
  const rd = def.referenceDistribution;
  if (!rd) {
    return (
      <>
        {["—", "—", "—", "—", "—", "—"].map((x, i) => (
          <td key={i} className="px-2 py-1 font-mono text-text-muted text-right">
            {x}
          </td>
        ))}
      </>
    );
  }
  const skewHi = Math.abs(rd.skewness) > 1;
  const kurHi = Math.abs(rd.kurtosis) > 1;
  return (
    <>
      <td className="px-2 py-1 font-mono text-right">{rd.mean.toFixed(4)}</td>
      <td className="px-2 py-1 font-mono text-right">{rd.sd.toFixed(4)}</td>
      <td className={`px-2 py-1 font-mono text-right ${skewHi ? "bg-amber-100/70" : ""}`}>
        {rd.skewness.toFixed(4)}
      </td>
      <td className={`px-2 py-1 font-mono text-right ${kurHi ? "bg-amber-100/70" : ""}`}>
        {rd.kurtosis.toFixed(4)}
      </td>
      <td className="px-2 py-1 font-mono text-right">{rd.outliersAbove2SD}</td>
      <td className="px-2 py-1 font-mono text-right">{rd.n}</td>
    </>
  );
}

export default function CodebookClient() {
  const { filters, filteredRespondents, allRespondents } = useSurveyData();
  const { bundle } = useFeatureBundle();
  const { schema, matrix, observedMultiSelectOptions, warnings } = bundle;
  const columnOrder = schema.map((s) => s.name);

  function handleExportMatrix() {
    const rows = matrix.map((row) => {
      const o: Record<string, string | number> = {};
      for (const c of columnOrder) {
        const v = row[c] as FeatureValue;
        if (v === null || v === undefined) o[c] = "";
        else o[c] = v;
      }
      return o;
    });
    downloadMatrixCsv(rows, columnOrder);
  }

  const previewCols = columnOrder.slice(0, Math.min(columnOrder.length, 10));

  return (
    <div>
      <PageHeader
        title="Codebook & Prepared Matrix"
        description="Variable definitions use full-sample reference distributions; rows below follow current filters."
      />
      <p className="text-xs text-text-muted mb-4">
        Filters: <code>{JSON.stringify(filters)}</code> · N<sub>filtered</sub>={filteredRespondents.length} · full N=
        {allRespondents.length}
      </p>
      {warnings.length > 0 && (
        <ul className="mb-4 text-xs text-amber-800 list-disc ml-6">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 mb-8">
        <button
          type="button"
          onClick={() => downloadCodebookCsv(schema)}
          className="text-xs px-3 py-1.5 border rounded border-border"
        >
          Export codebook (CSV)
        </button>
        <button type="button" onClick={handleExportMatrix} className="text-xs px-3 py-1.5 border rounded bg-accent-light">
          Export prepared matrix (CSV)
        </button>
      </div>
      <h2 className="text-sm font-semibold mb-2">Variables</h2>
      <div className="border rounded overflow-auto max-h-[420px]">
        <table className="text-[11px] w-full">
          <thead className="bg-card-alt sticky top-0">
            <tr className="text-text-muted">
              <th className="text-left px-2 py-1">Variable</th>
              <th className="text-left px-2 py-1">Label</th>
              <th className="text-left px-2 py-1">Type</th>
              <th className="text-left px-2 py-1">Derivation</th>
              <th className="text-right px-2 py-1">Mean</th>
              <th className="text-right px-2 py-1">SD</th>
              <th className="text-right px-2 py-1">Skew</th>
              <th className="text-right px-2 py-1">Kurt</th>
              <th className="text-right px-2 py-1">|z|&gt;2SD</th>
              <th className="text-right px-2 py-1">n</th>
            </tr>
          </thead>
          <tbody>
            {schema.map((d) => (
              <tr key={d.name} className="border-t border-border">
                <td className="px-2 py-0.5 font-mono">{d.name}</td>
                <td className="px-2 py-0.5">{d.label}</td>
                <td className="px-2 py-0.5">{d.type}</td>
                <td className="px-2 py-0.5 max-w-md">{d.derivation}</td>
                <DistCells def={d} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-sm font-semibold mt-8 mb-2">Multi-select vocabulary</h2>
      <pre className="text-[11px] border rounded p-2 overflow-auto max-h-48 bg-card-alt">
        {JSON.stringify(observedMultiSelectOptions, null, 2)}
      </pre>
      <h2 className="text-sm font-semibold mt-8 mb-2">Matrix preview (≤10 cols, 10 rows)</h2>
      <div className="border rounded overflow-auto text-[10px]">
        <table>
          <thead>
            <tr>
              {previewCols.map((c) => (
                <th key={c} className="px-1 font-mono text-left border-b sticky top-0 bg-card-alt">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.slice(0, 10).map((row, i) => (
              <tr key={i}>
                {previewCols.map((c) => {
                  const v = row[c];
                  return (
                    <td key={c} className="px-1 font-mono border-t">
                      {v === null ? "—" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
