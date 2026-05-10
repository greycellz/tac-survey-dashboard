"use client";

import { useMemo, useState } from "react";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import { EmotionSpiderChart } from "./EmotionSpiderChart";

export function CodeSpiderPanel() {
  const {
    bundle,
    affectByCode,
    fingerprintForQuotes,
    filteredQuotes,
    affectVocabulary,
    quotesByCode,
  } = useQualitativeData();
  const [selectedCodeId, setSelectedCodeId] = useState<string>(bundle.codebook.entries[0]?.id ?? "");
  const [showBaseline, setShowBaseline] = useState(true);

  const codesByCategory = useMemo(() => {
    const map = new Map<string, typeof bundle.codebook.entries>();
    for (const c of bundle.codebook.entries) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  }, [bundle]);

  const selectedCode = bundle.codebook.entries.find((c) => c.id === selectedCodeId);
  const codeFingerprint = affectByCode(selectedCodeId);
  const baselineFingerprint = useMemo(
    () => fingerprintForQuotes(filteredQuotes),
    [filteredQuotes, fingerprintForQuotes],
  );
  const codeQuoteCount = quotesByCode(selectedCodeId).length;

  return (
    <div className="border border-neutral-200 rounded-md bg-white">
      <div className="px-4 py-3 border-b border-neutral-200">
        <div className="text-sm font-semibold">Per-code emotion spider</div>
        <div className="text-xs text-neutral-500">
          Select a code to see its emotion fingerprint, optionally overlaid against the corpus baseline.
        </div>
      </div>

      <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-neutral-100">
        <select
          className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white"
          value={selectedCodeId}
          onChange={(e) => setSelectedCodeId(e.target.value)}
        >
          {Array.from(codesByCategory.entries()).map(([cat, codes]) => (
            <optgroup key={cat} label={cat}>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
          <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} />
          Compare to corpus baseline
        </label>

        <span className="text-xs text-neutral-500 ml-auto">
          {codeQuoteCount} quote{codeQuoteCount === 1 ? "" : "s"} under this code
        </span>
      </div>

      {selectedCode && (
        <div className="px-4 pt-3 pb-1 text-xs text-neutral-600">
          <div className="font-medium text-neutral-800">{selectedCode.name}</div>
          <div className="mt-0.5">{selectedCode.definition}</div>
        </div>
      )}

      <div className="px-4 py-4 flex justify-center">
        <EmotionSpiderChart
          polygons={[
            ...(showBaseline
              ? [
                  {
                    fingerprint: baselineFingerprint,
                    label: "Corpus baseline",
                    color: "#5a7ba0",
                    fillOpacity: 0.12,
                  },
                ]
              : []),
            {
              fingerprint: codeFingerprint,
              label: selectedCode?.name ?? "Selected code",
              color: "#c14b4b",
              fillOpacity: 0.32,
            },
          ]}
          vocabulary={affectVocabulary}
          size={380}
        />
      </div>
    </div>
  );
}
