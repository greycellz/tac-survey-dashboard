"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import { QuoteContextModal } from "../_components/QuoteContextModal";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";
import type { EmotionId, ParticipantId } from "@/types/qualitative";

function ParticipantTranscriptInner() {
  const params = useParams<{ id: string }>();
  const id = params.id as ParticipantId;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quote");

  const { bundle, quotesByParticipant, manifestEntry, affectByQuote } = useQualitativeData();

  const setQuoteParam = useCallback(
    (next: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next) p.set("quote", next);
      else p.delete("quote");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const entry = manifestEntry(id);
  const transcript = bundle.transcripts[id];
  const quotes = quotesByParticipant(id);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#cue-")) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [id]);

  if (!entry || !transcript) {
    return <div className="text-sm text-neutral-600">Participant not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
      <div>
        <div className="mb-4">
          <Link href="/qualitative" className="text-xs text-neutral-600 underline">
            ← All participants
          </Link>
          <h2 className="text-xl font-semibold mt-1">{entry.id}</h2>
          <p className="text-sm text-neutral-600">
            {entry.demographics?.age ?? "—"} · {entry.demographics?.gender ?? "—"} ·{" "}
            {entry.demographics?.recoveryStage ?? ""}
          </p>
        </div>

        <ol className="space-y-1.5 text-sm">
          {transcript.cues.map((c) => {
            const isParticipant = c.speakerRole === "participant";
            return (
              <li
                key={c.cueNumber}
                id={`cue-${c.cueNumber}`}
                className={"flex gap-3 px-2 py-1 rounded scroll-mt-20"}
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

      <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto border border-neutral-200 rounded-md bg-white">
        <div className="px-4 py-3 border-b border-neutral-200">
          <div className="text-sm font-semibold">Coded quotes</div>
          <div className="text-xs text-neutral-500">{quotes.length} total (filtered)</div>
        </div>
        <ul className="divide-y divide-neutral-100">
          {quotes.map((q) => {
            const aff = affectByQuote(q.quoteId);
            return (
              <li
                key={q.quoteId}
                className="px-4 py-2.5 hover:bg-neutral-50 cursor-pointer"
                onClick={() => setQuoteParam(q.quoteId)}
              >
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  {q.source === "uncoded" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                      Uncoded
                    </span>
                  ) : (
                    q.codes.map((c) => (
                      <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        {c.name}
                      </span>
                    ))
                  )}
                  {aff && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 ml-auto"
                      style={{ backgroundColor: EMOTION_COLORS[aff.primaryEmotion as EmotionId] }}
                      title={`${aff.primaryEmotion} · ${aff.intensity.toFixed(2)}`}
                    />
                  )}
                </div>
                <div className="text-xs text-neutral-700">
                  &ldquo;
                  {q.quoteVerbatim.length > 100 ? `${q.quoteVerbatim.slice(0, 100)}…` : q.quoteVerbatim}
                  &rdquo;
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <QuoteContextModal quoteId={quoteId} onClose={() => setQuoteParam(null)} />
    </div>
  );
}

export default function ParticipantTranscriptPage() {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-600">Loading…</div>}>
      <ParticipantTranscriptInner />
    </Suspense>
  );
}
