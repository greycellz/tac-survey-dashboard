"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ResponseEntry } from "@/components/responses/RawResponseList";

interface LinkedResponseDrawerProps {
  label?: string;
  entries: ResponseEntry[];
}

export default function LinkedResponseDrawer({
  label = "View matching responses",
  entries,
}: LinkedResponseDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-text-secondary hover:bg-accent-light/50 transition-colors"
      >
        <span>
          {label}{" "}
          <span className="font-mono text-text-muted">({entries.length})</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-border bg-card px-5 py-4 max-h-72 overflow-y-auto space-y-2">
          {entries.slice(0, 20).map((entry) => (
            <div
              key={entry.id}
              className="text-xs border-b border-border pb-2 last:border-0"
            >
              <span className="font-mono text-text-muted">{entry.id}</span>
              <p className="text-text-secondary mt-0.5 leading-relaxed">{entry.text}</p>
            </div>
          ))}
          {entries.length > 20 && (
            <p className="text-xs text-text-muted italic pt-1">
              + {entries.length - 20} more — go to Open Responses for full browser
            </p>
          )}
        </div>
      )}
    </div>
  );
}
