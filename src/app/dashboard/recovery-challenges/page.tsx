"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { CategoricalCompareBody } from "@/components/charts/ChartPlaceholder";
import LinkedResponseDrawer from "@/components/cards/LinkedResponseDrawer";
import EmbeddedResponseBrowser from "./EmbeddedResponseBrowser";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function RecoveryChallengesPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const { recoveryKPIs, challengingAreasResult } = computedData;

  const overwhelmingEntries = filteredRespondents
    .filter((r) => r.mostOverwhelming && r.mostOverwhelming.length > 20)
    .map((r) => ({ id: r.id, text: r.mostOverwhelming }));

  const helpfulEntries = filteredRespondents
    .filter((r) => r.mostHelpful && r.mostHelpful.length > 5)
    .map((r) => ({ id: r.id, text: r.mostHelpful }));

  const easierEntries = filteredRespondents
    .filter((r) => r.whatWouldHaveHelped && r.whatWouldHaveHelped.length > 10)
    .map((r) => ({ id: r.id, text: r.whatWouldHaveHelped }));

  return (
    <div>
      <PageHeader
        title="Recovery Challenges"
        description="What has been hardest, most overwhelming, and most helpful"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {recoveryKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-4">
        <SectionCard
          title="Since the fire, which areas have been most challenging? (Select up to 3)"
          type="multi-select"
          validN={challengingAreasResult.totalRespondents}
        >
          <p className="text-xs text-text-muted mb-3">
            % of {challengingAreasResult.totalRespondents} respondents who selected each area
          </p>
          <CategoricalCompareBody chartId={null} pooled={challengingAreasResult} pick={(d) => d.challengingAreasResult} showBreakdownTable={false} />
        </SectionCard>

        <SectionCard title="What has felt most overwhelming in your recovery process?" type="open-text" validN={overwhelmingEntries.length}>
          <EmbeddedResponseBrowser
            question="When you think about your recovery process so far, what has felt most overwhelming?"
            entries={overwhelmingEntries}
          />
        </SectionCard>

        <SectionCard title="Who or what has been most helpful in your recovery process?" type="open-text" validN={helpfulEntries.length}>
          <EmbeddedResponseBrowser
            question="Who or what has been most helpful in your recovery process?"
            entries={helpfulEntries}
          />
        </SectionCard>

        <SectionCard title="What would have made your recovery process easier?" type="open-text" validN={easierEntries.length}>
          <EmbeddedResponseBrowser
            question="What would have made your recovery process easier?"
            entries={easierEntries}
          />
        </SectionCard>
      </div>

      <LinkedResponseDrawer label="View all overwhelming responses" entries={overwhelmingEntries} />
    </div>
  );
}
