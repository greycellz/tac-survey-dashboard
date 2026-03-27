"use client";

import DashboardHeader from "./DashboardHeader";
import FilterBar from "./FilterBar";
import SideNav from "./SideNav";
import EmptyState from "@/components/ui/EmptyState";
import { useSurveyData } from "@/contexts/SurveyDataContext";
import { DEFAULT_FILTER_STATE } from "@/types/survey";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { filters, setFilters, filteredRespondents, status, error, triggerUpload } = useSurveyData();

  return (
    <div className="min-h-screen bg-bg">
      <DashboardHeader />
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        filteredN={status === "loaded" ? filteredRespondents.length : 0}
      />

      <div
        className="flex"
        style={{ minHeight: "calc(100vh - var(--header-height) - var(--filterbar-height))" }}
      >
        <SideNav />

        <main
          className="flex-1 overflow-y-auto"
          style={{ marginLeft: "var(--nav-width)" }}
        >
          <div className="max-w-[1400px] mx-auto px-8 py-7">
            {status === "empty" && (
              <EmptyState variant="pre-upload" onAction={triggerUpload} />
            )}
            {status === "loading" && (
              <EmptyState variant="parsing" />
            )}
            {status === "error" && (
              <EmptyState variant="error" errorMessage={error ?? undefined} onAction={triggerUpload} />
            )}
            {status === "loaded" && (
              filteredRespondents.length === 0 ? (
                <EmptyState variant="no-results" onAction={() => setFilters(DEFAULT_FILTER_STATE)} />
              ) : (
                <div id="dashboard-export-root">{children}</div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
