"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { ResponseEntry } from "@/components/responses/RawResponseList";

interface EmbeddedResponseBrowserProps {
  question: string;
  entries: ResponseEntry[];
}

export default function EmbeddedResponseBrowser({ entries }: EmbeddedResponseBrowserProps) {
  const [search, setSearch] = useState("");

  const filtered = entries.filter(
    (e) =>
      e.text.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
        <input
          type="text"
          placeholder="Search responses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded bg-card-alt focus:outline-none focus:border-accent text-text-primary placeholder:text-text-disabled"
        />
      </div>

      <p className="text-[10px] font-mono text-text-muted mb-2">
        {filtered.length} responses
      </p>

      {/* Response list */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2 rounded border border-border text-xs bg-card-alt"
          >
            <span className="font-mono text-text-muted text-[10px] block mb-0.5">{entry.id}</span>
            <p className="text-text-secondary leading-relaxed line-clamp-3">{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
