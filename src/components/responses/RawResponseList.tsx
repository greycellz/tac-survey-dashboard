"use client";

import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";

export interface ResponseEntry {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

interface RawResponseListProps {
  question: string;
  entries: ResponseEntry[];
  selectedId?: string;
  onSelect?: (entry: ResponseEntry) => void;
  compact?: boolean;
}

export default function RawResponseList({
  question,
  entries,
  selectedId,
  onSelect,
  compact = false,
}: RawResponseListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"default" | "length-asc" | "length-desc">("default");
  const [sortOpen, setSortOpen] = useState(false);

  const filtered = entries
    .filter(
      (e) =>
        e.text.toLowerCase().includes(search.toLowerCase()) ||
        e.id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "length-asc") return a.text.length - b.text.length;
      if (sort === "length-desc") return b.text.length - a.text.length;
      return 0;
    });

  const SORT_LABELS = {
    default: "Default",
    "length-asc": "Shortest first",
    "length-desc": "Longest first",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Question label */}
      {!compact && (
        <p className="text-xs font-medium text-text-muted mb-2 leading-snug">{question}</p>
      )}

      {/* Search + Sort */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search responses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded bg-card-alt focus:outline-none focus:border-accent text-text-primary placeholder:text-text-disabled"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded text-text-secondary hover:border-border-strong"
          >
            Sort <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded shadow-md z-50 py-1">
                {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs ${sort === key ? "bg-accent-light text-accent font-medium" : "text-text-secondary hover:bg-accent-light"}`}
                  >
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] font-mono text-text-muted mb-2">
        {filtered.length} of {entries.length} responses
      </p>

      {/* Response list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-text-muted italic py-3 text-center">No matching responses</p>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect?.(entry)}
              className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                selectedId === entry.id
                  ? "bg-accent-light border-accent"
                  : "bg-card border-border hover:border-accent hover:bg-accent-light/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-text-muted text-[10px]">{entry.id}</span>
              </div>
              <p className="text-text-secondary leading-snug line-clamp-2">{entry.text}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
