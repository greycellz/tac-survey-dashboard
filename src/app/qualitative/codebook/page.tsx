"use client";

import { Suspense, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import type { CategoryKey } from "@/types/qualitative";
import { QualitativeFilterStrip } from "../_components/QualitativeFilterStrip";
import { QuoteContextModal } from "../_components/QuoteContextModal";
import { EmotionFingerprintBar } from "../_components/EmotionFingerprintBar";
import { EmotionSpiderChart } from "../_components/EmotionSpiderChart";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";
import type { EmotionId } from "@/types/qualitative";

const CATEGORY_ORDER: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  lifeAndRoutineChanges: "Life & routine changes",
  emotionalImpact: "Emotional impact",
  recoveryChallengesAndPainPoints: "Recovery challenges",
  needsOverTime: "Needs over time",
  technologyForRecovery: "Technology for recovery",
  aiAttitudesAndBeliefs: "AI attitudes & beliefs",
  mvpFeedback: "MVP feedback",
  crossCutting: "Cross-cutting",
};

function CodebookPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    bundle,
    filteredQuotes,
    allQuotes,
    quotesByCode,
    affectByCode,
    fingerprintForQuotes,
    affectVocabulary,
    affectByQuote,
  } = useQualitativeData();

  const quoteId = searchParams.get("quote");

  const setQuoteParam = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (id) p.set("quote", id);
      else p.delete("quote");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const codesByCategory = new Map<CategoryKey, typeof bundle.codebook.entries>();
  for (const c of bundle.codebook.entries) {
    if (!codesByCategory.has(c.category)) codesByCategory.set(c.category, []);
    codesByCategory.get(c.category)!.push(c);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Codebook</h2>
          <p className="text-sm text-neutral-600">
            {bundle.codebook.entries.length} codes · {filteredQuotes.length} quotes (filtered)
          </p>
        </div>
        <span className="text-xs font-mono text-neutral-500">
          v{bundle.codebook.version.replace(/^v/, "")}
        </span>
      </div>

      <details className="mb-4 border border-neutral-200 rounded-md bg-white">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          Corpus emotion fingerprint
        </summary>
        <div className="px-4 py-4">
          <EmotionSpiderChart
            polygons={[
              {
                fingerprint: fingerprintForQuotes(allQuotes),
                label: "All quotes",
                color: "#5a7ba0",
                fillOpacity: 0.15,
              },
              ...(filteredQuotes.length !== allQuotes.length
                ? [
                    {
                      fingerprint: fingerprintForQuotes(filteredQuotes),
                      label: "Filtered",
                      color: "#c14b4b",
                      fillOpacity: 0.3,
                    },
                  ]
                : []),
            ]}
            vocabulary={affectVocabulary}
            size={360}
          />
        </div>
      </details>

      <QualitativeFilterStrip />

      <div className="mt-6 space-y-8">
        {CATEGORY_ORDER.map((cat) => {
          const codes = codesByCategory.get(cat) ?? [];
          return (
            <section key={cat}>
              <h3 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">{CATEGORY_LABELS[cat]}</h3>
              <div className="space-y-3">
                {codes.map((code) => {
                  const codeQuotes = quotesByCode(code.id);
                  return (
                    <details
                      key={code.id}
                      className="border border-neutral-200 rounded-md bg-white"
                      open={codeQuotes.length > 0 && codeQuotes.length <= 8}
                    >
                      <summary className="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-neutral-50 list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="font-medium text-sm">{code.name}</div>
                          <div className="text-xs text-neutral-500 mt-0.5 truncate">{code.definition}</div>
                        </div>
                        <span
                          className={
                            "text-xs font-mono px-2 py-0.5 rounded " +
                            (codeQuotes.length === 0
                              ? "bg-neutral-100 text-neutral-400"
                              : "bg-neutral-900 text-white")
                          }
                        >
                          {codeQuotes.length}
                        </span>
                      </summary>
                      {codeQuotes.length > 0 && (
                        <>
                          <ul className="border-t border-neutral-100 divide-y divide-neutral-100">
                            {codeQuotes.map((q) => {
                              const aff = affectByQuote(q.quoteId);
                              return (
                                <li
                                  key={q.quoteId}
                                  className="px-4 py-2.5 text-sm hover:bg-neutral-50 cursor-pointer flex items-start gap-3"
                                  onClick={() => setQuoteParam(q.quoteId)}
                                >
                                  <span className="font-mono text-xs text-neutral-500 shrink-0 mt-0.5">
                                    {q.participantId}
                                  </span>
                                  <span className="flex-1 text-neutral-800">
                                    &ldquo;
                                    {q.quoteVerbatim.length > 140
                                      ? `${q.quoteVerbatim.slice(0, 140)}…`
                                      : q.quoteVerbatim}
                                    &rdquo;
                                  </span>
                                  {aff && (
                                    <span
                                      className="shrink-0 inline-flex flex-col items-end gap-0.5 text-[10px] text-neutral-500"
                                      title={`${aff.primaryEmotion} · intensity ${aff.intensity.toFixed(2)}`}
                                    >
                                      <span
                                        className="inline-block w-3 h-3 rounded-sm border border-neutral-200"
                                        style={{
                                          backgroundColor: EMOTION_COLORS[aff.primaryEmotion as EmotionId],
                                        }}
                                      />
                                      <span className="tabular-nums opacity-80">{aff.intensity.toFixed(2)}</span>
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <EmotionFingerprintBar
                            fingerprint={affectByCode(code.id)}
                            vocabulary={affectVocabulary}
                          />
                        </>
                      )}
                    </details>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <QuoteContextModal quoteId={quoteId} onClose={() => setQuoteParam(null)} />
    </div>
  );
}

export default function CodebookPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto text-sm text-neutral-600">Loading codebook…</div>}>
      <CodebookPageInner />
    </Suspense>
  );
}
