import { cn } from "@/lib/utils";
import type { LikertResult, NumericResult } from "@/types/survey";

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

interface HorizontalBarProps {
  data: Array<{ label: string; n: number; pct: number }>;
  /** Scale denominator so bar width = (row.pct / denominator) × 100% of track. Default 100 matches “% of respondents” from compute. */
  maxPct?: number;
}

export function HorizontalBarChart({ data, maxPct }: HorizontalBarProps) {
  const denominator = maxPct != null && maxPct > 0 ? maxPct : 100;

  return (
    <div className="space-y-2">
      {data.map((row) => {
        const widthPct = Math.min(100, Math.max(0, (row.pct / denominator) * 100));
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary leading-tight max-w-[60%] truncate" title={row.label}>
                {row.label}
              </span>
              <span className="text-xs font-mono text-text-muted tabular-nums">
                {row.n} ({row.pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-5 bg-accent-light rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
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
      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
        <span>Mean: <span className="text-text-primary font-semibold">{result.mean.toFixed(1)}</span></span>
        <span>SD: <span className="text-text-primary">{result.sd.toFixed(1)}</span></span>
        <span>Range: <span className="text-text-primary">{result.min}–{result.max}</span></span>
      </div>

      {/* Stacked bar */}
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

      {/* Legend */}
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

      {/* Breakdown table */}
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
              const pct = total > 0 ? (result.counts[i] / total) * 100 : 0;
              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 text-text-secondary">{label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{result.counts[i]}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-muted">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Histogram ────────────────────────────────────────────────────────────────

interface HistogramProps {
  result: NumericResult;
}

const HISTOGRAM_BAR_MAX_PX = 88; // pixel height of bar area (label row is separate)

export function HistogramChart({ result }: HistogramProps) {
  const maxCount = Math.max(...result.histogram.map((b) => b.count));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
        <span>Mean: <span className="text-text-primary font-semibold">{result.mean.toFixed(1)}</span></span>
        <span>SD: <span className="text-text-primary">{result.sd.toFixed(1)}</span></span>
        <span>Range: <span className="text-text-primary">{result.min}–{result.max}</span></span>
      </div>

      {/* Bar area: fixed pixel height avoids the flex-%-height collapse bug */}
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

// ─── Generic placeholder (for future charts) ─────────────────────────────────

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
