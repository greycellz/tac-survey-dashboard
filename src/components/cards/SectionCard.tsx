import { cn } from "@/lib/utils";
import type { QuestionType } from "@/types/survey";

const TYPE_LABELS: Record<QuestionType, string> = {
  numeric: "Numeric",
  "single-select": "Categorical",
  "multi-select": "Multi-select",
  likert: "Likert",
  "open-text": "Open text",
};

interface SectionCardProps {
  title: string;
  type?: QuestionType;
  validN?: number;
  missingN?: number;
  conditionalNote?: string;
  children: React.ReactNode;
  className?: string;
  /** Spans full width if true */
  wide?: boolean;
}

export default function SectionCard({
  title,
  type,
  validN,
  missingN,
  conditionalNote,
  children,
  className,
  wide,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg overflow-hidden",
        wide ? "col-span-2" : "",
        className
      )}
    >
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-text-primary leading-snug flex-1">
            {title}
          </h3>

          <div className="flex items-center gap-2 shrink-0">
            {type && (
              <span className="type-badge">{TYPE_LABELS[type]}</span>
            )}
          </div>
        </div>

        {/* N and missing */}
        {(validN !== undefined || conditionalNote) && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted font-mono">
            {validN !== undefined && (
              <span>Valid N: <span className="text-text-secondary font-medium">{validN}</span></span>
            )}
            {missingN !== undefined && missingN > 0 && (
              <span>Missing: <span className="text-text-secondary">{missingN}</span></span>
            )}
            {conditionalNote && (
              <span className="text-amber-600 font-sans">⚠ {conditionalNote}</span>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}
