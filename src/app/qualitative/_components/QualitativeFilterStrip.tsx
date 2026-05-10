"use client";

import { useQualitativeData, type QualitativeFilter } from "@/contexts/QualitativeDataContext";

const AGE_BANDS: { value: "under40" | "40to60" | "over60"; label: string }[] = [
  { value: "under40", label: "<40" },
  { value: "40to60", label: "40–60" },
  { value: "over60", label: "60+" },
];

export function QualitativeFilterStrip() {
  const { bundle, filter, setFilter, resetFilter } = useQualitativeData();

  const genders = Array.from(
    new Set(
      bundle.manifest.entries
        .map((e) => e.demographics?.gender)
        .filter((g): g is string => Boolean(g)),
    ),
  ).sort();

  const stages = Array.from(
    new Set(
      bundle.manifest.entries
        .map((e) => e.demographics?.recoveryStage)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort();

  const toggle = <K extends keyof QualitativeFilter>(key: K, value: QualitativeFilter[K][number]) => {
    const arr = filter[key] as string[];
    const next = arr.includes(value as string)
      ? (arr.filter((v) => v !== value) as QualitativeFilter[K])
      : ([...arr, value] as QualitativeFilter[K]);
    setFilter({ ...filter, [key]: next });
  };

  const anyActive =
    filter.ageBand.length > 0 ||
    filter.gender.length > 0 ||
    filter.hasChildrenUnder18.length > 0 ||
    filter.isCaregiver.length > 0 ||
    filter.recoveryStage.length > 0;

  const Pill = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 py-1 rounded-full text-xs border transition-colors " +
        (active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500")
      }
    >
      {children}
    </button>
  );

  return (
    <div className="border border-neutral-200 rounded-md bg-neutral-50 p-3 flex items-center flex-wrap gap-x-6 gap-y-2">
      <FilterGroup label="Age">
        {AGE_BANDS.map((a) => (
          <Pill
            key={a.value}
            active={filter.ageBand.includes(a.value)}
            onClick={() => toggle("ageBand", a.value)}
          >
            {a.label}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Gender">
        {genders.map((g) => (
          <Pill key={g} active={filter.gender.includes(g)} onClick={() => toggle("gender", g)}>
            {g}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Children <18">
        {(["yes", "no"] as const).map((v) => (
          <Pill
            key={v}
            active={filter.hasChildrenUnder18.includes(v)}
            onClick={() => toggle("hasChildrenUnder18", v)}
          >
            {v}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Caregiver">
        {(["yes", "no"] as const).map((v) => (
          <Pill
            key={v}
            active={filter.isCaregiver.includes(v)}
            onClick={() => toggle("isCaregiver", v)}
          >
            {v}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Recovery stage">
        {stages.map((s) => (
          <Pill
            key={s}
            active={filter.recoveryStage.includes(s)}
            onClick={() => toggle("recoveryStage", s)}
          >
            {s.length > 28 ? `${s.slice(0, 28)}…` : s}
          </Pill>
        ))}
      </FilterGroup>

      {anyActive && (
        <button
          type="button"
          onClick={resetFilter}
          className="ml-auto text-xs text-neutral-600 underline hover:text-neutral-900"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs uppercase tracking-wide text-neutral-500 mr-1">{label}</span>
      {children}
    </div>
  );
}
