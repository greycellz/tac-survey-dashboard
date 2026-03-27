"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Upload, Download, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useSurveyData } from "@/contexts/SurveyDataContext";
import {
  exportElementAsPdf,
  exportElementAsPng,
  exportFilteredRespondentsCsv,
  getDashboardExportRoot,
} from "@/lib/export-view";

function buildExportBasename(pathname: string): string {
  const slug = pathname.replace(/^\//, "").replace(/\//g, "-") || "dashboard";
  const date = new Date().toISOString().slice(0, 10);
  return `tac-survey-${slug}-${date}`;
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const { status, computedData, filteredRespondents, triggerUpload } = useSurveyData();

  const isLoading = status === "loading";
  const isLoaded = status === "loaded";
  const canExport = isLoaded && filteredRespondents.length > 0;

  const runExport = useCallback(
    async (kind: "csv" | "png" | "pdf") => {
      if (!canExport) return;
      const base = buildExportBasename(pathname);
      setExportBusy(true);
      setExportOpen(false);
      try {
        if (kind === "csv") {
          exportFilteredRespondentsCsv(filteredRespondents, `${base}.csv`);
          return;
        }
        const root = getDashboardExportRoot();
        if (!root) {
          throw new Error("Export region not found. Try navigating to an analysis page.");
        }
        if (kind === "png") {
          await exportElementAsPng(root, `${base}.png`);
        } else {
          await exportElementAsPdf(root, `${base}.pdf`);
        }
      } catch (e) {
        console.error(e);
        window.alert(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setExportBusy(false);
      }
    },
    [canExport, filteredRespondents, pathname]
  );

  return (
    <header
      className="sticky top-0 z-40 bg-card border-b border-border"
      style={{ height: "var(--header-height)" }}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/logo-black.png"
              alt="The After Collective"
              fill
              className="object-contain object-left"
              sizes="40px"
              priority
            />
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
            type="button"
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
              type="button"
              onClick={() => canExport && !exportBusy && setExportOpen((v) => !v)}
              disabled={!canExport || exportBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {exportBusy ? "Exporting…" : "Export"}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {exportOpen && !exportBusy && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setExportOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-md z-[9999] py-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-accent-light hover:text-accent transition-colors rounded-t-md"
                    onClick={() => runExport("csv")}
                  >
                    Export CSV (filtered)
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-accent-light hover:text-accent transition-colors"
                    onClick={() => runExport("png")}
                  >
                    Export PNG (this page)
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-accent-light hover:text-accent transition-colors rounded-b-md"
                    onClick={() => runExport("pdf")}
                  >
                    Export PDF (this page)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
