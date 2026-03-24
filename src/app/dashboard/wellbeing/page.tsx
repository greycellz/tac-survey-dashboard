"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { HorizontalBarChart, LikertChart } from "@/components/charts/ChartPlaceholder";
import LinkedResponseDrawer from "@/components/cards/LinkedResponseDrawer";
import EmbeddedResponseBrowser from "../recovery-challenges/EmbeddedResponseBrowser";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function WellbeingPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const {
    wellbeingKPIs,
    wellbeingResult,
    mentalHealthSupportResult,
    supportBarriersResult,
  } = computedData;

  const copingEntries = filteredRespondents
    .filter((r) => r.copingStrategies && r.copingStrategies.length > 10)
    .map((r) => ({ id: r.id, text: r.copingStrategies }));

  return (
    <div>
      <PageHeader title="Wellbeing & Support" description="Emotional wellbeing, support-seeking, barriers, and coping" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {wellbeingKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-4">
        <SectionCard title="How would you describe your emotional wellbeing right now?" type="likert" validN={wellbeingResult.validN} missingN={wellbeingResult.missingN}>
          <LikertChart result={wellbeingResult} />
        </SectionCard>

        <SectionCard title="Have you sought any emotional or mental health support since the fire?" type="single-select" validN={mentalHealthSupportResult.validN} missingN={mentalHealthSupportResult.missingN}>
          <p className="text-xs text-text-muted mb-3">
            Original categories preserved — no collapsing of yes/no options
          </p>
          <HorizontalBarChart data={mentalHealthSupportResult.rows} />
        </SectionCard>

        <SectionCard title="What barriers make it hard to get emotional or mental health support?" type="multi-select" validN={supportBarriersResult.totalRespondents}>
          <p className="text-xs text-text-muted mb-3">
            Multi-select — barriers remain as independent options
          </p>
          <HorizontalBarChart data={supportBarriersResult.rows} maxPct={100} />
        </SectionCard>

        <SectionCard title="How do you currently cope with stress or difficult emotions?" type="open-text" validN={copingEntries.length}>
          <EmbeddedResponseBrowser
            question="How do you currently cope with stress or difficult emotions?"
            entries={copingEntries}
          />
        </SectionCard>
      </div>

      <LinkedResponseDrawer label="View all coping strategy responses" entries={copingEntries} />
    </div>
  );
}
