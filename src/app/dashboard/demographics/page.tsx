"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import {
  CategoricalCompareBody,
  HistogramCompareBody,
} from "@/components/charts/ChartPlaceholder";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function DemographicsPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const {
    demographicsKPIs,
    ageResult,
    genderResult,
    childrenResult,
    caregiverResult,
    petResult,
    livingSituationResult,
  } = computedData;

  const livingOtherResponses = filteredRespondents
    .filter((r) => r.livingSituation === "Other" && r.livingSituationOther)
    .map((r) => ({ id: r.id, text: r.livingSituationOther! }));

  return (
    <div>
      <PageHeader
        title="Demographics & Household"
        description="Basic respondent composition and household context"
      />

      <div className="grid grid-cols-5 gap-4 mb-6">
        {demographicsKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="What is your age?" type="numeric" validN={ageResult.validN} missingN={ageResult.missingN}>
          <HistogramCompareBody pick={(d) => d.ageResult} />
        </SectionCard>

        <SectionCard title="What is your gender?" type="single-select" validN={genderResult.validN} missingN={genderResult.missingN}>
          <CategoricalCompareBody chartId="gender" pooled={genderResult} pick={(d) => d.genderResult} />
        </SectionCard>

        <SectionCard title="Do you have children under the age of 18?" type="single-select" validN={childrenResult.validN} missingN={childrenResult.missingN}>
          <CategoricalCompareBody chartId="children" pooled={childrenResult} pick={(d) => d.childrenResult} />
        </SectionCard>

        <SectionCard title="Are you a caregiver for a relative with a disability or health condition?" type="single-select" validN={caregiverResult.validN} missingN={caregiverResult.missingN}>
          <CategoricalCompareBody chartId="caregiver" pooled={caregiverResult} pick={(d) => d.caregiverResult} />
        </SectionCard>

        <SectionCard title="Are you currently caring for a pet?" type="single-select" validN={petResult.validN} missingN={petResult.missingN}>
          <CategoricalCompareBody chartId={null} pooled={petResult} pick={(d) => d.petResult} />
        </SectionCard>

        <SectionCard title="How would you describe your current living situation?" type="single-select" validN={livingSituationResult.validN} missingN={livingSituationResult.missingN}>
          <CategoricalCompareBody chartId={null} pooled={livingSituationResult} pick={(d) => d.livingSituationResult} />
        </SectionCard>

        <SectionCard title="Living situation — Other responses" type="open-text" validN={livingOtherResponses.length} wide>
          <div className="space-y-2">
            {livingOtherResponses.length === 0 ? (
              <p className="text-xs text-text-muted italic">No other responses</p>
            ) : (
              livingOtherResponses.map(({ id, text }) => (
                <div key={id} className="flex gap-3 text-xs border-b border-border pb-2 last:border-0">
                  <span className="font-mono text-text-muted shrink-0">{id}</span>
                  <span className="text-text-secondary">{text}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
