"use client";

import { Upload, AlertTriangle, Search } from "lucide-react";

type EmptyStateVariant = "pre-upload" | "parsing" | "no-results" | "error";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAction?: () => void;
  errorMessage?: string;
}

const CONFIG = {
  "pre-upload": {
    icon: Upload,
    title: "Upload a survey CSV to begin",
    description: "This dashboard will classify columns and generate analysis automatically.",
    action: "Upload CSV",
    iconColor: "text-accent",
  },
  parsing: {
    icon: null,
    title: "Processing dataset…",
    description: null,
    action: null,
    iconColor: "",
    steps: [
      "Detecting question types",
      "Mapping response categories",
      "Generating descriptive summaries",
    ],
  },
  "no-results": {
    icon: Search,
    title: "No responses match current filters",
    description: "Try clearing one or more filters to broaden the view.",
    action: "Reset Filters",
    iconColor: "text-text-muted",
  },
  error: {
    icon: AlertTriangle,
    title: "Could not parse CSV",
    description: "The file could not be read. Check that it is a valid survey export and try again.",
    action: "Try Again",
    iconColor: "text-amber-600",
  },
};

export default function EmptyState({ variant, onAction, errorMessage }: EmptyStateProps) {
  const config = CONFIG[variant];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="max-w-sm">
        {config.icon && (
          <div className={`flex justify-center mb-4 ${config.iconColor}`}>
            <config.icon className="w-10 h-10 opacity-60" />
          </div>
        )}

        {variant === "parsing" && (
          <div className="flex justify-center mb-4">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <h3 className="text-base font-semibold text-text-primary mb-2">{config.title}</h3>

        {config.description && (
          <p className="text-sm text-text-muted mb-4">{config.description}</p>
        )}

        {"steps" in config && config.steps && (
          <ul className="text-sm text-text-muted space-y-1 mb-4 text-left inline-block">
            {config.steps.map((step) => (
              <li key={step} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                {step}
              </li>
            ))}
          </ul>
        )}

        {variant === "error" && errorMessage && (
          <p className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4 text-left break-all">
            {errorMessage}
          </p>
        )}

        {config.action && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors"
          >
            {config.action}
          </button>
        )}
      </div>
    </div>
  );
}
