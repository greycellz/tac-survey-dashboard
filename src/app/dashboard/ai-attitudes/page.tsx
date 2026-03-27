"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { HorizontalBarChart, LikertChart } from "@/components/charts/ChartPlaceholder";
import LinkedResponseDrawer from "@/components/cards/LinkedResponseDrawer";
import EmbeddedResponseBrowser from "../recovery-challenges/EmbeddedResponseBrowser";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function AIAttitudesPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const {
    aiKPIs,
    priorAIUseResult,
    aiInterestResult,
    aiComfortResult,
    aiToolInterestsResult,
    aiConcernsResult,
    humanHelperResult,
  } = computedData;

  const aiOneThingEntries = filteredRespondents
    .filter((r) => r.aiOneThingText && r.aiOneThingText.length > 10)
    .map((r) => ({ id: r.id, text: r.aiOneThingText }));

  const aiOtherEntries = filteredRespondents
    .filter((r) => r.anythingElse && r.anythingElse.length > 20)
    .slice(0, 15)
    .map((r) => ({ id: r.id, text: r.anythingElse }));

  return (
    <div>
      <PageHeader title="AI Attitudes & Opportunity" description="Openness to AI support, comfort, concerns, and desired AI use cases" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {aiKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-4">
        <SectionCard title="Have you ever used an AI tool or chatbot before?" type="single-select" validN={priorAIUseResult.validN} missingN={priorAIUseResult.missingN}>
          <HorizontalBarChart data={priorAIUseResult.rows} />
          <div className="mt-3"><div className="mt-3" /></div>
        </SectionCard>

        <SectionCard title="How interested would you be in using an AI chatbot as part of your fire recovery process?" type="single-select" validN={aiInterestResult.validN} missingN={aiInterestResult.missingN}>
          <HorizontalBarChart data={aiInterestResult.rows} />
        </SectionCard>

        <SectionCard title="How comfortable would you feel using an AI-powered Disaster Recovery Coach?" type="likert" validN={aiComfortResult.validN} missingN={aiComfortResult.missingN}>
          <LikertChart result={aiComfortResult} />
        </SectionCard>

        <SectionCard title="How important is it to you that a human helper is available alongside an AI tool?" type="likert" validN={humanHelperResult.validN} missingN={humanHelperResult.missingN}>
          <LikertChart result={humanHelperResult} />
        </SectionCard>

        <SectionCard title="Interest in AI tools (select any that apply)" type="multi-select" validN={aiToolInterestsResult.totalRespondents}>
          <p className="text-xs text-text-muted mb-3">Ranked by selection frequency</p>
          <HorizontalBarChart data={aiToolInterestsResult.rows} />
        </SectionCard>

        <SectionCard title="What concerns, if any, do you have about using AI for disaster recovery or emotional support?" type="multi-select" validN={aiConcernsResult.totalRespondents}>
          <p className="text-xs text-text-muted mb-3">Ranked by frequency</p>
          <HorizontalBarChart data={aiConcernsResult.rows} />
        </SectionCard>

        <SectionCard title="If an AI coach could help you with one thing in your fire recovery right now, what would it be?" type="open-text" validN={aiOneThingEntries.length}>
          <EmbeddedResponseBrowser
            question="If an AI coach could help you with one thing in your fire recovery right now, what would it be?"
            entries={aiOneThingEntries}
          />
        </SectionCard>

        <SectionCard title="Is there anything else you'd like to share about your experience or ideas?" type="open-text" validN={aiOtherEntries.length}>
          <EmbeddedResponseBrowser
            question="Is there anything else you'd like to share about your experience?"
            entries={aiOtherEntries}
          />
        </SectionCard>
      </div>

      <LinkedResponseDrawer label="View all 'one thing AI could help' responses" entries={aiOneThingEntries} />
    </div>
  );
}
