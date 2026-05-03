"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CompositeConfig } from "@/lib/featurize";
import { DEFAULT_COMPOSITES, featurize, type FeatureBundle } from "@/lib/featurize";
import { useSurveyData } from "@/contexts/SurveyDataContext";
import type { SurveyRespondent } from "@/types/survey";

interface FeatureContextValue {
  bundle: FeatureBundle;
  composites: CompositeConfig;
  setComposites: (c: CompositeConfig) => void;
}

const FeatureCtx = createContext<FeatureContextValue | null>(null);

function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function fingerprintRespondents(rows: SurveyRespondent[]): string {
  if (!rows.length) return "empty";

  /** Header-like signature: stable fields that change when CSV changes materially. */
  const subs = [...rows.map((r) => r.submissionNum)].sort((a, b) => a - b);
  const signature = `${rows.length}:${subs.slice(0, 6).join(",")}:${subs.slice(-6).join(",")}`;

  const vocabBits: string[] = [];
  const collect = (field: keyof SurveyRespondent, label: string) => {
    const set = new Set<string>();
    for (const r of rows) {
      const xs = r[field];
      if (Array.isArray(xs)) xs.forEach((x) => typeof x === "string" && x.trim() && set.add(x.trim()));
    }
    vocabBits.push(`${label}:${Array.from(set).sort().join("|")}`);
  };

  collect("fireImpacts", "fi");
  collect("supportBarriers", "sb");
  collect("aiToolInterests", "ait");
  collect("challengingAreas", "ca");

  return fnv1a32(`${signature}##${vocabBits.join(";")}`);
}

export function useFeatureBundle(): FeatureContextValue {
  const v = useContext(FeatureCtx);
  if (!v) throw new Error("useFeatureBundle must be used inside FeatureProvider");
  return v;
}

export function FeatureProvider({ children }: { children: ReactNode }) {
  const { allRespondents, filteredRespondents } = useSurveyData();
  const fingerprint = useMemo(() => fingerprintRespondents(allRespondents), [allRespondents]);

  const [composites, setComposites] = useState<CompositeConfig>(() => DEFAULT_COMPOSITES);
  const [persistReady, setPersistReady] = useState(false);

  const bundle = useMemo((): FeatureBundle => {
    if (allRespondents.length === 0) {
      return {
        schema: [],
        matrix: [],
        observedMultiSelectOptions: {},
        warnings: ["No respondent data uploaded."],
      };
    }
    return featurize(allRespondents, filteredRespondents, composites);
  }, [allRespondents, filteredRespondents, composites]);

  useEffect(() => {
    setPersistReady(false);
    if (typeof window === "undefined") return;
    if (!allRespondents.length) {
      setComposites(DEFAULT_COMPOSITES);
      setPersistReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(`tac-composites:v1:${fingerprint}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CompositeConfig>;
        const ok =
          parsed &&
          typeof parsed === "object" &&
          parsed.totalLoss &&
          parsed.anyDamage &&
          parsed.exposureTier &&
          parsed.accessBarrier &&
          parsed.aiEmoSupport;
        if (ok) {
          setComposites({
            ...DEFAULT_COMPOSITES,
            ...parsed,
            exposureTier: { ...DEFAULT_COMPOSITES.exposureTier, ...(parsed.exposureTier ?? {}) },
            totalLoss: { ...DEFAULT_COMPOSITES.totalLoss, ...(parsed.totalLoss ?? {}) },
            anyDamage: { ...DEFAULT_COMPOSITES.anyDamage, ...(parsed.anyDamage ?? {}) },
            accessBarrier: { ...DEFAULT_COMPOSITES.accessBarrier, ...(parsed.accessBarrier ?? {}) },
            aiEmoSupport: { ...DEFAULT_COMPOSITES.aiEmoSupport, ...(parsed.aiEmoSupport ?? {}) },
            healthImpact: { ...DEFAULT_COMPOSITES.healthImpact, ...(parsed.healthImpact ?? {}) },
            financialStrain: { ...DEFAULT_COMPOSITES.financialStrain, ...(parsed.financialStrain ?? {}) },
          });
        } else {
          setComposites(DEFAULT_COMPOSITES);
        }
      } else {
        setComposites(DEFAULT_COMPOSITES);
      }
    } catch {
      setComposites(DEFAULT_COMPOSITES);
    } finally {
      setPersistReady(true);
    }
  }, [fingerprint, allRespondents.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!persistReady) return;
    if (!allRespondents.length) {
      window.localStorage.removeItem(`tac-composites:v1:${fingerprint}`);
      return;
    }

    window.localStorage.setItem(`tac-composites:v1:${fingerprint}`, JSON.stringify(composites));
  }, [composites, fingerprint, allRespondents.length, persistReady]);

  return (
    <FeatureCtx.Provider value={{ bundle, composites, setComposites }}>{children}</FeatureCtx.Provider>
  );
}
