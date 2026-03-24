"use client";

import { useMemo } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SectionCard from "@/components/cards/SectionCard";
import { HorizontalBarChart, LikertChart } from "@/components/charts/ChartPlaceholder";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function OverviewPage() {
  const { computedData, filteredRespondents } = useSurveyData();
  const {
    overviewKPIs,
    genderResult,
    livingSituationResult,
    childrenResult,
    caregiverResult,
    petResult,
    challengingAreasResult,
    displacementResult,
    recoveryStageResult,
    wellbeingResult,
    aiInterestResult,
    aiComfortResult,
    claimFilersN,
    ageResult,
    N,
  } = computedData;


  const soughtSupportPct = useMemo(() => {
    const n = filteredRespondents.filter((r) => r.mentalHealthSupport.startsWith("Yes")).length;
    return N > 0 ? `${Math.round((n / N) * 100)}%` : "—";
  }, [filteredRespondents, N]);

  const wantSupportPct = useMemo(() => {
    const n = filteredRespondents.filter((r) => r.mentalHealthSupport === "No, but I would like to").length;
    return N > 0 ? `${Math.round((n / N) * 100)}%` : "—";
  }, [filteredRespondents, N]);

  const poorWBPct = useMemo(() => {
    const n = filteredRespondents.filter((r) => r.wellbeing === "Very poor" || r.wellbeing === "Poor").length;
    return N > 0 ? `${Math.round((n / N) * 100)}%` : "—";
  }, [filteredRespondents, N]);

  const humanHelperPct = useMemo(() => {
    const n = filteredRespondents.filter(
      (r) => r.humanHelperImportance === "Moderately important" || r.humanHelperImportance === "Very important"
    ).length;
    return N > 0 ? `${Math.round((n / N) * 100)}%` : "—";
  }, [filteredRespondents, N]);

  const usedAIPct = useMemo(() => {
    const n = filteredRespondents.filter((r) => r.usedAI === "Yes").length;
    return N > 0 ? `${Math.round((n / N) * 100)}%` : "—";
  }, [filteredRespondents, N]);

  const childrenPct = useMemo(() => {
    const row = childrenResult.rows.find((r) => r.label === "Yes");
    return row ? `${Math.round(row.pct)}%` : "—";
  }, [childrenResult]);

  const caregiverPct = useMemo(() => {
    const row = caregiverResult.rows.find((r) => r.label === "Yes");
    return row ? `${Math.round(row.pct)}%` : "—";
  }, [caregiverResult]);

  const petPct = useMemo(() => {
    const row = petResult.rows.find((r) => r.label === "Yes");
    return row ? `${Math.round(row.pct)}%` : "—";
  }, [petResult]);

  // Shorten living situation labels for the compact overview chart
  const livingSituationShort = livingSituationResult.rows.map((r) => ({
    ...r,
    label: r.label
      .replace("In temporary housing (rental, hotel, trailer, etc.)", "Temporary housing")
      .replace("In my rebuilt or original home", "Rebuilt / original home")
      .replace("Living with family/friends", "With family/friends")
      .replace("Unhoused/unstable housing", "Unhoused/unstable"),
  }));

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Snapshot of sample characteristics, burden, wellbeing, and AI openness"
      />

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {overviewKPIs.map((kpi) => (
          <StatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Main cards grid */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Sample Profile */}
        <SectionCard title="Sample Profile" type="single-select" validN={N}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Gender</p>
              <HorizontalBarChart data={genderResult.rows} />
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-text-muted mb-2">Living situation</p>
              <HorizontalBarChart data={livingSituationShort} />
            </div>
            <div className="flex gap-6 text-xs text-text-muted pt-1 border-t border-border">
              <span>With children: <span className="text-text-primary font-medium">{childrenPct}</span></span>
              <span>Caregiver: <span className="text-text-primary font-medium">{caregiverPct}</span></span>
              <span>Has pet: <span className="text-text-primary font-medium">{petPct}</span></span>
            </div>
          </div>
        </SectionCard>

        {/* Recovery Burden */}
        <SectionCard title="Recovery Burden" type="multi-select" validN={N}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Top challenging areas</p>
              <HorizontalBarChart data={challengingAreasResult.rows.slice(0, 5)} />
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-text-muted mb-2">Displacement status</p>
              <HorizontalBarChart data={displacementResult.rows} />
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-text-muted mb-2">Recovery stage</p>
              <HorizontalBarChart data={recoveryStageResult.rows} />
            </div>
          </div>
        </SectionCard>

        {/* Wellbeing Snapshot */}
        <SectionCard title="Wellbeing Snapshot" type="likert" validN={wellbeingResult.validN}>
          <LikertChart result={wellbeingResult} />
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-xs">
            <div className="text-center">
              <p className="text-text-muted">Sought support</p>
              <p className="text-xl font-mono font-semibold text-text-primary mt-1">{soughtSupportPct}</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted">Want support</p>
              <p className="text-xl font-mono font-semibold text-text-primary mt-1">{wantSupportPct}</p>
            </div>
            <div className="text-center">
              <p className="text-text-muted">Poor/very poor</p>
              <p className="text-xl font-mono font-semibold text-text-primary mt-1">{poorWBPct}</p>
            </div>
          </div>
        </SectionCard>

        {/* AI Opportunity Snapshot */}
        <SectionCard title="AI Opportunity Snapshot" type="single-select" validN={N}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Interest in AI chatbot for recovery</p>
              <HorizontalBarChart data={aiInterestResult.rows} />
            </div>
            <div className="border-t border-border pt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-text-muted mb-1">Mean AI comfort</p>
                <p className="text-2xl font-mono font-semibold text-text-primary">
                  {aiComfortResult.mean.toFixed(1)}{" "}
                  <span className="text-sm font-normal text-text-muted">/ 5</span>
                </p>
                <p className="text-text-muted text-[11px] mt-0.5">1=Very uncomfortable</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">Human helper important</p>
                <p className="text-2xl font-mono font-semibold text-text-primary">{humanHelperPct}</p>
                <p className="text-text-muted text-[11px] mt-0.5">Moderately or Very important</p>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-text-muted mb-1">Used AI before</p>
              <p className="text-base font-mono font-semibold text-text-primary">
                {usedAIPct}{" "}
                <span className="text-text-muted text-xs font-sans font-normal">yes</span>
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Research Notes */}
      <SectionCard title="Research Notes / Data Quality" wide>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Sample notes</p>
            <ul className="space-y-1.5 text-text-secondary text-xs">
              <li>• Dataset reflects N={N} respondents</li>
              <li>• {genderResult.rows.find((r) => r.label === "Female")?.pct.toFixed(0) ?? "—"}% female, ages {ageResult.min}–{ageResult.max} (mean {ageResult.mean.toFixed(1)})</li>
              <li>• {fireResult(computedData)} Eaton Fire, {palisadeResult(computedData)} Palisade Fire</li>
              <li>• Over-representation of homeowners vs. renters possible</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Missingness</p>
            <ul className="space-y-1.5 text-text-secondary text-xs">
              <li>• Insurance satisfaction: valid N={claimFilersN} (conditional on claim filers)</li>
              <li>• Age: {ageResult.missingN} missing value{ageResult.missingN !== 1 ? "s" : ""}</li>
              <li>• All open-text fields have high completion rates (&gt;90%)</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Future analysis</p>
            <ul className="space-y-1.5 text-text-secondary text-xs">
              <li>• Subgroup comparisons by fire, housing, and recovery stage pending</li>
              <li>• NLP theme extraction from open text not yet implemented</li>
              <li>• Inferential statistics and significance testing not yet applied</li>
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Helpers to avoid verbose inline expressions ──────────────────────────────
import type { ComputedData } from "@/lib/compute";

function fireResult(d: ComputedData): string {
  const row = d.fireAffectedResult.rows.find((r) => r.label === "Eaton Fire");
  return row ? `${Math.round(row.pct)}%` : "—";
}
function palisadeResult(d: ComputedData): string {
  const row = d.fireAffectedResult.rows.find((r) => r.label === "Palisade Fire");
  return row ? `${Math.round(row.pct)}%` : "—";
}
