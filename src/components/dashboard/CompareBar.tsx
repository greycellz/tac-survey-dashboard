"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COMPARE_OPTIONS } from "@/types/survey";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function CompareBar() {
  const { compareBy, setCompareBy, compareSubgroups, compareNonInformative } = useSurveyData();
  const [open, setOpen] = useState(false);

  const selected = COMPARE_OPTIONS.find((o) => o.value === compareBy);

  const subgroupSummary =
    compareBy !== "none" && compareSubgroups.length > 0
      ? compareSubgroups.map((s) => `${s.label} ${s.n}`).join(" · ")
      : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative flex items-center gap-2">
        <span className="text-xs text-text-muted">Compare by:</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded text-text-secondary hover:border-border-strong transition-colors"
        >
          {selected?.label ?? "None"}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-md shadow-md z-50 py-1">
              {COMPARE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCompareBy(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    compareBy === opt.value
                      ? "bg-accent-light text-accent font-medium"
                      : "text-text-secondary hover:bg-accent-light hover:text-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {compareBy !== "none" && subgroupSummary && (
        <p className="text-[11px] text-text-muted text-right max-w-[280px] leading-snug">
          {subgroupSummary}
        </p>
      )}
      {compareNonInformative && (
        <p className="text-[11px] text-text-secondary italic text-right max-w-[280px] leading-snug">
          Filters leave only one subgroup on this dimension — compare is uninformative.
        </p>
      )}
    </div>
  );
}
