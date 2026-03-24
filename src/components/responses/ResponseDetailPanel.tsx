"use client";

import { Copy, Bookmark, ExternalLink } from "lucide-react";
import type { SurveyRespondent } from "@/types/survey";
import type { ResponseEntry } from "./RawResponseList";

interface ResponseDetailPanelProps {
  entry: ResponseEntry | null;
  respondent: SurveyRespondent | null;
  question?: string;
}

export default function ResponseDetailPanel({
  entry,
  respondent,
  question,
}: ResponseDetailPanelProps) {
  if (!entry || !respondent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <p className="text-xs text-text-muted">Select a response to view details</p>
      </div>
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Response ID */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-text-muted">{entry.id}</span>
        {respondent.mayShare && (
          <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
            May share
          </span>
        )}
      </div>

      {/* Question */}
      {question && (
        <p className="text-[11px] text-text-muted italic mb-2 leading-snug">{question}</p>
      )}

      {/* Full response text */}
      <div className="bg-card-alt border border-border rounded p-3 mb-4">
        <p className="text-xs text-text-primary leading-relaxed">{entry.text}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 mb-4">
        <button
          onClick={() => copyToClipboard(`"${entry.text}" — ${entry.id}`)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy quote + ID
        </button>
        <button
          onClick={() => copyToClipboard(`Q: ${question}\n"${entry.text}" — ${entry.id}`)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy quote + question
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors">
          <Bookmark className="w-3 h-3" /> Mark quote candidate
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-border rounded hover:bg-accent-light hover:text-accent transition-colors">
          <ExternalLink className="w-3 h-3" /> View row context
        </button>
      </div>

      {/* Respondent metadata */}
      <div className="border-t border-border pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
          Respondent Context
        </p>
        <div className="space-y-1.5 text-xs">
          {[
            ["ID", entry.id],
            ["Fire", respondent.fireAffected],
            ["Living situation", respondent.livingSituation === "Other" ? respondent.livingSituationOther ?? "Other" : respondent.livingSituation],
            ["Recovery stage", respondent.recoveryStage],
            ["Parent", respondent.hasChildren ? "Yes" : "No"],
            ["Caregiver", respondent.isCaregiver ? "Yes" : "No"],
            ["Wellbeing", respondent.wellbeing],
            ["AI interest", respondent.aiInterest],
            ["AI comfort", respondent.aiComfort],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-text-muted w-24 shrink-0">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
