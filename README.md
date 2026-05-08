# tac-survey-dashboard

Web app for analyzing **wildfire survivor survey CSV** exports (**The After Collective**): interactive dashboards, a **prepared-matrix codebook** with configurable composites, and **inferential exploratory tests** (Welch/MWU/Kruskal–Wallis/Pearson·Spearman/χ²/Fisher with within-family BH **q** values).

See **[DESIGN_AND_ARCHITECTURE.md](./DESIGN_AND_ARCHITECTURE.md)** for accomplishments, runtime architecture (providers, routing, dashboard vs inferential data paths), onboarding notes for builders/LLMs, and guidance on adding a **separate qualitative workspace** with **different datasources** in the **same deployed app**.

## Quick start

```bash
npm install
npm run dev
```

Opens **http://localhost:3000** (redirects to **`/dashboard/overview`**). Upload a survey CSV from the header; dashboards and **`/codebook`** / **`/inferential`** use the parsed cohort.

Production-style run:

```bash
npm run build && npm run start
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Vitest (survey inferential/featurize + qualitative transcript parser) |
| `npm run lint` | ESLint (Next preset) |
| `npm run qualitative:build-manifest` | Build **`data/qualitative/manifest.json`** from **`data/qualitative/transcripts/*.md`** |
| `npm run qualitative:test` | Vitest — **`scripts/qualitative/**/*.test.ts`** only |

**Inferential fixture references:** regenerate from the pinned CSV via R as described in [**scripts/README-fixture.md**](./scripts/README-fixture.md) (Docker-friendly on hosts without **Rscript**).

**Qualitative data layer** (interview VTT, optional **`notes.csv`**, manifest): see **[DESIGN_AND_ARCHITECTURE.md](./DESIGN_AND_ARCHITECTURE.md)** — *Qualitative interview workspace — data layer*.

## Repository map

| Path | Meaning |
|------|---------|
| `src/app/dashboard/*` | Descriptive KPI views (`compute.ts`) |
| `src/app/codebook` | Prepared matrix export + **`VariableDef`** + composite editors |
| `src/app/inferential` | **`runAllTests`** output + BH q + CSV export |
| `src/lib/csv-parser.ts` | CSV → **`SurveyRespondent`** |
| `src/lib/featurize.ts` | Prepared-wide matrix used by codebook/inferential |
| `src/lib/inferential.ts` | Statistical tests + **`adjustForFDR`** |
| `src/types/qualitative.ts` | Interview / manifest / citation types (data layer; no UI yet) |
| `scripts/qualitative/*` | WebVTT parser, notes loader, manifest builder ( **`npm run qualitative:*`** ) |
| `data/qualitative/transcripts/` | Interview **`INT###.md`** WebVTT files; **`manifest.json`** at **`data/qualitative/`** |

## Learn More (framework)

Built with [Next.js](https://nextjs.org)—see upstream docs for App Router deployment (e.g. Vercel).
