"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { CategoricalCompareBody, LikertCompareBody } from "@/components/charts/ChartPlaceholder";
import BreakdownTable from "@/components/tables/BreakdownTable";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function ResourceAccessPage() {
  const { computedData, compareBy } = useSurveyData();
  const {
    resourceKPIs,
    helpNeededResult,
    infoEaseResult,
    infoSourcesResult,
    preferredChannelResult,
  } = computedData;

  const showCompareCharts =
    compareBy !== "none";

  return (
    <div>
      <PageHeader title="Resource Access & Needs" description="Practical support needs, information access, and preferred delivery modes" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {resourceKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <SectionCard title="Which types of help do you most need right now? (Select all that apply)" type="multi-select" validN={helpNeededResult.totalRespondents}>
          <p className="text-xs text-text-muted mb-3">
            {showCompareCharts
              ? "% of respondents in each subgroup who selected each option"
              : `% of ${helpNeededResult.totalRespondents} respondents`}
          </p>
          <CategoricalCompareBody chartId={null} pooled={helpNeededResult} pick={(d) => d.helpNeededResult} showBreakdownTable={false} />
        </SectionCard>

        <SectionCard title="How easy has it been to find accurate and up-to-date information about available resources?" type="likert" validN={infoEaseResult.validN} missingN={infoEaseResult.missingN}>
          <LikertCompareBody pick={(d) => d.infoEaseResult} />
        </SectionCard>

        <SectionCard title="Where do you usually look for assistance, guidance, or information?" type="multi-select" validN={infoSourcesResult.totalRespondents}>
          <CategoricalCompareBody chartId={null} pooled={infoSourcesResult} pick={(d) => d.infoSourcesResult} showBreakdownTable={false} />
          {!showCompareCharts ? (
            <div className="mt-3">
              <BreakdownTable rows={infoSourcesResult.rows} />
            </div>
          ) : (
            <p className="text-xs text-text-muted mt-3 italic">Subgroup bars above; pooled frequency table omitted in compare mode.</p>
          )}
        </SectionCard>

        <SectionCard title="How would you prefer to receive support or information?" type="multi-select" validN={preferredChannelResult.totalRespondents}>
          <CategoricalCompareBody chartId={null} pooled={preferredChannelResult} pick={(d) => d.preferredChannelResult} showBreakdownTable={false} />
          {!showCompareCharts ? (
            <div className="mt-3">
              <BreakdownTable rows={preferredChannelResult.rows} />
            </div>
          ) : (
            <p className="text-xs text-text-muted mt-3 italic">Subgroup bars above; pooled frequency table omitted in compare mode.</p>
          )}
        </SectionCard>
      </div>

      <div className="border border-dashed border-border rounded-lg p-5 text-xs text-text-muted">
        <p className="font-medium text-text-secondary mb-1">Design & Intervention Notes</p>
        <p>This page is important for service design. Space reserved for annotations, intervention hypotheses, and subgroup comparisons once full dataset is parsed.</p>
      </div>
    </div>
  );
}
