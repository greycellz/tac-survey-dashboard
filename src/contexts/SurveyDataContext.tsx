"use client";

import { createContext, useContext, useState, useMemo, useRef, type ReactNode } from "react";
import type { SurveyRespondent, FilterState, CompareBy, SubgroupSlice } from "@/types/survey";
import { DEFAULT_FILTER_STATE } from "@/types/survey";
import { parseCSV } from "@/lib/csv-parser";
import { computeAll, type ComputedData } from "@/lib/compute";
import { splitByCompareDimension } from "@/lib/compare";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataStatus = "empty" | "loading" | "loaded" | "error";

interface SurveyDataContextValue {
  allRespondents: SurveyRespondent[];
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  filteredRespondents: SurveyRespondent[];
  computedData: ComputedData;
  compareBy: CompareBy;
  setCompareBy: (c: CompareBy) => void;
  /** Non-empty subgroups when compare active; empty when `compareBy === "none"`. */
  compareSubgroups: SubgroupSlice[];
  /** `computeAll` per `compareSubgroups` row; `null` when not comparing. */
  computedBySubgroup: ComputedData[] | null;
  /** True when compare is on but fewer than two subgroups have respondents (often due to filters). */
  compareNonInformative: boolean;
  status: DataStatus;
  error: string | null;
  uploadCSV: (file: File) => void;
  triggerUpload: () => void; // opens the file picker imperatively
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// ─── Empty computed placeholder (before any CSV is loaded) ───────────────────

const EMPTY_COMPUTED = computeAll([]);

// ─── Context ──────────────────────────────────────────────────────────────────

const SurveyDataContext = createContext<SurveyDataContextValue | null>(null);

export function useSurveyData(): SurveyDataContextValue {
  const ctx = useContext(SurveyDataContext);
  if (!ctx) throw new Error("useSurveyData must be used inside SurveyDataProvider");
  return ctx;
}

// ─── Filter logic ─────────────────────────────────────────────────────────────

function applyFilters(respondents: SurveyRespondent[], filters: FilterState): SurveyRespondent[] {
  return respondents.filter((r) => {
    if (filters.fire !== "All" && r.fireAffected !== filters.fire) return false;
    if (filters.gender !== "All" && r.gender !== filters.gender) return false;
    if (filters.parent !== "All") {
      const want = filters.parent === "Yes";
      if (r.hasChildren !== want) return false;
    }
    if (filters.caregiver !== "All") {
      const want = filters.caregiver === "Yes";
      if (r.isCaregiver !== want) return false;
    }
    if (filters.insurance !== "All" && r.hadInsurance !== filters.insurance) return false;
    if (filters.recoveryStage !== "All" && r.recoveryStage !== filters.recoveryStage) return false;
    if (filters.displacement !== "All" && r.displacementDuration !== filters.displacement) return false;
    if (filters.aiExperience !== "All" && r.usedAI !== filters.aiExperience) return false;
    return true;
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SurveyDataProvider({ children }: { children: ReactNode }) {
  const [allRespondents, setAllRespondents] = useState<SurveyRespondent[]>([]);
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [compareBy, setCompareByState] = useState<CompareBy>("none");
  const [status, setStatus] = useState<DataStatus>("empty");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredRespondents = useMemo(
    () => applyFilters(allRespondents, filters),
    [allRespondents, filters]
  );

  const computedData = useMemo(() => computeAll(filteredRespondents), [filteredRespondents]);

  const compareSubgroups = useMemo(
    () => (compareBy === "none" ? [] : splitByCompareDimension(filteredRespondents, compareBy)),
    [filteredRespondents, compareBy]
  );

  const computedBySubgroup = useMemo(() => {
    if (compareBy === "none" || compareSubgroups.length === 0) return null;
    return compareSubgroups.map((s) => computeAll(s.respondents));
  }, [compareBy, compareSubgroups]);

  const compareNonInformative =
    compareBy !== "none" && compareSubgroups.filter((s) => s.n > 0).length <= 1;

  function setFilters(f: FilterState) {
    setFiltersState(f);
  }

  function setCompareBy(c: CompareBy) {
    setCompareByState(c);
  }

  async function uploadCSV(file: File) {
    setStatus("loading");
    setError(null);

    const { respondents, errors } = await parseCSV(file);

    if (respondents.length === 0) {
      setError(errors[0] ?? "No valid rows found in the CSV.");
      setStatus("error");
      return;
    }

    setAllRespondents(respondents);
    setFiltersState(DEFAULT_FILTER_STATE); // reset filters on new upload
    setCompareByState("none");
    setStatus("loaded");

    if (errors.length > 0) {
      console.warn("CSV parse warnings:", errors);
    }
  }

  function triggerUpload() {
    fileInputRef.current?.click();
  }

  return (
    <SurveyDataContext.Provider
      value={{
        allRespondents,
        filters,
        setFilters,
        filteredRespondents,
        computedData: status === "loaded" ? computedData : EMPTY_COMPUTED,
        compareBy,
        setCompareBy,
        compareSubgroups,
        computedBySubgroup: status === "loaded" ? computedBySubgroup : null,
        compareNonInformative,
        status,
        error,
        uploadCSV,
        triggerUpload,
        fileInputRef,
      }}
    >
      {/* Hidden file input — triggered imperatively from DashboardHeader */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            uploadCSV(file);
            e.target.value = ""; // allow re-uploading the same file
          }
        }}
      />
      {children}
    </SurveyDataContext.Provider>
  );
}
