"use client";

import { CodeSpiderPanel } from "../_components/CodeSpiderPanel";
import { EmotionHeatmap } from "../_components/EmotionHeatmap";
import { QualitativeFilterStrip } from "../_components/QualitativeFilterStrip";

export default function EmotionsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Emotion analysis</h2>
        <p className="text-sm text-neutral-600">
          Per-participant heatmap and per-code spider. Both views reflect the demographic filters set above.
        </p>
      </div>

      <QualitativeFilterStrip />

      <EmotionHeatmap />

      <CodeSpiderPanel />
    </div>
  );
}
