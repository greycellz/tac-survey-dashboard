"use client";

import { Upload, Download, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSurveyData } from "@/contexts/SurveyDataContext";

export default function DashboardHeader() {
  const [exportOpen, setExportOpen] = useState(false);
  const { status, computedData, triggerUpload } = useSurveyData();

  const isLoading = status === "loading";
  const isLoaded = status === "loaded";

  return (
    <header
      className="sticky top-0 z-40 bg-card border-b border-border"
      style={{ height: "var(--header-height)" }}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-accent text-white font-semibold text-sm shrink-0">
            TAC
          </div>

          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-text-primary leading-tight">
              Wildfire Survivor Survey Dashboard
            </h1>
            <p className="text-xs text-text-muted mt-0.5 leading-none">
              Research Console&ensp;·&ensp;
              {isLoaded ? (
                <>
                  Dataset loaded&ensp;·&ensp;
                  <span className="text-text-secondary">N={computedData.N} respondents</span>
                </>
              ) : isLoading ? (
                <span className="text-accent">Processing dataset…</span>
              ) : (
                <span className="text-text-disabled">No dataset loaded</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={triggerUpload}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary border border-border rounded-md hover:bg-accent-light hover:text-accent hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {isLoading ? "Processing…" : isLoaded ? "Replace CSV" : "Upload CSV"}
          </button>

          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {exportOpen && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-md shadow-md z-[9999]">
                  {["Export CSV", "Export PNG", "Export PDF (soon)"].map((item) => (
                    <button
                      key={item}
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-accent-light hover:text-accent transition-colors first:rounded-t-md last:rounded-b-md"
                      onClick={() => setExportOpen(false)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
