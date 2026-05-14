"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import RawResponseList, { type ResponseEntry } from "@/components/responses/RawResponseList";
import ResponseDetailPanel from "@/components/responses/ResponseDetailPanel";
import type { SurveyRespondent } from "@/types/survey";
import { DEFAULT_FILTER_STATE, type FilterState } from "@/types/survey";
import { parseSynthesis, type FullSynthesis } from "@/lib/survey/parseSynthesis";
import synthesisMd from "../../../../data/survey/SURVEY_OPEN_RESPONSES_SYNTHESIS.md";

const FULL_SYNTHESIS: FullSynthesis = parseSynthesis(synthesisMd);

const QUESTION_OPTIONS: Array<{
  value: string;
  label: string;
  getter: (r: SurveyRespondent) => string;
  synthesisIndex?: number;
  isCross?: boolean;
}> = [
  { value: "overwhelming", label: "What has felt most overwhelming?", getter: (r) => r.mostOverwhelming, synthesisIndex: 1 },
  { value: "helpful", label: "Who or what has been most helpful?", getter: (r) => r.mostHelpful, synthesisIndex: 2 },
  { value: "easier", label: "What would have made recovery easier?", getter: (r) => r.whatWouldHaveHelped, synthesisIndex: 3 },
  { value: "coping", label: "How do you cope with stress?", getter: (r) => r.copingStrategies, synthesisIndex: 4 },
  { value: "ai-one-thing", label: "If AI could help with one thing…", getter: (r) => r.aiOneThingText, synthesisIndex: 5 },
  { value: "anything-else", label: "Anything else you'd like to share?", getter: (r) => r.anythingElse, synthesisIndex: 6 },
  { value: "advice", label: "Advice to someone who just experienced a disaster", getter: (r) => r.advice, synthesisIndex: 7 },
  { value: "cross-question", label: "Cross-question synthesis", getter: () => "", isCross: true },
];

function filtersActive(f: FilterState): boolean {
  return (Object.keys(DEFAULT_FILTER_STATE) as (keyof FilterState)[]).some((k) => f[k] !== DEFAULT_FILTER_STATE[k]);
}

interface OpenResponsesClientProps {
  respondents: SurveyRespondent[];
  filters: FilterState;
}

export default function OpenResponsesClient({ respondents, filters }: OpenResponsesClientProps) {
  const [mainTab, setMainTab] = useState<"synthesis" | "browse">("synthesis");
  const [questionKey, setQuestionKey] = useState("overwhelming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteCandidatesOnly, setQuoteCandidatesOnly] = useState(false);
  const [questionDropOpen, setQuestionDropOpen] = useState(false);

  const selectedQuestion = QUESTION_OPTIONS.find((q) => q.value === questionKey)!;
  const isCrossQuestion = selectedQuestion.isCross === true;
  const demographicFilterOn = useMemo(() => filtersActive(filters), [filters]);

  const entries: ResponseEntry[] = isCrossQuestion
    ? []
    : respondents
        .filter((r) => {
          const text = selectedQuestion.getter(r);
          if (!text || text.length < 5) return false;
          if (quoteCandidatesOnly && !r.mayShare) return false;
          return true;
        })
        .map((r) => ({
          id: r.id,
          text: selectedQuestion.getter(r),
        }));

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;
  const selectedRespondent = respondents.find((r) => r.id === selectedId) ?? null;

  const currentQuestionSynthesis =
    !isCrossQuestion && selectedQuestion.synthesisIndex
      ? FULL_SYNTHESIS.questions[selectedQuestion.synthesisIndex - 1]
      : null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Open Responses"
        description="Browse verbatim responses, validate quotes, and inspect respondent context"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-border">
        <button
          type="button"
          onClick={() => setMainTab("synthesis")}
          className={
            "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors " +
            (mainTab === "synthesis"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary")
          }
        >
          Synthesis
        </button>
        <button
          type="button"
          onClick={() => setMainTab("browse")}
          className={
            "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors " +
            (mainTab === "browse"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary")
          }
        >
          Browse Responses
        </button>
      </div>

      {/* Question picker + browse-only toolbar row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setQuestionDropOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:border-border-strong font-medium max-w-xs"
          >
            <span className="truncate">{selectedQuestion.label}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
          </button>

          {questionDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setQuestionDropOpen(false)} />
              <div className="absolute left-0 top-full mt-1 w-80 bg-card border border-border rounded-md shadow-md z-50 py-1 max-h-[70vh] overflow-y-auto">
                {QUESTION_OPTIONS.map((opt, idx) => (
                  <div key={opt.value}>
                    {idx === 7 && (
                      <div className="px-3 py-1 text-[10px] text-text-muted uppercase tracking-wide border-t border-border mt-1 pt-2">
                        ──
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setQuestionKey(opt.value);
                        setSelectedId(null);
                        setQuestionDropOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors leading-snug ${
                        questionKey === opt.value
                          ? "bg-accent-light text-accent font-medium"
                          : "text-text-secondary hover:bg-accent-light"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {mainTab === "browse" && !isCrossQuestion && (
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={quoteCandidatesOnly}
              onChange={(e) => setQuoteCandidatesOnly(e.target.checked)}
              className="rounded border-border accent-accent w-3.5 h-3.5"
            />
            Quote candidates only (may share = yes)
          </label>
        )}

        {mainTab === "browse" && !isCrossQuestion && (
          <span className="text-xs font-mono text-text-muted ml-auto">{entries.length} responses</span>
        )}
      </div>

      {mainTab === "synthesis" && (
        <div className="mb-6 space-y-4">
          <p
            className={
              "text-xs text-text-muted leading-relaxed max-w-[680px] " +
              (demographicFilterOn ? "pl-3 border-l-2 border-amber-400/80" : "")
            }
          >
            This summary covers all 115 respondents. Demographic filters apply to Browse Responses only.
          </p>

          {isCrossQuestion ? (
            <div className="max-w-[680px] space-y-6">
              <div
                className="text-sm text-text-primary prose-synthesis"
                dangerouslySetInnerHTML={{ __html: FULL_SYNTHESIS.crossQuestion.bodyHtml }}
              />
              {FULL_SYNTHESIS.crossQuestion.closingQuote.text ? (
                <blockquote className="border-l-4 border-border pl-4 py-2 text-sm">
                  <p className="italic text-text-primary leading-relaxed">
                    {FULL_SYNTHESIS.crossQuestion.closingQuote.text}
                  </p>
                  <p className="mt-2 text-xs text-text-muted flex flex-wrap items-center gap-1">
                    <span className="font-mono bg-card-alt border border-border px-1.5 py-0.5 rounded">
                      #{FULL_SYNTHESIS.crossQuestion.closingQuote.submissionId}
                    </span>
                  </p>
                </blockquote>
              ) : null}
            </div>
          ) : currentQuestionSynthesis ? (
            <div className="max-w-[680px] space-y-4">
              {currentQuestionSynthesis.coverageLine && (
                <p className="text-xs text-text-muted">{currentQuestionSynthesis.coverageLine}</p>
              )}
              <div
                className="text-sm text-text-primary prose-synthesis"
                dangerouslySetInnerHTML={{ __html: currentQuestionSynthesis.synthesisHtml }}
              />
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Quotable verbatims</h3>
                <ul className="space-y-4 list-none p-0 m-0">
                  {currentQuestionSynthesis.quotes.map((q, i) => (
                    <li key={`${q.submissionId}-${i}`}>
                      <blockquote className="border-l-4 border-border pl-4 py-2 text-sm">
                        <p className="italic text-text-primary leading-relaxed">{q.text}</p>
                        <p className="mt-2 text-xs text-text-muted flex flex-wrap items-center gap-1">
                          <span className="font-mono bg-card-alt border border-border px-1.5 py-0.5 rounded">
                            #{q.submissionId}
                          </span>
                          {q.ageNote && <span>· {q.ageNote}</span>}
                        </p>
                      </blockquote>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {mainTab === "browse" && (
        <>
          {isCrossQuestion ? (
            <div className="text-sm text-text-muted py-12 text-center border border-border rounded-lg bg-card">
              Select a question to browse individual responses.
            </div>
          ) : (
            <div
              className="grid border border-border rounded-lg overflow-hidden bg-card"
              style={{
                gridTemplateColumns: "240px 1fr 280px",
                height: "calc(100vh - 380px)",
                minHeight: "480px",
              }}
            >
              <div className="border-r border-border overflow-hidden flex flex-col">
                <div className="px-3 pt-3 pb-2 border-b border-border bg-card-alt">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Response List
                  </p>
                </div>
                <div className="flex-1 overflow-hidden p-3">
                  <RawResponseList
                    question={selectedQuestion.label}
                    entries={entries}
                    selectedId={selectedId ?? undefined}
                    onSelect={(entry) => setSelectedId(entry.id)}
                    compact
                  />
                </div>
              </div>

              <div className="border-r border-border overflow-hidden flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-border bg-card-alt">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Full Response
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedEntry ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-mono text-text-muted">{selectedEntry.id}</span>
                        {selectedRespondent?.mayShare && (
                          <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                            May share
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-text-muted italic mb-3 leading-snug">
                        {selectedQuestion.label}
                      </p>
                      <p className="text-sm text-text-primary leading-relaxed">{selectedEntry.text}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-text-muted">Select a response from the list</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-border bg-card-alt">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Respondent Context
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <ResponseDetailPanel
                    entry={selectedEntry}
                    respondent={selectedRespondent}
                    question={selectedQuestion.label}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
