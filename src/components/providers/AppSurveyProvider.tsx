"use client";

import { SurveyDataProvider } from "@/contexts/SurveyDataContext";
import type { ReactNode } from "react";

/** Global survey state — must wrap all routes that read `useSurveyData` (dashboard, codebook, inferential). */
export default function AppSurveyProvider({ children }: { children: ReactNode }) {
  return <SurveyDataProvider>{children}</SurveyDataProvider>;
}
