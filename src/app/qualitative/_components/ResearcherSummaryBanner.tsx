"use client";

import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import type { ParticipantId } from "@/types/qualitative";

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' } as const;

export function ResearcherSummaryBanner({ participantId }: { participantId: ParticipantId }) {
  const { researcherNotesByParticipant } = useQualitativeData();
  const summary = researcherNotesByParticipant(participantId);
  if (!summary?.summary) return null;

  return (
    <div className="mb-6 bg-[#fbf6ee] border border-amber-200/50 rounded-md px-5 py-4">
      <div className="text-[11px] uppercase tracking-wide text-amber-900/70 font-medium mb-1.5">
        {"Researcher's synthesis"}
      </div>
      <p className="text-sm text-neutral-800 italic leading-relaxed" style={serif}>
        {summary.summary}
      </p>
    </div>
  );
}
