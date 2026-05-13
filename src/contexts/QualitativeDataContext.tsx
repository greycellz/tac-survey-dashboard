"use client";

import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from "react";
import type {
  QualitativeBundle,
  ValidatedCodedQuote,
  ParticipantId,
  CategoryKey,
  CodebookEntry,
  Demographics,
  ManifestEntry,
  QuoteId,
  QuoteAffect,
  EmotionId,
  AffectFingerprint,
  ResearcherNotesSummary,
  ResearcherNoteCategoryKey,
} from "@/types/qualitative";
import { makeQuoteId } from "@/types/qualitative";
import { QUALITATIVE_CATEGORY_KEYS } from "@/lib/qualitative/category-keys";

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

export type EnrichedCodedQuote = ValidatedCodedQuote & {
  source: "coded";
  quoteId: QuoteId;
  participantId: ParticipantId;
  category: CategoryKey;
  codes: CodebookEntry[];
  demographics: Demographics | null;
};

export type EnrichedUncodedQuote = {
  source: "uncoded";
  quoteId: QuoteId;
  participantId: ParticipantId;
  category: CategoryKey;
  citation: ValidatedCodedQuote["citation"];
  quoteVerbatim: string;
  note: string;
  codeIds: [];
  codes: [];
  demographics: Demographics | null;
};

export type EnrichedQuote = EnrichedCodedQuote | EnrichedUncodedQuote;

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
  affectByQuote: (quoteId: string) => QuoteAffect | null;
  affectByCode: (codeId: string) => AffectFingerprint;
  fingerprintForQuotes: (quotes: EnrichedQuote[]) => AffectFingerprint;
  fingerprintsByParticipant: Record<string, AffectFingerprint>;
  affectVocabulary: QualitativeBundle["affectVocabulary"];
  researcherNotesByParticipant: (id: ParticipantId) => ResearcherNotesSummary | null;
  fullResearcherNotesByParticipant: (id: ParticipantId) => Partial<Record<ResearcherNoteCategoryKey, string>>;
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
    if (!d.recoveryStage || !d.recoveryStage.includes(d.recoveryStage)) return false;
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
      const cueCounter = new Map<number, number>();
      for (const cat of QUALITATIVE_CATEGORY_KEYS) {
        const arr = ext.codedQuotes[cat];
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
            source: "coded",
            quoteId,
            participantId: entry.id,
            category: cat,
            codes,
            demographics: entry.demographics,
          });
        }
      }
      for (const obs of ext.uncodedObservationsValidated ?? []) {
        const cueNum = obs.citation.cueNumber;
        const idx = cueCounter.get(cueNum) ?? 0;
        cueCounter.set(cueNum, idx + 1);
        const quoteId = makeQuoteId(entry.id, cueNum, idx);
        out.push({
          source: "uncoded",
          quoteId,
          participantId: entry.id,
          category: obs.category,
          citation: obs.citation,
          quoteVerbatim: obs.citation.quoteVerbatim,
          note: obs.note,
          codeIds: [],
          codes: [],
          demographics: entry.demographics,
        });
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

  const quotesByCode = (codeId: string) =>
    filteredQuotes.filter((q) => q.source === "coded" && q.codeIds.includes(codeId));
  const quotesByCategory = (cat: CategoryKey) => filteredQuotes.filter((q) => q.category === cat);
  const quotesByParticipant = (id: ParticipantId) => filteredQuotes.filter((q) => q.participantId === id);

  const participantIds = useMemo(() => bundle.manifest.entries.map((e) => e.id), [bundle.manifest.entries]);
  const manifestEntry = (id: ParticipantId) => bundle.manifest.entries.find((e) => e.id === id) ?? null;

  const affectByQuoteId = useMemo(() => {
    const map = new Map<string, QuoteAffect>();
    for (const file of Object.values(bundle.affect)) {
      if (!file) continue;
      for (const a of file.annotations) map.set(a.quoteId, a);
    }
    return map;
  }, [bundle]);

  const affectByQuote = (quoteId: string) => affectByQuoteId.get(quoteId) ?? null;

  const fingerprintForQuotes = useCallback(
    (quotes: EnrichedQuote[]): AffectFingerprint => {
      const counts = Object.fromEntries(bundle.affectVocabulary.emotions.map((e) => [e.id, 0])) as Record<
        EmotionId,
        number
      >;
      let intensitySum = 0;
      let stanceSum = 0;
      let n = 0;
      for (const q of quotes) {
        const a = affectByQuoteId.get(q.quoteId);
        if (!a) continue;
        counts[a.primaryEmotion]++;
        intensitySum += a.intensity;
        stanceSum += a.stance;
        n++;
      }
      return {
        n,
        emotionCounts: counts,
        meanIntensity: n > 0 ? intensitySum / n : 0,
        meanStance: n > 0 ? stanceSum / n : 0,
      };
    },
    [affectByQuoteId, bundle.affectVocabulary.emotions],
  );

  const affectByCode = (codeId: string) => fingerprintForQuotes(quotesByCode(codeId));

  const fingerprintsByParticipant = useMemo(() => {
    const map: Record<string, AffectFingerprint> = {};
    for (const id of participantIds) {
      map[id] = fingerprintForQuotes(filteredQuotes.filter((q) => q.participantId === id));
    }
    return map;
  }, [filteredQuotes, participantIds, fingerprintForQuotes]);

  const researcherNotesByParticipant = (id: ParticipantId) => bundle.researcherNotes.summaries[id] ?? null;

  const fullResearcherNotesByParticipant = (id: ParticipantId) => bundle.researcherNotes.fullNotes[id] ?? {};

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
    affectByQuote,
    affectByCode,
    fingerprintForQuotes,
    fingerprintsByParticipant,
    affectVocabulary: bundle.affectVocabulary,
    researcherNotesByParticipant,
    fullResearcherNotesByParticipant,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQualitativeData(): QualitativeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQualitativeData must be used inside QualitativeDataProvider");
  return ctx;
}
