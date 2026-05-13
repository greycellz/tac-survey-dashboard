"use client";

import { useState } from "react";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import type { ParticipantId, ResearcherNoteCategoryKey } from "@/types/qualitative";

const CATEGORY_ORDER: { key: ResearcherNoteCategoryKey; label: string }[] = [
  { key: "lifeAndRoutineChanges", label: "Life and routine changes" },
  { key: "emotionalImpact", label: "Emotional impact" },
  { key: "recoveryChallengesAndPainPoints", label: "Recovery challenges" },
  { key: "needsOverTime", label: "Needs over time" },
  { key: "technologyForRecovery", label: "Technology for recovery" },
  { key: "aiAttitudesAndBeliefs", label: "AI attitudes & beliefs" },
  { key: "chatGptInsights", label: "Researcher insight" },
];

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' } as const;

export function ResearcherNotesPanel({ participantId }: { participantId: ParticipantId }) {
  const { researcherNotesByParticipant, fullResearcherNotesByParticipant } = useQualitativeData();
  const summary = researcherNotesByParticipant(participantId);
  const fullNotes = fullResearcherNotesByParticipant(participantId);
  const [expanded, setExpanded] = useState<Set<ResearcherNoteCategoryKey>>(new Set());

  if (!summary) {
    return (
      <div className="px-4 py-3 text-xs text-neutral-500 italic">
        No researcher notes summary available for {participantId}.
      </div>
    );
  }

  const toggle = (key: ResearcherNoteCategoryKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-[#fbf6ee] border-b border-amber-100/60">
      <div className="px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-amber-900/70 font-medium mb-1">
          {"Researcher's interpretation"}
        </div>
        <ul className="space-y-2 text-sm text-neutral-800">
          {CATEGORY_ORDER.map(({ key, label }) => {
            const oneLiner = summary.perCategory[key];
            const full = fullNotes[key];
            const isExpanded = expanded.has(key);
            if (!oneLiner && !full) return null;
            return (
              <li key={key}>
                <div className="text-xs uppercase tracking-wide text-amber-900/60 mb-0.5">{label}</div>
                {oneLiner && (
                  <div className="italic leading-snug" style={serif}>
                    {oneLiner}
                  </div>
                )}
                {full && (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="mt-1 text-[11px] text-amber-900/70 hover:text-amber-900 underline"
                  >
                    {isExpanded ? "Hide full note" : "Show full note"}
                  </button>
                )}
                {isExpanded && full && (
                  <div
                    className="mt-1.5 text-xs leading-relaxed text-neutral-700 italic px-2 py-1.5 bg-[#fef9f0] border-l-2 border-amber-200 rounded-r whitespace-pre-wrap"
                    style={serif}
                  >
                    {full}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
