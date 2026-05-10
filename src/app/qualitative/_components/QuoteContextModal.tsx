"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";
import type { EmotionId } from "@/types/qualitative";

const CONTEXT_CUES_BEFORE = 10;
const CONTEXT_CUES_AFTER = 10;

export function QuoteContextModal({
  quoteId,
  onClose,
}: {
  quoteId: string | null;
  onClose: () => void;
}) {
  const { bundle, allQuotes, affectByQuote } = useQualitativeData();
  const dialogRef = useRef<HTMLDivElement>(null);

  const quote = useMemo(() => allQuotes.find((q) => q.quoteId === quoteId) ?? null, [allQuotes, quoteId]);

  useEffect(() => {
    if (!quoteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quoteId, onClose]);

  useEffect(() => {
    if (!quoteId) return;
    const el = dialogRef.current?.querySelector("[data-quote-target='true']") as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [quoteId]);

  if (!quote) return null;

  const affect = affectByQuote(quote.quoteId);

  const transcript = bundle.transcripts[quote.participantId];
  const targetCueNumber = quote.citation.cueNumber;
  const cues = transcript.cues;
  const targetIdx = cues.findIndex((c) => c.cueNumber === targetCueNumber);
  if (targetIdx === -1) return null;
  const start = Math.max(0, targetIdx - CONTEXT_CUES_BEFORE);
  const end = Math.min(cues.length, targetIdx + CONTEXT_CUES_AFTER + 1);
  const cueWindow = cues.slice(start, end);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-context-title"
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div id="quote-context-title" className="text-sm">
            <span className="font-mono font-semibold">{quote.participantId}</span>
            <span className="text-neutral-400 mx-2">·</span>
            <span className="text-neutral-600">cue {targetCueNumber}</span>
            <span className="text-neutral-400 mx-2">·</span>
            <span className="text-neutral-600">{quote.citation.startTime}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/qualitative/${quote.participantId}#cue-${targetCueNumber}`}
              className="text-xs text-neutral-600 underline hover:text-neutral-900"
              onClick={onClose}
            >
              View full transcript
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-neutral-500 hover:text-neutral-900 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </header>

        <div className="px-5 py-4 border-b border-neutral-200 shrink-0 bg-neutral-50">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {quote.source === "uncoded" ? (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">Uncoded observation</span>
            ) : (
              quote.codes.map((c) => (
                <span
                  key={c.id}
                  className="text-xs px-2 py-0.5 rounded bg-neutral-900 text-white"
                  title={c.definition}
                >
                  {c.name}
                </span>
              ))
            )}
          </div>
          {affect && (
            <span className="text-xs text-neutral-600 inline-flex items-center gap-1.5 mt-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: EMOTION_COLORS[affect.primaryEmotion as EmotionId] }}
              />
              {affect.primaryEmotion}
              {affect.secondaryEmotion && ` · ${affect.secondaryEmotion}`}
              <span className="text-neutral-400">
                · intensity {affect.intensity.toFixed(2)} · stance {affect.stance > 0 ? "+" : ""}
                {affect.stance.toFixed(2)}
              </span>
            </span>
          )}
          {quote.source === "coded" && quote.rationale && (
            <p className="text-xs text-neutral-600 italic">{quote.rationale}</p>
          )}
          {quote.source === "uncoded" && <p className="text-xs text-neutral-600 mt-1">{quote.note}</p>}
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <ol className="space-y-2 text-sm">
            {cueWindow.map((c) => {
              const isTarget = c.cueNumber === targetCueNumber;
              const isParticipant = c.speakerRole === "participant";
              return (
                <li
                  key={c.cueNumber}
                  data-quote-target={isTarget ? "true" : undefined}
                  className={
                    "flex gap-3 px-2 py-1.5 rounded " +
                    (isTarget ? "bg-yellow-100 ring-1 ring-yellow-300" : "")
                  }
                >
                  <span className="font-mono text-xs text-neutral-400 shrink-0 w-20">{c.startTime}</span>
                  <span
                    className={
                      "shrink-0 text-xs font-mono " + (isParticipant ? "text-neutral-900" : "text-neutral-400")
                    }
                  >
                    {isParticipant ? "P" : "I"}
                  </span>
                  <span className={"flex-1 " + (isParticipant ? "text-neutral-900" : "text-neutral-500")}>
                    {c.text}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
