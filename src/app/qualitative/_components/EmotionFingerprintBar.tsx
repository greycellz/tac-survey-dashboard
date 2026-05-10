"use client";

import type { AffectFingerprint, AffectVocabulary, EmotionId } from "@/types/qualitative";
import { EMOTION_COLORS } from "@/lib/qualitative/emotion-colors";

export function EmotionFingerprintBar({
  fingerprint,
  vocabulary,
}: {
  fingerprint: AffectFingerprint;
  vocabulary: AffectVocabulary;
}) {
  if (fingerprint.n === 0) {
    return (
      <div className="text-xs text-neutral-400 italic px-4 py-2">
        No affect annotations available for this set.
      </div>
    );
  }
  const total = Object.values(fingerprint.emotionCounts).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(fingerprint.emotionCounts)
    .filter(([, c]) => c > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Emotion mix · n={fingerprint.n}
        </span>
        <span className="text-xs text-neutral-500">
          intensity {fingerprint.meanIntensity.toFixed(2)} · stance {fingerprint.meanStance.toFixed(2)}
        </span>
      </div>
      <div className="flex h-3 rounded overflow-hidden border border-neutral-200">
        {sorted.map(([emotion, count]) => {
          const pct = (count / total) * 100;
          return (
            <div
              key={emotion}
              style={{ width: `${pct}%`, backgroundColor: EMOTION_COLORS[emotion as EmotionId] }}
              title={`${vocabulary.emotions.find((e) => e.id === emotion)?.name}: ${count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sorted.map(([emotion, count]) => (
          <span key={emotion} className="text-xs text-neutral-600 inline-flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: EMOTION_COLORS[emotion as EmotionId] }}
            />
            {vocabulary.emotions.find((e) => e.id === emotion)?.name} ({count})
          </span>
        ))}
      </div>
    </div>
  );
}
