"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  QualitativeBundle,
  ValidatedCodedQuote,
  ParticipantId,
  CategoryKey,
  CodebookEntry,
  Demographics,
  ManifestEntry,
  QuoteId,
} from "@/types/qualitative";
import { makeQuoteId } from "@/types/qualitative";

// =====================================================================
// Filter shape — minimal demographics filter for MVP.
// =====================================================================

export type QualitativeFilter = {
  ageBand: ("under40" | "40to60" | "over60")[];
  gender: string[];
  hasChildrenUnder18: ("yes" | "no")[];
  isCaregiver: ("yes" | "no")[];
  recoveryStage: string[];
};

const EMPTY_FILTER: QualitativeFilter = {
  ageBand: [],
  gender: [],
  hasChildrenUnder18: [],
  isCaregiver: [],
  recoveryStage: [],
};

const CATEGORY_KEYS: CategoryKey[] = [
  "lifeAndRoutineChanges",
  "emotionalImpact",
  "recoveryChallengesAndPainPoints",
  "needsOverTime",
  "technologyForRecovery",
  "aiAttitudesAndBeliefs",
  "mvpFeedback",
  "crossCutting",
];

export type EnrichedQuote = ValidatedCodedQuote & {
  quoteId: QuoteId;
  participantId: ParticipantId;
  category: CategoryKey;
  codes: CodebookEntry[];
  demographics: Demographics | null;
};

type QualitativeContextValue = {
  bundle: QualitativeBundle;
  filter: QualitativeFilter;
  setFilter: (next: QualitativeFilter) => void;
  resetFilter: () => void;
  filteredQuotes: EnrichedQuote[];
  allQuotes: EnrichedQuote[];
  quotesByCode: (codeId: string) => EnrichedQuote[];
  quotesByCategory: (cat: CategoryKey) => EnrichedQuote[];
  quotesByParticipant: (id: ParticipantId) => EnrichedQuote[];
  participantIds: ParticipantId[];
  manifestEntry: (id: ParticipantId) => ManifestEntry | null;
  filteredParticipantIds: ParticipantId[];
};

const Ctx = createContext<QualitativeContextValue | null>(null);

function ageBandOf(age: number | null): "under40" | "40to60" | "over60" | null {
  if (age == null) return null;
  if (age < 40) return "under40";
  if (age <= 60) return "40to60";
  return "over60";
}

function passesFilter(d: Demographics | null, f: QualitativeFilter): boolean {
  if (!d) return true;
  if (f.ageBand.length > 0) {
    const band = ageBandOf(d.age);
    if (!band || !f.ageBand.includes(band)) return false;
  }
  if (f.gender.length > 0) {
    if (!d.gender || !f.gender.includes(d.gender)) return false;
  }
  if (f.hasChildrenUnder18.length > 0) {
    const v = d.hasChildrenUnder18 === true ? "yes" : d.hasChildrenUnder18 === false ? "no" : null;
    if (!v || !f.hasChildrenUnder18.includes(v)) return false;
  }
  if (f.isCaregiver.length > 0) {
    const v = d.isCaregiverForRelative === true ? "yes" : d.isCaregiverForRelative === false ? "no" : null;
    if (!v || !f.isCaregiver.includes(v)) return false;
  }
  if (f.recoveryStage.length > 0) {
    if (!d.recoveryStage || !f.recoveryStage.includes(d.recoveryStage)) return false;
  }
  return true;
}

export function QualitativeDataProvider({
  bundle,
  children,
}: {
  bundle: QualitativeBundle;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<QualitativeFilter>(EMPTY_FILTER);

  const allQuotes: EnrichedQuote[] = useMemo(() => {
    const out: EnrichedQuote[] = [];
    const codeMap = new Map(bundle.codebook.entries.map((e) => [e.id, e]));
    for (const entry of bundle.manifest.entries) {
      const ext = bundle.extractions[entry.id];
      if (!ext) continue;
      for (const cat of CATEGORY_KEYS) {
        const arr = ext.codedQuotes[cat];
        const cueCounter = new Map<number, number>();
        for (const q of arr) {
          const cueNum = q.citation.cueNumber;
          const idx = cueCounter.get(cueNum) ?? 0;
          cueCounter.set(cueNum, idx + 1);
          const quoteId = makeQuoteId(entry.id, cueNum, idx);
          const codes = q.codeIds
            .map((id) => codeMap.get(id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c));
          out.push({
            ...q,
            quoteId,
            participantId: entry.id,
            category: cat,
            codes,
            demographics: entry.demographics,
          });
        }
      }
    }
    return out;
  }, [bundle]);

  const filteredQuotes = useMemo(
    () => allQuotes.filter((q) => passesFilter(q.demographics, filter)),
    [allQuotes, filter],
  );

  const filteredParticipantIds = useMemo(() => {
    const uniq = new Set(filteredQuotes.map((q) => q.participantId));
    return Array.from(uniq).sort();
  }, [filteredQuotes]);

  const quotesByCode = (codeId: string) => filteredQuotes.filter((q) => q.codeIds.includes(codeId));
  const quotesByCategory = (cat: CategoryKey) => filteredQuotes.filter((q) => q.category === cat);
  const quotesByParticipant = (id: ParticipantId) => filteredQuotes.filter((q) => q.participantId === id);

  const participantIds = bundle.manifest.entries.map((e) => e.id);
  const manifestEntry = (id: ParticipantId) => bundle.manifest.entries.find((e) => e.id === id) ?? null;

  const value: QualitativeContextValue = {
    bundle,
    filter,
    setFilter,
    resetFilter: () => setFilter(EMPTY_FILTER),
    filteredQuotes,
    allQuotes,
    quotesByCode,
    quotesByCategory,
    quotesByParticipant,
    participantIds,
    manifestEntry,
    filteredParticipantIds,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQualitativeData(): QualitativeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQualitativeData must be used inside QualitativeDataProvider");
  return ctx;
}
