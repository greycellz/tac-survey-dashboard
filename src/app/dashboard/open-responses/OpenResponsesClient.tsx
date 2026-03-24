"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import RawResponseList, { type ResponseEntry } from "@/components/responses/RawResponseList";
import ResponseDetailPanel from "@/components/responses/ResponseDetailPanel";
import type { SurveyRespondent } from "@/types/survey";

const QUESTION_OPTIONS: Array<{ value: string; label: string; getter: (r: SurveyRespondent) => string }> = [
  { value: "overwhelming", label: "What has felt most overwhelming?", getter: (r) => r.mostOverwhelming },
  { value: "helpful", label: "Who or what has been most helpful?", getter: (r) => r.mostHelpful },
  { value: "easier", label: "What would have made recovery easier?", getter: (r) => r.whatWouldHaveHelped },
  { value: "coping", label: "How do you cope with stress?", getter: (r) => r.copingStrategies },
  { value: "ai-one-thing", label: "If AI could help with one thing…", getter: (r) => r.aiOneThingText },
  { value: "anything-else", label: "Anything else you'd like to share?", getter: (r) => r.anythingElse },
  { value: "advice", label: "Advice to someone who just experienced a disaster", getter: (r) => r.advice },
];

interface OpenResponsesClientProps {
  respondents: SurveyRespondent[];
}

export default function OpenResponsesClient({ respondents }: OpenResponsesClientProps) {
  const [questionKey, setQuestionKey] = useState("overwhelming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteCandidatesOnly, setQuoteCandidatesOnly] = useState(false);
  const [questionDropOpen, setQuestionDropOpen] = useState(false);

  const selectedQuestion = QUESTION_OPTIONS.find((q) => q.value === questionKey)!;

  const entries: ResponseEntry[] = respondents
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Open Responses"
        description="Browse verbatim responses, validate quotes, and inspect respondent context"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Question picker */}
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
              <div className="absolute left-0 top-full mt-1 w-72 bg-card border border-border rounded-md shadow-md z-50 py-1">
                {QUESTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
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
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quote candidates toggle */}
        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={quoteCandidatesOnly}
            onChange={(e) => setQuoteCandidatesOnly(e.target.checked)}
            className="rounded border-border accent-accent w-3.5 h-3.5"
          />
          Quote candidates only (may share = yes)
        </label>

        <span className="text-xs font-mono text-text-muted ml-auto">
          {entries.length} responses
        </span>
      </div>

      {/* 3-column layout */}
      <div
        className="grid border border-border rounded-lg overflow-hidden bg-card"
        style={{ gridTemplateColumns: "240px 1fr 280px", height: "calc(100vh - 340px)", minHeight: "480px" }}
      >
        {/* Column 1: Response list */}
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

        {/* Column 2: Full response */}
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

        {/* Column 3: Respondent metadata */}
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
    </div>
  );
}
