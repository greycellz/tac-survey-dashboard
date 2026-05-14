"use client";

import { useSurveyData } from "@/contexts/SurveyDataContext";
import OpenResponsesClient from "./OpenResponsesClient";

export default function OpenResponsesPage() {
  const { filteredRespondents, filters } = useSurveyData();
  return <OpenResponsesClient respondents={filteredRespondents} filters={filters} />;
}
