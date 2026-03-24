import type { CategoricalRow } from "@/types/survey";

interface BreakdownTableProps {
  rows: CategoricalRow[];
  showPct?: boolean;
  showN?: boolean;
  caption?: string;
}

export default function BreakdownTable({
  rows,
  showPct = true,
  showN = true,
  caption,
}: BreakdownTableProps) {
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-card-alt border-b border-border">
            <th className="text-left px-3 py-2 font-medium text-text-muted">Response</th>
            {showN && <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">n</th>}
            {showPct && <th className="text-right px-3 py-2 font-medium text-text-muted font-mono">%</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border last:border-0 hover:bg-accent-light/50 transition-colors"
            >
              <td className="px-3 py-2 text-text-secondary">{row.label}</td>
              {showN && (
                <td className="px-3 py-2 text-right font-mono text-text-muted">
                  {row.n}
                </td>
              )}
              {showPct && (
                <td className="px-3 py-2 text-right font-mono text-text-muted">
                  {row.pct.toFixed(1)}%
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && (
        <p className="px-3 py-1.5 text-[10px] text-text-disabled border-t border-border bg-card-alt">
          {caption}
        </p>
      )}
    </div>
  );
}
