"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COMPARE_OPTIONS } from "@/types/survey";

export default function CompareBar() {
  const [value, setValue] = useState("none");
  const [open, setOpen] = useState(false);

  const selected = COMPARE_OPTIONS.find((o) => o.value === value);

  return (
    <div className="relative flex items-center gap-2">
      <span className="text-xs text-text-muted">Compare by:</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded text-text-secondary hover:border-border-strong transition-colors"
      >
        {selected?.label ?? "None"}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-16 top-full mt-1 w-44 bg-card border border-border rounded-md shadow-md z-50 py-1">
            {COMPARE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setValue(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  value === opt.value
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
  );
}
