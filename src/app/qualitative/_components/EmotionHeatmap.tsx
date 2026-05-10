"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQualitativeData } from "@/contexts/QualitativeDataContext";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";
import type { EmotionId } from "@/types/qualitative";
import { EmotionQuotesModal } from "./EmotionQuotesModal";

const EMOTION_ORDER: EmotionId[] = [
  "grief",
  "fear",
  "anger",
  "weariness",
  "resignation",
  "numbness",
  "neutral",
  "relief",
  "gratitude",
  "pride",
  "hope",
  "defiance",
];

type SortMode = "concentration" | "id" | "n";

function shareToColor(share: number): string {
  if (share <= 0) return "#f7f7f7";
  const l = 95 - share * 50;
  return `hsl(28, 80%, ${l}%)`;
}

export function EmotionHeatmap() {
  const { bundle, fingerprintsByParticipant, affectVocabulary } = useQualitativeData();
  const [sortMode, setSortMode] = useState<SortMode>("concentration");
  const [emotionModalId, setEmotionModalId] = useState<EmotionId | null>(null);

  const participantIds = bundle.manifest.entries.map((e) => e.id);

  const cellData = participantIds.map((id) => {
    const fp = fingerprintsByParticipant[id];
    const total = fp.n;
    return {
      id,
      n: total,
      shares: Object.fromEntries(
        EMOTION_ORDER.map((em) => [em, total > 0 ? fp.emotionCounts[em] / total : 0]),
      ) as Record<EmotionId, number>,
      counts: fp.emotionCounts,
    };
  });

  const sortedCellData = useMemo(() => {
    const arr = [...cellData];
    if (sortMode === "id") {
      return arr.sort((a, b) => a.id.localeCompare(b.id));
    }
    if (sortMode === "n") {
      return arr.sort((a, b) => {
        if (b.n !== a.n) return b.n - a.n;
        return a.id.localeCompare(b.id);
      });
    }
    return arr.sort((a, b) => {
      const aMax = a.n === 0 ? -1 : Math.max(...Object.values(a.shares));
      const bMax = b.n === 0 ? -1 : Math.max(...Object.values(b.shares));
      if (aMax !== bMax) return bMax - aMax;
      return a.id.localeCompare(b.id);
    });
  }, [cellData, sortMode]);

  const labelOf = (em: EmotionId) =>
    affectVocabulary.emotions.find((e) => e.id === em)?.name ?? em;

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Emotion heatmap</div>
          <div className="text-xs text-neutral-500">
            Each cell shows the share of that emotion among annotations for that participant. Click a row to open
            the transcript; click a column to see all matching quotes.
          </div>
        </div>
        <label className="text-xs text-neutral-600 flex items-center gap-1.5 shrink-0">
          Sort:
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="border border-neutral-300 rounded px-1.5 py-0.5 text-xs bg-white"
          >
            <option value="concentration">Concentration</option>
            <option value="id">Participant ID</option>
            <option value="n">Annotation count</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "96px" }} />
            {EMOTION_ORDER.map((em) => (
              <col key={em} />
            ))}
            <col style={{ width: "56px" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-white z-10 font-medium text-neutral-600">
                Participant
              </th>
              {EMOTION_ORDER.map((em) => (
                <th
                  key={em}
                  className="px-1 py-2 cursor-pointer text-neutral-700 hover:text-black overflow-visible align-bottom"
                  style={{ verticalAlign: "bottom" }}
                  onClick={() => setEmotionModalId(em)}
                  title={`Quotes with primary emotion: ${labelOf(em)}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: EMOTION_COLORS[em] }}
                    />
                    <span className="text-[10px] font-normal whitespace-nowrap origin-center translate-y-1.5 text-center leading-tight block max-w-[6rem] rotate-[-35deg]">
                      {labelOf(em)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium text-neutral-600">n</th>
            </tr>
          </thead>
          <tbody>
            {sortedCellData.map((row) => {
              const muted = row.n === 0;
              return (
                <tr key={row.id} className={"hover:bg-neutral-50 " + (muted ? "opacity-40" : "")}>
                  <td className="px-3 py-1.5 sticky left-0 bg-white z-10 font-mono">
                    <Link href={`/qualitative/${row.id}`} className="text-neutral-800 hover:underline">
                      {row.id}
                    </Link>
                  </td>
                  {EMOTION_ORDER.map((em) => {
                    const share = row.shares[em];
                    const count = row.counts[em];
                    return (
                      <td key={em} className="p-0" title={`${labelOf(em)}: ${count} (${(share * 100).toFixed(1)}%)`}>
                        <div className="h-7 w-full" style={{ backgroundColor: shareToColor(share) }} />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right text-neutral-500 tabular-nums">{row.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
        <span>Lighter = lower share, deeper = higher share within each row.</span>
        <span className="flex items-center gap-1.5">
          0%
          <span
            className="inline-block w-24 h-2 rounded-sm"
            style={{
              background: "linear-gradient(to right, hsl(28,80%,95%), hsl(28,80%,45%))",
            }}
          />
          50%+
        </span>
      </div>

      <EmotionQuotesModal emotionId={emotionModalId} onClose={() => setEmotionModalId(null)} />
    </div>
  );
}
