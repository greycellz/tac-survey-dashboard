"use client";

import Link from "next/link";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";

export default function QualitativeLandingPage() {
  const { bundle, allQuotes } = useQualitativeData();
  const countByParticipant = new Map<string, number>();
  for (const q of allQuotes) {
    countByParticipant.set(q.participantId, (countByParticipant.get(q.participantId) ?? 0) + 1);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Participants</h2>
      <p className="text-sm text-neutral-600 mb-6">
        {bundle.manifest.entries.length} participants · {allQuotes.length} validated coded quotes
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundle.manifest.entries.map((entry) => {
          const d = entry.demographics;
          const count = countByParticipant.get(entry.id) ?? 0;
          return (
            <Link
              key={entry.id}
              href={`/qualitative/${entry.id}`}
              className="block border border-neutral-200 rounded-md p-4 hover:border-neutral-400 transition-colors bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-semibold">{entry.id}</span>
                <span className="text-xs text-neutral-500">{count} quotes</span>
              </div>
              <div className="text-sm text-neutral-700 space-y-0.5">
                <div>
                  {d?.age ?? "—"} · {d?.gender ?? "—"}
                </div>
                <div className="text-xs text-neutral-500">{d?.recoveryStage ?? ""}</div>
                <div className="text-xs text-neutral-500">{d?.displacementDuration ?? d?.fireAffectedMost ?? ""}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
