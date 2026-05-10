# Regenerating inferential reference JSON (Brief 3 / WS1C)

Golden values in `src/lib/__tests__/fixtures/inferential-references.json` are produced from the fixed fixture CSV by R (`stats`), using the same test definitions as `scripts/generate-inferential-fixture-references.R` (Welch \(t\) / `wilcox.test(exact=FALSE, correct=FALSE)` / Pearson & Spearman `cor.test(..., exact=FALSE)`, `oneway.test(var.equal=FALSE)`, `kruskal.test`, `chisq.test(correct=FALSE)`, `fisher.test`).

## One command (from repo root)

**Preferred (R is canonical):**

```bash
Rscript scripts/generate-inferential-fixture-references.R
```

When R is unavailable, regenerate with the same formulas as `src/lib/inferential.ts`:

```bash
npx tsx scripts/generate-inferential-references.ts
```

Prerequisites:

- `R` on `PATH`.
- CRAN package `jsonlite` (install once inside R: `install.packages("jsonlite")`).

The script reads `src/lib/__tests__/fixtures/inferential-fixture.csv` and writes `src/lib/__tests__/fixtures/inferential-references.json`. Commit both the CSV and JSON when changing the canonical fixture matrix (that should be rare).

## Pearson `statistic` in JSON equals `r`, matching `inferential.ts` / Vitest assertions (not `cor.test`'s Student `t`; R script keeps `pearson.statistic_t_student` alongside when regenerated from R).

## Note on CSV vs dashboard matrix

Vitest converts `fire_eaton` / `fire_palisade` to `is_eaton` / `is_palisade` in TypeScript (`fixtureMatrix()`). R analyses use the CSV column names as in the Brief.

**Brief 4 insurance columns:** `had_insurance`, `filed_claim`, and `insurance_satisfaction_num` document claim status; blanks/NA in `insurance_satisfaction_num` denote non–claim-filers or missing ratings. R uses `!is.na(insurance_satisfaction_num)` for A4/A5/B9 parity. TS adds `INS_SAT_NUM` in `inferential-fixture.ts` so `fixtureMatrix()` matches the CSV column.

## Notes on aligning Vitest with R output

**Mann–Whitney / Wilcoxon:** References include R’s `$statistic` from `wilcox.test`. The dashboard uses summed ranks for the predictor’s level-0 group; with `exact=FALSE, correct=FALSE` the asymptotic **p** is what we tighten against R, not the raw `W` label.

**Fisher (C1/C2):** Two-sided **p** is asserted vs `fisher.test`. Odds ratios and CIs follow different implementations (conditional MLE in R vs Haldane + log-envelope in this app)—tests intentionally do not gold-check OR vs R while `inferential.ts` stays as-is.

## Repo context

Higher-level runtime architecture (providers, dashboards vs inferential path, onboarding): root [**DESIGN_AND_ARCHITECTURE.md**](../DESIGN_AND_ARCHITECTURE.md).
