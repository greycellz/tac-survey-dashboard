"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { useSurveyData } from "@/contexts/SurveyDataContext";
import { COMPARE_OPTIONS } from "@/types/survey";
import type { CategoricalResult, LikertResult, MultiSelectResult } from "@/types/survey";
import { Download } from "lucide-react";

type TabKey = "descriptives" | "likert" | "categorical" | "multiselect";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "descriptives", label: "Descriptives" },
  { key: "likert", label: "Likert Tables" },
  { key: "categorical", label: "Categorical Tables" },
  { key: "multiselect", label: "Multi-select Tables" },
];

export default function TablesPage() {
  const [tab, setTab] = useState<TabKey>("descriptives");
  const { computedData, compareBy } = useSurveyData();
  const { ageResult, likertData, categoricalData, multiSelectData } = computedData;

  return (
    <div>
      <PageHeader
        title="Tables & Export"
        description="Structured outputs for writeup, appendix tables, and slide prep"
      />

      {compareBy !== "none" && (
        <div className="mb-4 rounded-md border border-border bg-card-alt px-4 py-2.5 text-xs text-text-secondary">
          Compare is on ({COMPARE_OPTIONS.find((o) => o.value === compareBy)?.label ?? compareBy}): these tables reflect the{" "}
          <strong className="text-text-primary">pooled filtered sample</strong> only, not separate subgroups. Use section charts for subgroup
          breakdowns.
        </div>
      )}

      <div className="flex border-b border-border mb-5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        {tab === "descriptives" && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-card-alt border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium text-text-muted">Question</th>
                  <th className="text-left px-3 py-2.5 font-medium text-text-muted">Type</th>
                  <th className="text-right px-3 py-2.5 font-medium text-text-muted font-mono">Valid N</th>
                  <th className="text-right px-3 py-2.5 font-medium text-text-muted font-mono">Missing</th>
                  <th className="text-right px-3 py-2.5 font-medium text-text-muted font-mono">Mean</th>
                  <th className="text-right px-3 py-2.5 font-medium text-text-muted font-mono">SD</th>
                  <th className="text-right px-3 py-2.5 font-medium text-text-muted font-mono">Range</th>
                </tr>
              </thead>
              <tbody>
                {/* Age — numeric */}
                <tr className="border-b border-border hover:bg-accent-light/30">
                  <td className="px-4 py-2 text-text-secondary">{ageResult.question}</td>
                  <td className="px-3 py-2"><span className="type-badge">Numeric</span></td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{ageResult.validN}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{ageResult.missingN}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{ageResult.mean.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{ageResult.sd.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-muted">{ageResult.min}–{ageResult.max}</td>
                </tr>
                {/* Likert rows */}
                {likertData.map((r) => (
                  <tr key={r.question} className="border-b border-border hover:bg-accent-light/30">
                    <td className="px-4 py-2 text-text-secondary max-w-xs truncate" title={r.question}>{r.question}</td>
                    <td className="px-3 py-2"><span className="type-badge">Likert</span></td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{r.validN}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{r.missingN}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{r.mean.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{r.sd.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-text-muted">{r.min}–{r.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "likert" && <LikertTabContent data={likertData} />}
        {tab === "categorical" && <CategoricalTabContent data={categoricalData} />}
        {tab === "multiselect" && <MultiSelectTabContent data={multiSelectData} />}
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors">
          <Download className="w-3 h-3" /> Export CSV
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors">
          <Download className="w-3 h-3" /> Export APA table
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LikertTabContent({ data }: { data: LikertResult[] }) {
  return (
    <div className="space-y-6">
      {data.map((r) => {
        const total = r.counts.reduce((a, b) => a + b, 0);
        return (
          <div key={r.question} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-card-alt px-4 py-2.5 border-b border-border flex items-center justify-between gap-4">
              <p className="text-xs font-medium text-text-secondary truncate" title={r.question}>{r.question}</p>
              <span className="text-xs font-mono text-text-muted shrink-0">N={r.validN}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-text-muted">Category</th>
                  <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">n</th>
                  <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">%</th>
                </tr>
              </thead>
              <tbody>
                {r.labels.map((label, i) => {
                  const pct = total > 0 ? (r.counts[i] / total) * 100 : 0;
                  return (
                    <tr key={label} className="border-b border-border last:border-0">
                      <td className="px-4 py-1.5 text-text-secondary">{label}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-muted">{r.counts[i]}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-muted">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-card-alt border-t border-border">
                  <td className="px-4 py-1.5 text-text-muted font-medium">Mean (SD)</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted" colSpan={2}>{r.mean.toFixed(2)} ({r.sd.toFixed(2)})</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function CategoricalTabContent({ data }: { data: CategoricalResult[] }) {
  return (
    <div className="space-y-6">
      {data.map((r) => (
        <div key={r.question} className="border border-border rounded-lg overflow-hidden">
          <div className="bg-card-alt px-4 py-2.5 border-b border-border flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-text-secondary truncate" title={r.question}>{r.question}</p>
            <span className="text-xs font-mono text-text-muted shrink-0">N={r.validN}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-text-muted">Response</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">n</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">%</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-1.5 text-text-secondary">{row.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{row.n}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function MultiSelectTabContent({ data }: { data: MultiSelectResult[] }) {
  return (
    <div className="space-y-6">
      {data.map((r) => (
        <div key={r.question} className="border border-border rounded-lg overflow-hidden">
          <div className="bg-card-alt px-4 py-2.5 border-b border-border flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-text-secondary truncate" title={r.question}>{r.question}</p>
            <span className="text-xs font-mono text-text-muted shrink-0">N={r.totalRespondents}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-text-muted">Option</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">n</th>
                <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">% of N</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-1.5 text-text-secondary">{row.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{row.n}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
