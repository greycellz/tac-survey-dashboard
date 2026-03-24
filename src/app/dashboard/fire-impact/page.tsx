"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { HorizontalBarChart, LikertChart } from "@/components/charts/ChartPlaceholder";
import BreakdownTable from "@/components/tables/BreakdownTable";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function FireImpactPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const {
    fireImpactKPIs,
    fireAffectedResult,
    fireImpactResult,
    insuranceAtTimeResult,
    insuranceClaimResult,
    insuranceSatisfactionResult,
    displacementResult,
    recoveryStageResult,
    claimFilersN,
  } = computedData;

  const recoveryOtherResponses = filteredRespondents
    .filter((r) => r.recoveryStage === "Other" && r.recoveryStageOther)
    .slice(0, 8)
    .map((r) => ({ id: r.id, text: r.recoveryStageOther! }));

  return (
    <div>
      <PageHeader
        title="Fire Impact & Recovery Status"
        description="Direct exposure, losses, insurance experience, and current recovery stage"
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {fireImpactKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Which fire(s) affected you most directly?" type="single-select" validN={fireAffectedResult.validN} missingN={fireAffectedResult.missingN}>
          <HorizontalBarChart data={fireAffectedResult.rows} />
          <div className="mt-3"><BreakdownTable rows={fireAffectedResult.rows} /></div>
        </SectionCard>

        <SectionCard title="How were you impacted by the fire? (check all that apply)" type="multi-select" validN={fireImpactResult.totalRespondents}>
          <p className="text-xs text-text-muted mb-3">
            Multi-select — % of {fireImpactResult.totalRespondents} respondents who selected each option
          </p>
          <HorizontalBarChart data={fireImpactResult.rows} maxPct={100} />
        </SectionCard>

        <SectionCard title="Did you have homeowners or renters insurance at the time?" type="single-select" validN={insuranceAtTimeResult.validN} missingN={insuranceAtTimeResult.missingN}>
          <HorizontalBarChart data={insuranceAtTimeResult.rows} />
          <div className="mt-3"><BreakdownTable rows={insuranceAtTimeResult.rows} /></div>
        </SectionCard>

        <SectionCard title="Have you filed an insurance claim?" type="single-select" validN={insuranceClaimResult.validN} missingN={insuranceClaimResult.missingN}>
          <HorizontalBarChart data={insuranceClaimResult.rows} />
          <div className="mt-3"><BreakdownTable rows={insuranceClaimResult.rows} /></div>
        </SectionCard>

        <SectionCard
          title="If yes, how satisfied are you with your insurance process so far?"
          type="likert"
          validN={insuranceSatisfactionResult.validN}
          missingN={insuranceSatisfactionResult.missingN}
          conditionalNote={`Conditional: applies to claim filers only (N=${claimFilersN})`}
        >
          <LikertChart result={insuranceSatisfactionResult} />
        </SectionCard>

        <SectionCard title="How long were you displaced from your home (if applicable)?" type="single-select" validN={displacementResult.validN} missingN={displacementResult.missingN}>
          <HorizontalBarChart data={displacementResult.rows} />
          <div className="mt-3"><BreakdownTable rows={displacementResult.rows} /></div>
        </SectionCard>

        <SectionCard title="What stage of recovery are you currently in?" type="single-select" validN={recoveryStageResult.validN} missingN={recoveryStageResult.missingN}>
          <HorizontalBarChart data={recoveryStageResult.rows} />
          <div className="mt-3"><BreakdownTable rows={recoveryStageResult.rows} /></div>
        </SectionCard>

        <SectionCard title="Recovery stage — Other responses" type="open-text" validN={recoveryOtherResponses.length}>
          <div className="space-y-2">
            {recoveryOtherResponses.length === 0 ? (
              <p className="text-xs text-text-muted italic">No other responses</p>
            ) : (
              recoveryOtherResponses.map(({ id, text }) => (
                <div key={id} className="flex gap-3 text-xs border-b border-border pb-2 last:border-0">
                  <span className="font-mono text-text-muted shrink-0">{id}</span>
                  <span className="text-text-secondary leading-relaxed">{text}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
