import { cn } from "@/lib/utils";
import type { KPIValue } from "@/types/survey";

interface StatCardProps {
  kpi: KPIValue;
  className?: string;
}

export default function StatCard({ kpi, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg px-5 py-4",
        className
      )}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide leading-none">
        {kpi.label}
      </p>
      <p className="text-2xl font-semibold text-text-primary mt-2 leading-none font-mono">
        {kpi.value}
      </p>
      {kpi.subtext && (
        <p className="text-xs text-text-muted mt-1.5 leading-snug">{kpi.subtext}</p>
      )}
    </div>
  );
}
