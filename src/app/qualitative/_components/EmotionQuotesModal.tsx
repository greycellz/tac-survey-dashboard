"use client";

import { useEffect, useMemo, useState } from "react";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";
import type { EmotionId } from "@/types/qualitative";
import { QuoteContextModal } from "./QuoteContextModal";

export function EmotionQuotesModal({
  emotionId,
  onClose,
}: {
  emotionId: EmotionId | null;
  onClose: () => void;
}) {
  const { allQuotes, affectByQuote, affectVocabulary } = useQualitativeData();
  const [drillQuoteId, setDrillQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!emotionId || drillQuoteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emotionId, drillQuoteId, onClose]);

  const grouped = useMemo(() => {
    if (!emotionId) return [] as { participantId: string; quotes: typeof allQuotes }[];
    const filtered = allQuotes.filter((q) => {
      const a = affectByQuote(q.quoteId);
      return a?.primaryEmotion === emotionId;
    });
    const map = new Map<string, typeof allQuotes>();
    for (const q of filtered) {
      if (!map.has(q.participantId)) map.set(q.participantId, []);
      map.get(q.participantId)!.push(q);
    }
    return Array.from(map.entries())
      .map(([participantId, quotes]) => ({ participantId, quotes }))
      .sort((a, b) => b.quotes.length - a.quotes.length);
  }, [emotionId, allQuotes, affectByQuote]);

  if (!emotionId) return null;

  const emotionLabel = affectVocabulary.emotions.find((e) => e.id === emotionId)?.name ?? emotionId;
  const emotionDef = affectVocabulary.emotions.find((e) => e.id === emotionId)?.definition ?? "";
  const totalCount = grouped.reduce((s, g) => s + g.quotes.length, 0);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emotion-quotes-modal-title"
          className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: EMOTION_COLORS[emotionId] }}
              />
              <div className="min-w-0">
                <div id="emotion-quotes-modal-title" className="text-sm font-semibold">
                  {emotionLabel}
                </div>
                <div className="text-xs text-neutral-500">
                  {totalCount} quote{totalCount === 1 ? "" : "s"} across {grouped.length} participant
                  {grouped.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-neutral-500 hover:text-neutral-900 text-xl leading-none shrink-0"
            >
              ×
            </button>
          </header>

          <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 shrink-0">
            <p className="text-xs text-neutral-600 italic">{emotionDef || "—"}</p>
          </div>

          <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
            {grouped.length === 0 ? (
              <div className="text-sm text-neutral-500 italic">No quotes carry this emotion as primary.</div>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ participantId, quotes }) => (
                  <div key={participantId}>
                    <div className="text-xs font-mono text-neutral-500 mb-1.5">
                      {participantId} · {quotes.length} quote{quotes.length === 1 ? "" : "s"}
                    </div>
                    <ul className="border border-neutral-200 rounded-md divide-y divide-neutral-100">
                      {quotes.map((q) => {
                        const a = affectByQuote(q.quoteId);
                        return (
                          <li
                            key={q.quoteId}
                            onClick={() => setDrillQuoteId(q.quoteId)}
                            className="px-3 py-2 text-sm hover:bg-neutral-50 cursor-pointer flex items-start gap-3"
                          >
                            <span className="flex-1">
                              &ldquo;
                              {q.quoteVerbatim.length > 180
                                ? `${q.quoteVerbatim.slice(0, 180)}…`
                                : q.quoteVerbatim}
                              &rdquo;
                            </span>
                            {a && (
                              <span className="text-[10px] text-neutral-400 shrink-0 tabular-nums whitespace-nowrap">
                                int {a.intensity.toFixed(2)}
                                {" · "}
                                stance {a.stance >= 0 ? "+" : ""}
                                {a.stance.toFixed(2)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QuoteContextModal quoteId={drillQuoteId} onClose={() => setDrillQuoteId(null)} />
    </>
  );
}
