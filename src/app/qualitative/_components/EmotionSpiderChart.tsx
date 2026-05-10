"use client";

import type { AffectFingerprint, AffectVocabulary, EmotionId } from "@/types/qualitative";

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

export type EmotionSpiderPolygon = {
  fingerprint: AffectFingerprint;
  label: string;
  color: string;
  fillOpacity: number;
};

export function EmotionSpiderChart({
  polygons,
  vocabulary,
  size = 320,
}: {
  polygons: EmotionSpiderPolygon[];
  vocabulary: AffectVocabulary;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = radius * 1.2;

  const validPolygons = polygons.filter((p) => p.fingerprint.n > 0);
  if (validPolygons.length === 0) {
    return <div className="text-xs text-neutral-400 italic">No affect data for this selection.</div>;
  }

  const points = (fp: AffectFingerprint) => {
    const max = Math.max(...Object.values(fp.emotionCounts), 1);
    return EMOTION_ORDER.map((em, i) => {
      const fraction = fp.emotionCounts[em] / max;
      const angle = (i / EMOTION_ORDER.length) * 2 * Math.PI - Math.PI / 2;
      const r = radius * fraction;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
    });
  };

  const gridPolygon = (frac: number) =>
    EMOTION_ORDER.map((_, i) => {
      const angle = (i / EMOTION_ORDER.length) * 2 * Math.PI - Math.PI / 2;
      return [cx + Math.cos(angle) * radius * frac, cy + Math.sin(angle) * radius * frac] as const;
    })
      .map(([x, y]) => `${x},${y}`)
      .join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label="Emotion spider chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={gridPolygon(f)} fill="none" stroke="#e5e5e5" strokeWidth={1} />
        ))}
        {EMOTION_ORDER.map((_, i) => {
          const angle = (i / EMOTION_ORDER.length) * 2 * Math.PI - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e5e5" strokeWidth={1} />;
        })}
        {validPolygons.map((p, i) => {
          const pts = points(p.fingerprint);
          const path = pts.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <polygon
              key={i}
              points={path}
              fill={p.color}
              fillOpacity={p.fillOpacity}
              stroke={p.color}
              strokeWidth={1.5}
            />
          );
        })}
        {EMOTION_ORDER.map((em, i) => {
          const angle = (i / EMOTION_ORDER.length) * 2 * Math.PI - Math.PI / 2;
          const x = cx + Math.cos(angle) * labelRadius;
          const y = cy + Math.sin(angle) * labelRadius;
          const name = vocabulary.emotions.find((e) => e.id === em)?.name ?? em;
          return (
            <text
              key={em}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="#666"
            >
              {name}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {validPolygons.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: p.color, opacity: p.fillOpacity + 0.3 }}
            />
            {p.label} (n={p.fingerprint.n})
          </span>
        ))}
      </div>
    </div>
  );
}
