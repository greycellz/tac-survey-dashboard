"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  CategoricalRow,
  CategoricalResult,
  MultiSelectResult,
  LikertResult,
  NumericResult,
  CompareChartId,
} from "@/types/survey";
import type { ComputedData } from "@/lib/compute";
import { useSurveyData } from "@/contexts/SurveyDataContext";
import { shouldSuppressCompareForChart } from "@/lib/compare";
import BreakdownTable from "@/components/tables/BreakdownTable";

// ─── Compare subgroup colors (stable slotIndex → CSS var) ─────────────────────

const COMPARE_FILLS = [
  "var(--compare-1)",
  "var(--compare-2)",
  "var(--compare-3)",
  "var(--compare-4)",
  "var(--compare-5)",
  "var(--compare-6)",
  "var(--compare-7)",
  "var(--compare-8)",
];

function compareFill(slotIndex: number): string {
  return COMPARE_FILLS[Math.min(Math.max(0, slotIndex), COMPARE_FILLS.length - 1)]!;
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

interface HorizontalBarProps {
  data: Array<{ label: string; n: number; pct: number }>;
  /** Scale denominator so bar width = (row.pct / denominator) × 100% of track. Default 100 matches “% of respondents” from compute. */
  maxPct?: number;
}

export function HorizontalBarChart({ data, maxPct }: HorizontalBarProps) {
  const denominator = maxPct != null && maxPct > 0 ? maxPct : 100;

  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => {
        const widthPct = Math.min(100, Math.max(0, (row.pct / denominator) * 100));
        return (
          <div key={row.label} className="flex flex-col gap-1.5 min-h-0">
            <div className="flex items-start justify-between gap-3 shrink-0">
              <span
                className="text-xs text-text-secondary leading-normal flex-1 min-w-0 break-words"
                title={row.label}
              >
                {row.label}
              </span>
              <span className="text-xs font-mono text-text-muted tabular-nums shrink-0 pt-px">
                {row.n} ({row.pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-5 bg-accent-light rounded-sm overflow-hidden shrink-0 relative z-0">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: "var(--bar-fill)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compare horizontal (stacked sub-rows per outcome) ────────────────────────

export interface CompareBarSlice {
  label: string;
  n: number;
  slotIndex: number;
  rows: CategoricalRow[];
}

export function CompareHorizontalBarChart({
  pooledRows,
  slices,
  maxPct,
}: {
  pooledRows: CategoricalRow[];
  slices: CompareBarSlice[];
  maxPct?: number;
}) {
  const denominator = maxPct != null && maxPct > 0 ? maxPct : 100;

  return (
    <div className="flex flex-col gap-4">
      {pooledRows.map((pr) => (
        <div key={pr.label}>
          <p className="text-xs font-medium text-text-secondary shrink-0">{pr.label}</p>
          <div className="mt-1.5 flex flex-col gap-1.5 pl-2 border-l-2 border-border">
            {slices.map((slice) => {
              const row = slice.rows.find((x) => x.label === pr.label);
              const n = row?.n ?? 0;
              const pct = row?.pct ?? 0;
              const widthPct = Math.min(100, Math.max(0, (pct / denominator) * 100));
              const fill = compareFill(slice.slotIndex);
              return (
                <div key={slice.label} className="flex flex-col gap-1 min-h-0">
                  <div className="flex items-start justify-between gap-2 shrink-0">
                    <span
                      className="text-[11px] text-text-secondary pl-1 border-l-[3px] flex-1 min-w-0 break-words"
                      style={{ borderColor: fill }}
                    >
                      {slice.label}
                      <span className="text-text-muted font-normal"> (N={slice.n})</span>
                    </span>
                    <span className="text-[11px] font-mono text-text-muted tabular-nums shrink-0 pt-px">
                      {n} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-4 bg-accent-light rounded-sm overflow-hidden shrink-0 relative z-0">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wired chart + optional pooled breakdown table; handles compare, suppress, and multi-select maxPct. */
export function CategoricalCompareBody({
  chartId,
  pooled,
  pick,
  showBreakdownTable = true,
}: {
  chartId: CompareChartId | null;
  pooled: CategoricalResult | MultiSelectResult;
  pick: (d: ComputedData) => CategoricalResult | MultiSelectResult;
  showBreakdownTable?: boolean;
}) {
  const { compareBy, compareSubgroups, computedBySubgroup } = useSurveyData();
  const isMulti = pooled.type === "multi-select";
  const maxPct = isMulti ? 100 : undefined;

  const showCompare =
    compareBy !== "none" && computedBySubgroup !== null && computedBySubgroup.length > 0 && compareSubgroups.length > 0;
  const suppressed = showCompare && shouldSuppressCompareForChart(compareBy, chartId);

  let chart: ReactNode;
  if (!showCompare) {
    chart = <HorizontalBarChart data={pooled.rows} maxPct={maxPct} />;
  } else if (suppressed) {
    chart = (
      <>
        <p className="text-xs text-text-muted mb-2">
          Subgroup breakdown not shown — same dimension as compare.
        </p>
        <HorizontalBarChart data={pooled.rows} maxPct={maxPct} />
      </>
    );
  } else {
    const slices: CompareBarSlice[] = compareSubgroups.map((sg, i) => ({
      label: sg.label,
      n: sg.n,
      slotIndex: sg.slotIndex,
      rows: pick(computedBySubgroup![i]!).rows,
    }));
    chart = <CompareHorizontalBarChart pooledRows={pooled.rows} slices={slices} maxPct={maxPct} />;
  }

  const canTable = showBreakdownTable && pooled.type === "single-select" && !isMulti;

  return (
    <>
      {chart}
      {canTable && (!showCompare || suppressed) && (
        <div className="mt-3">
          <BreakdownTable rows={pooled.rows} />
        </div>
      )}
      {canTable && showCompare && !suppressed && (
        <p className="text-xs text-text-muted mt-3 italic">
          Subgroup bars above; pooled frequency table omitted in compare mode.
        </p>
      )}
    </>
  );
}

// ─── Likert Chart (stacked horizontal bar + table) ────────────────────────────

const LIKERT_COLORS = [
  "var(--likert-1)",
  "var(--likert-2)",
  "var(--likert-3)",
  "var(--likert-4)",
  "var(--likert-5)",
];

interface LikertChartProps {
  result: LikertResult;
}

export function LikertChart({ result }: LikertChartProps) {
  const total = result.counts.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
        <span>Mean: <span className="text-text-primary font-semibold">{result.mean.toFixed(1)}</span></span>
        <span>SD: <span className="text-text-primary">{result.sd.toFixed(1)}</span></span>
        <span>Range: <span className="text-text-primary">{result.min}–{result.max}</span></span>
      </div>

      <div className="h-7 flex rounded-sm overflow-hidden">
        {result.counts.map((count, i) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div
              key={i}
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: LIKERT_COLORS[i] }}
              title={`${result.labels[i]}: ${count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {result.labels.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: LIKERT_COLORS[i] }}
            />
            <span className="text-[11px] text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-card-alt border-b border-border">
              <th className="text-left px-3 py-1.5 font-medium text-text-muted">Category</th>
              <th className="text-right px-3 py-1.5 font-medium text-text-muted font-mono">n</th>
              <th className="text-right px-3 py-1.5 font-medium text-text-muted font-mono">%</th>
            </tr>
          </thead>
          <tbody>
            {result.labels.map((label, i) => {
              const pctRow = total > 0 ? (result.counts[i] / total) * 100 : 0;
              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 text-text-secondary">{label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{result.counts[i]}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{pctRow.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LikertStackedBar({ result }: { result: LikertResult }) {
  const total = result.counts.reduce((a, b) => a + b, 0);
  return (
    <div className="h-7 flex rounded-sm overflow-hidden">
      {result.counts.map((count, i) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div
            key={i}
            className="h-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: LIKERT_COLORS[i] }}
            title={`${result.labels[i]}: ${count} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

export function LikertCompareChart({
  slices,
}: {
  slices: Array<{ label: string; n: number; slotIndex: number; result: LikertResult }>;
}) {
  const [open, setOpen] = useState(0);

  return (
    <div className="space-y-4">
      {slices.map((slice, idx) => (
        <div
          key={slice.label}
          className="rounded border border-border overflow-hidden"
          style={{ borderLeftWidth: 3, borderLeftColor: compareFill(slice.slotIndex) }}
        >
          <button
            type="button"
            onClick={() => setOpen(idx === open ? -1 : idx)}
            className="w-full text-left px-3 py-2 bg-card-alt hover:bg-accent-light/40 transition-colors flex items-center justify-between gap-2"
          >
            <span className="text-xs font-medium text-text-secondary">
              {slice.label} <span className="text-text-muted font-normal">(N={slice.n})</span>
            </span>
            <span className="text-xs font-mono text-text-muted">
              M {slice.result.mean.toFixed(1)} · SD {slice.result.sd.toFixed(1)}
            </span>
          </button>
          <div className="px-3 py-3 space-y-2 bg-card">
            <LikertStackedBar result={slice.result} />
            {open === idx && (
              <div className="mt-3 border border-border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-card-alt border-b border-border">
                      <th className="text-left px-3 py-1.5 font-medium text-text-muted">Category</th>
                      <th className="text-right px-3 py-1.5 font-medium text-text-muted font-mono">n</th>
                      <th className="text-right px-3 py-1.5 font-medium text-text-muted font-mono">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.result.labels.map((label, i) => {
                      const t = slice.result.counts.reduce((a, b) => a + b, 0);
                      const pctRow = t > 0 ? (slice.result.counts[i] / t) * 100 : 0;
                      return (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5 text-text-secondary">{label}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-text-muted">{slice.result.counts[i]}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-text-muted">{pctRow.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-text-muted">Click a subgroup header to expand its category table.</p>
    </div>
  );
}

export function LikertCompareBody({ pick }: { pick: (d: ComputedData) => LikertResult }) {
  const { compareBy, compareSubgroups, computedBySubgroup, computedData } = useSurveyData();
  const pooled = pick(computedData);

  const showCompare =
    compareBy !== "none" && computedBySubgroup !== null && computedBySubgroup.length > 0 && compareSubgroups.length > 0;

  if (!showCompare) {
    return <LikertChart result={pooled} />;
  }

  const slices = compareSubgroups.map((sg, i) => ({
    label: sg.label,
    n: sg.n,
    slotIndex: sg.slotIndex,
    result: pick(computedBySubgroup![i]!),
  }));

  return <LikertCompareChart slices={slices} />;
}

// ─── Histogram ────────────────────────────────────────────────────────────────

const HISTOGRAM_BAR_MAX_PX = 88;

interface HistogramProps {
  result: NumericResult;
}

export function HistogramChart({ result }: HistogramProps) {
  const maxCount = Math.max(0, ...result.histogram.map((b) => b.count));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
        <span>Mean: <span className="text-text-primary font-semibold">{result.mean.toFixed(1)}</span></span>
        <span>SD: <span className="text-text-primary">{result.sd.toFixed(1)}</span></span>
        <span>Range: <span className="text-text-primary">{result.min}–{result.max}</span></span>
      </div>

      <div className="flex items-end gap-1" style={{ height: `${HISTOGRAM_BAR_MAX_PX + 20}px` }}>
        {result.histogram.map((bin) => {
          const barHeightPx = maxCount > 0
            ? Math.max(Math.round((bin.count / maxCount) * HISTOGRAM_BAR_MAX_PX), bin.count > 0 ? 4 : 0)
            : 0;
          return (
            <div
              key={bin.label}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              style={{ height: `${HISTOGRAM_BAR_MAX_PX + 20}px` }}
            >
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${barHeightPx}px`,
                  backgroundColor: "var(--bar-fill)",
                }}
                title={`${bin.label}: ${bin.count}`}
              />
              <span className="text-[10px] text-text-muted font-mono leading-none">{bin.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistogramMini({ result, maxCount }: { result: NumericResult; maxCount: number }) {
  return (
    <div className="flex items-end gap-0.5 flex-1 min-w-0" style={{ height: `${HISTOGRAM_BAR_MAX_PX + 20}px` }}>
      {result.histogram.map((bin) => {
        const barHeightPx = maxCount > 0
          ? Math.max(Math.round((bin.count / maxCount) * HISTOGRAM_BAR_MAX_PX), bin.count > 0 ? 3 : 0)
          : 0;
        return (
          <div
            key={bin.label}
            className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-0"
            style={{ height: `${HISTOGRAM_BAR_MAX_PX + 20}px` }}
          >
            <div
              className="w-full rounded-t-sm max-w-[20px] mx-auto"
              style={{
                height: `${barHeightPx}px`,
                backgroundColor: "var(--bar-fill)",
              }}
              title={`${bin.label}: ${bin.count}`}
            />
            <span className="text-[9px] text-text-muted font-mono leading-none truncate w-full text-center">{bin.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HistogramCompareBody({ pick }: { pick: (d: ComputedData) => NumericResult }) {
  const { compareBy, compareSubgroups, computedBySubgroup, computedData } = useSurveyData();
  const pooled = pick(computedData);

  const showCompare =
    compareBy !== "none" && computedBySubgroup !== null && computedBySubgroup.length > 0 && compareSubgroups.length > 0;

  if (!showCompare) {
    return <HistogramChart result={pooled} />;
  }

  const slices = compareSubgroups.map((sg, i) => ({
    label: sg.label,
    n: sg.n,
    slotIndex: sg.slotIndex,
    result: pick(computedBySubgroup![i]!),
  }));

  const maxCount = Math.max(
    0,
    ...slices.flatMap((s) => s.result.histogram.map((b) => b.count))
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs font-mono text-text-muted">
        {slices.map((s) => (
          <span key={s.label} style={{ borderLeft: `3px solid ${compareFill(s.slotIndex)}`, paddingLeft: 8 }}>
            {s.label}: μ {s.result.mean.toFixed(1)}
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-stretch">
        {slices.map((s) => (
          <div key={s.label} className="flex-1 min-w-0 flex flex-col">
            <p className="text-[10px] text-text-muted mb-1 truncate text-center" title={s.label}>
              {s.label} (N={s.n})
            </p>
            <HistogramMini result={s.result} maxCount={maxCount} />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-text-muted">Shared vertical scale (max count = {maxCount}) across subgroups.</p>
    </div>
  );
}

// ─── Generic placeholder ─────────────────────────────────────────────────────

interface ChartPlaceholderProps {
  label?: string;
  height?: number;
  className?: string;
}

export default function ChartPlaceholder({ label = "Chart placeholder", height = 120, className }: ChartPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded border border-dashed border-border-strong bg-card-alt",
        className
      )}
      style={{ height }}
    >
      <span className="text-xs text-text-disabled">{label}</span>
    </div>
  );
}
