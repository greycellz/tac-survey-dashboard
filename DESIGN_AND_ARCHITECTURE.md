# TAC Survey Dashboard — Design, Architecture & Onboarding

This document summarizes what the application does today, how it is structured, and how to extend it (including a future **qualitative workspace** backed by **different datasources**) while staying in the **same deployed Next.js app**.

---

## What this product is

A **research console** for analyzing **wildfire survivor survey** CSV exports (**The After Collective**). Operators upload respondent-level CSVs in the browser; the app parses rows into **`SurveyRespondent`**, drives **interactive dashboards**, a **prepared-matrix codebook**, and **exploratory inferential statistics** with **multiple-comparison adjustment** inside defined families.

No server-side persistence of respondent data for analysis: ingestion is **client-side** (`File` → parser → React state).

---

## Accomplishments (current capabilities)

These are intentionally high-level—use source files named below for specifics.

### Ingestion & survey layer

- **CSV upload** (global **`SurveyDataProvider`**) with parsing into **`SurveyRespondent[]`** aligned with **`src/lib/csv-parser.ts`** (`COL` mappings and multiselect rules).
- **Filters** on core dimensions (fire, gender, age band, parent/caregiver, insurance-at-time flags, recovery stage, displacement, prior AI exposure, etc.).
- **Compare-by** slicing for dashboards when enabled (see **`src/lib/compare.ts`** + subgroup **`computeAll`**).

### Dashboards (“Analysis” sidebar)

Routes under **`/dashboard/*`** (see **`SideNav.tsx`**) including overview, demographics, fire impact, recovery challenges, wellbeing, resource access, AI attitudes, **open-ended text** views (**`/dashboard/open-responses`**), tables/export, PNG/PDF/export flows where wired.

Derived analytics come from **`src/lib/compute.ts`** (**`ComputedData`** / KPI-style structures), not from the inferential **`featurize`** matrix—see “Two tracks” below.

### Codebook & prepared features

- **`/codebook`**: **`featurize.ts`** builds a wide **numeric/binary/ordinal matrix** plus **variable definitions** (**`VariableDef`**), observed multiselect vocabularies, and **composite warnings**.
- User-configurable **composites**: total loss / any damage / **exposure tier** / **access barrier** / **AI emotional-support interest** / **health impact** (fire-impact options) / **financial strain** (`challengingAreas` wording). Persisted **per respondent-set fingerprint** in **`localStorage`** with merge against **`DEFAULT_COMPOSITES`** (**`FeatureContext.tsx`**).

### Inferential exploration

- **`/inferential`**: **`runAllTests`** in **`src/lib/inferential.ts`** on the **filtered prepared matrix**.
- Families: **.correlations**, **Welch/MWU + omnibus Welch ANOVA & Kruskal–Wallis** where specified, **χ² / Fisher (2×2)**; **Benjamini–Hochberg q** computed **within** each family (**`adjustForFDR`**).
- **Claim-filers-only** **`insurance_satisfaction_num`** outcomes with explicit UI methodology note (**`INSURANCE_SATISFACTION_METHODS_NOTE`**).

### Regression / parity harness

- **Vitest** + **`src/lib/__tests__/fixtures/*`**: fixed **20-row canonical matrix**, **R-generated golden JSON** (**`inferential-references.json`**) via **`scripts/generate-inferential-fixture-references.R`**, **`INS_SAT_NUM` ↔ CSV column parity test** documented in **`scripts/README-fixture.md`**.

---

## Tech stack

| Layer        | Choice                          |
|-------------|----------------------------------|
| Framework    | Next.js **14 App Router**, React **18**, TypeScript |
| Styling      | Tailwind CSS                    |
| Tables/csv in browser | **Papa Parse** (`csv-parser.ts`) |
| Stats        | **jStat** (wrapped in **`jstat-imports.ts`**) |
| Testing      | **Vitest**, **happy-dom**       |

---

## Runtime architecture

```mermaid
flowchart TB
  subgraph root [Root layout]
    R[layout.tsx]
    ASP[AppSurveyProvider]
    R --> ASP
  end

  subgraph survey [Survey state tree]
    SDP[SurveyDataContext]
    ASP --> SDP
    SDP -->|"parseCSV"| SR[SurveyRespondent array]
    SDP -->|"filters"| FR[filteredRespondents]
    FR --> KPI[compute.ts dashboards]
    FR -->|"codebook/inferential only"| FEAT[FeatureContext]
    FEAT -->|"featurize"| MAT[Prepared matrix + schema]
    MAT --> INF[inferential.ts]
  end

  subgraph routes [Route groups]
    D["/dashboard/*"]
    CB["/codebook"]
    INF[ "/inferential" ]
    SDP --> D
    SDP --> CB
    SDP --> INF
    FEAT --> CB
    FEAT --> INF
  end
```

### Two analytic tracks (do not confuse them)

| Track | Consumers | Derived from | Purpose |
|--------|-----------|----------------|----------|
| **Dashboard analytics** | `compute.ts`, chart components under `/dashboard/*` | Raw **`SurveyRespondent`** (+ filters/compare) | Descriptive KPIs, distributions, segmented views |
| **Prepared matrix / inferential** | `featurize.ts`, **`/codebook`**, **`/inferential`** | **`SurveyRespondent`** filtered + **composite config** | Codebook consistency, scripted contrasts, reproducible **`TestResult`** list |

Changing Likert/binary rules in **`featurize.ts`** without updating **`compute.ts`** (or vice versa) can drift meaning—coordinate both when altering field semantics.

### Provider boundaries

| Provider | Wrapped by | Holds |
|-----------|-------------|-------|
| **`SurveyDataProvider`** | **`AppSurveyProvider`** wrapping **all** pages in **`layout.tsx`** | Upload CSV, **`allRespondents`**, **`filters`**, **`compareBy`**, **`computedData`**, status/error |
| **`FeatureProvider`** | Layouts **`codebook`** and **`inferential` only** (not **`/dashboard`**) | **`composites`**, **`featurize` bundle**, localStorage keyed by respondent fingerprint |

**Implication**: hooks **`useSurveyData`** work everywhere; **`useFeatureBundle`** only inside codebook/inferential trees (already wrapped).

### Navigation shell

**`DashboardShell`**: fixed header (**upload CSV**, aggregates), **`FilterBar`**, **`SideNav`**, scrollable **`main`**; empty parsing/error states centralized.

---

## Project layout (map for readers)

```
src/app/                 # Routes (App Router)
  dashboard/*/page.tsx   # Descriptive views
  codebook/               # Prepared matrix / codebook UI
  inferential/           # Statistical test cards + CSV export

src/contexts/
  SurveyDataContext.tsx   # Canonical survey row store
  FeatureContext.tsx     # Prepared features + composites

src/lib/
  csv-parser.ts          # COLUMN → respondent fields (inspect COL before edits)
  compute.ts             # LIKERT_CONFIGS & dashboard KPIs
  featurize.ts           # Prepared matrix VariableDef schema
  inferential.ts         # runAllTests, FDR helpers
  compare.ts             # Compare-by slicing

src/types/survey.ts      # SurveyRespondent, FilterState, etc.

scripts/                  # R/TS/Python reference generators — see README-fixture.md

src/lib/__tests__/fixtures/  # Canonical matrix + inferential golden JSON (Vitest)
```

---

## Operational flow (today)

1. User opens **`/` → `/dashboard/overview`**.
2. **Upload CSV** → **`parseCSV`** → **`SurveyDataProvider`** resets filters to defaults.
3. **`computeAll(filteredRespondents)`** recomputes dashboard datasets.
4. Visiting **`/codebook`** / **`inferential`** runs **`featurize`**: **observed vocabularies and reference distributions use the full uploaded sample** (**`allRespondents`**); **`VariableDef`/schema reflects full-sample stats** while the **`matrix`** row list matches **current filters** (**`filteredRespondents`**)—see **`featurize.ts`** exports.

---

## Onboarding checklist (humans & LLMs)

1. **`src/types/survey.ts`** — actual **`SurveyRespondent`** fields and option strings.
2. **`src/lib/csv-parser.ts`** — **`COL`**, multiselect fields, **`normalizeNumericLabel`**, normalization rules (**do not invent field names**).
3. **`LIKERT_CONFIGS`** in **`compute.ts`** — shared scales reused by **`featurize`** for ordinal mapping.
4. **`featurize.ts`** — composites, **`insurance_satisfaction_num`** (claim-filers rule), **`rowValues`** vs **`buildSchema`**.
5. **`inferential.ts`** — test IDs (**`runAllTests`** output**)**, skip reasons, **`adjustForFDR`** family enum.
6. **`SideNav.tsx`** — add new routes in one place.

When adding fields: update **parser → types → compute (if surfaced in UI) → featurize (if in matrix/tests)** and extend fixtures + R refs if inferential assertions apply.

---

## Qualitative interview workspace — data layer (foundations)

This layer is **orthogonal to the survey path** (no **`SurveyDataProvider`** coupling). UI under **`/qualitative/*`** is deferred.

| Artifact | Path / command |
|----------|------------------|
| Shared types | **`src/types/qualitative.ts`** |
| VTT parser | **`scripts/qualitative/parse-transcript.ts`** — supports **`\-\-\>`** and Zoom **`\--\>`**; speaker heuristic: numeric label ⇒ participant, else interviewer. |
| Notes loader | **`scripts/qualitative/load-notes.ts`** — optional **`data/qualitative/notes.csv`**. |
| Manifest | **`npm run qualitative:build-manifest`** → **`data/qualitative/manifest.json`**. |
| Transcripts | **`data/qualitative/transcripts/INT###.md`**. |
| Tests | **`npm run qualitative:test`**. |

---

## Future: qualitative analysis (different datasources)

**Goal**: Host **another mode of analysis**—e.g. interview transcripts, focus groups, or codings—in the **same web app / deployment**, with **orthogonal data** from the quantitative CSV cohort.

### Recommended separation

Follow the existing **provider/route-group boundary** pattern instead of stuffing qualitative state into **`SurveyDataContext`**.

| Concern | Suggested direction |
|---------|---------------------|
| **State** | New **`QualitativeDataProvider`** (or domain-specific names) owning corpus metadata, uploads, tagging, thematic models, etc.—**no **`SurveyRespondent`** overlap** unless an explicit keyed link (`submissionId`) is a product requirement. |
| **Routes** | New segment **`/qualitative/*`** or **`/workspace/qualitative/*`** under **`src/app`** with **own `layout.tsx`** that mounts only **`QualitativeDataProvider`** (and optionally a shared **`AppShell`** without survey filters). Avoid mixing survey **`FilterBar`** unless filters are generalized to multi-source. |
| **Navigation** | Either a **second group** under **`SideNav`** (“Quantitative survey” vs “Qualitative”) or **`SideNav`** refactored to accept **workspace prop** via layout context; alternatively a coarse **landing switch** at `/`. |
| **Upload** | Separate file input & parsers (TXT/JSON/CSV of codes). Do **not** reuse **`SurveyDataProvider.uploadCSV`** without clear UX that the user is switching “mode.” |
| **Deployment** | Single Next bundle; optional **lazy `dynamic`/route-based code splitting** for heavy qualitative libs. |

### Shared vs isolated UI

Reusable primitives: **`PageHeader`**, typography / Tailwind tokens, generic tables, dialogs. Prefer **copying DashboardShell sparingly**: qualitative pages may omit **`FilterBar`** and **survey-specific header stats**—extract a **`ShellLayout`** (header slots + sidebar) when duplication hurts.

---

## Related documents

| File | Role |
|------|------|
| **`README.md`** | Repo entry, scripts, pointers here |
| **`scripts/README-fixture.md`** | Regenerating **`inferential-references.json`**, **`INS_SAT_NUM` / CSV** alignment |
