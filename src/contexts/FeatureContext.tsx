"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CompositeConfig } from "@/lib/featurize";
import { DEFAULT_COMPOSITES, featurize, type FeatureBundle } from "@/lib/featurize";
import { useSurveyData } from "@/contexts/SurveyDataContext";

interface FeatureContextValue {
  bundle: FeatureBundle;
  composites: CompositeConfig;
  setComposites: (c: CompositeConfig) => void;
}

const FeatureCtx = createContext<FeatureContextValue | null>(null);

export function useFeatureBundle(): FeatureContextValue {
  const v = useContext(FeatureCtx);
  if (!v) throw new Error("useFeatureBundle must be used inside FeatureProvider");
  return v;
}

export function FeatureProvider({ children }: { children: ReactNode }) {
  const { allRespondents, filteredRespondents } = useSurveyData();
  const [composites, setComposites] = useState<CompositeConfig>(DEFAULT_COMPOSITES);

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

  return (
    <FeatureCtx.Provider value={{ bundle, composites, setComposites }}>{children}</FeatureCtx.Provider>
  );
}
