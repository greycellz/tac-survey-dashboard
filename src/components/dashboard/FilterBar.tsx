"use client";

import { ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { FilterState } from "@/types/survey";
import { DEFAULT_FILTER_STATE } from "@/types/survey";
import { AGE_BINS } from "@/lib/compute";
import { createPortal } from "react-dom";

const FILTER_CONFIGS: Array<{
  key: keyof FilterState;
  label: string;
  options: string[];
}> = [
  { key: "fire", label: "Fire", options: ["All", "Eaton Fire", "Palisade Fire"] },
  { key: "gender", label: "Gender", options: ["All", "Female", "Male", "Non-binary / another identity", "Prefer not to say"] },
  { key: "ageBand", label: "Age", options: ["All", ...AGE_BINS.map((b) => b.label)] },
  { key: "parent", label: "Parent", options: ["All", "Yes", "No"] },
  { key: "caregiver", label: "Caregiver", options: ["All", "Yes", "No"] },
  { key: "insurance", label: "Insurance", options: ["All", "Yes", "No", "Not sure"] },
  {
    key: "recoveryStage",
    label: "Recovery Stage",
    options: [
      "All",
      "Still trying to meet basic needs",
      "Actively rebuilding / navigating paperwork",
      "Re-settled but still dealing with emotional or financial impacts",
      "Feel mostly recovered",
      "Other",
    ],
  },
  {
    key: "displacement",
    label: "Displacement",
    options: ["All", "Not displaced", "Less than 1 month", "1–6 months", "6–12 months", "More than a year", "Still displaced"],
  },
  { key: "aiExperience", label: "AI Experience", options: ["All", "Yes", "No", "Not sure"] },
];

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  filteredN: number;
}

interface DropdownPosition {
  top: number;
  left: number;
}

function FilterChip({
  config,
  value,
  onToggle,
}: {
  config: (typeof FILTER_CONFIGS)[number];
  value: string;
  onToggle: (rect: DOMRect) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const isActive = value !== "All";

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => {
          if (btnRef.current) onToggle(btnRef.current.getBoundingClientRect());
        }}
        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
          isActive
            ? "bg-accent-light text-accent border-accent"
            : "text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
        }`}
      >
        {config.label}
        {isActive && (
          <span className="font-normal opacity-75 max-w-[80px] truncate">: {value}</span>
        )}
        <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
      </button>
    </div>
  );
}

export default function FilterBar({ filters, onFiltersChange, filteredN }: FilterBarProps) {
  const [openKey, setOpenKey] = useState<keyof FilterState | null>(null);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const activeCount = Object.values(filters).filter((v) => v !== "All").length;

  function handleToggle(key: keyof FilterState, rect: DOMRect) {
    if (openKey === key) {
      setOpenKey(null);
    } else {
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
      setOpenKey(key);
    }
  }

  function handleSelect(key: keyof FilterState, value: string) {
    onFiltersChange({ ...filters, [key]: value } as FilterState);
    setOpenKey(null);
  }

  function handleReset() {
    onFiltersChange(DEFAULT_FILTER_STATE);
    setOpenKey(null);
  }

  const openConfig = FILTER_CONFIGS.find((c) => c.key === openKey);

  return (
    <>
      <div
        className="sticky z-30 bg-card-alt border-b border-border"
        style={{ top: "var(--header-height)", height: "var(--filterbar-height)" }}
      >
        <div className="flex items-center gap-1.5 h-full px-6 overflow-x-auto">
          {FILTER_CONFIGS.map((config) => (
            <FilterChip
              key={config.key}
              config={config}
              value={filters[config.key]}
              onToggle={(rect) => handleToggle(config.key, rect)}
            />
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset + N */}
          <div className="flex items-center gap-3 shrink-0">
            {activeCount > 0 && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-3 h-3" />
                Reset filters
              </button>
            )}
            <span className="text-xs font-mono font-medium text-accent bg-accent-light px-2 py-1 rounded">
              N={filteredN}
            </span>
          </div>
        </div>
      </div>

      {/* Portal-rendered dropdown — always above all content */}
      {mounted && openKey && openConfig &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpenKey(null)}
            />
            {/* Menu */}
            <div
              className="fixed z-[9999] w-56 bg-card border border-border rounded-md shadow-lg py-1"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              {openConfig.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(openConfig.key, opt)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    filters[openConfig.key] === opt
                      ? "bg-accent-light text-accent font-medium"
                      : "text-text-secondary hover:bg-accent-light hover:text-accent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
