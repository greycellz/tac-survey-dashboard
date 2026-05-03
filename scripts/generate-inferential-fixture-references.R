# scripts/generate-inferential-fixture-references.R
# Regenerate with: Rscript scripts/generate-inferential-fixture-references.R
# Output: src/lib/__tests__/fixtures/inferential-references.json
#
# Run from tac-survey-dashboard repo root.

suppressPackageStartupMessages({
  library(jsonlite)
})

csv_path <- "src/lib/__tests__/fixtures/inferential-fixture.csv"
stopifnot(file.exists(csv_path))
df <- read.csv(csv_path, na.strings = c("", "NA"))

cohens_d_pooled <- function(x, y) {
  n1 <- length(x)
  n2 <- length(y)
  if (n1 < 2 || n2 < 2) return(list(d = NA_real_, lo = NA_real_, hi = NA_real_))
  m1 <- mean(x)
  m2 <- mean(y)
  v1 <- stats::var(x)
  v2 <- stats::var(y)
  sp <- sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
  if (!is.finite(sp) || sp <= 0) return(list(d = NA_real_, lo = NA_real_, hi = NA_real_))
  d <- (m1 - m2) / sp
  # Hedges–Olkin style normal CI (matches dashboard note)
  se <- sqrt((n1 + n2) / (n1 * n2) + d * d / (2 * (n1 + n2)))
  z <- 1.96
  list(d = unname(d), lo = unname(d - z * se), hi = unname(d + z * se))
}

welch_t <- function(formula, data) {
  res <- stats::t.test(formula, data = data, var.equal = FALSE)
  mf <- stats::model.frame(stats::formula(formula), data = data, na.action = stats::na.pass)
  yv <- mf[[1]]
  gv <- mf[[2]]
  ok <- stats::complete.cases(yv, gv)
  yv <- yv[ok]
  gv <- gv[ok]
  ul <- sort(unique(gv))
  cd <- cohens_d_pooled(yv[gv == ul[[1]]], yv[gv == ul[[2]]])
  list(
    statistic = unname(res$statistic),
    df = unname(res$parameter),
    p = unname(res$p.value),
    mean_group_0 = unname(res$estimate[1]),
    mean_group_1 = unname(res$estimate[2]),
    ci_low = unname(res$conf.int[1]),
    ci_high = unname(res$conf.int[2]),
    cohens_d = cd$d,
    cohens_d_ci_low = cd$lo,
    cohens_d_ci_high = cd$hi
  )
}

mwu <- function(formula, data) {
  res <- stats::wilcox.test(formula, data = data, exact = FALSE, correct = FALSE)
  list(statistic = unname(res$statistic), p = unname(res$p.value))
}

cor_pair <- function(x, y) {
  pe <- stats::cor.test(x, y, method = "pearson")
  sp <- stats::cor.test(x, y, method = "spearman", exact = FALSE, continuity = FALSE)
  r_pearson <- unname(pe$estimate)
  list(
    pearson = list(
      # Matches dashboard TestResult Pearson `statistic` (r); `cor.test` also returns Student t separately.
      statistic = r_pearson,
      df = unname(pe$parameter),
      p = unname(pe$p.value),
      estimate = r_pearson,
      statistic_t_student = unname(pe$statistic),
      ci_low = unname(pe$conf.int[1]),
      ci_high = unname(pe$conf.int[2])
    ),
    spearman = list(rho = unname(sp$estimate), p = unname(sp$p.value))
  )
}

oneway_welch <- function(formula, data) {
  res <- stats::oneway.test(formula, data = data, var.equal = FALSE)
  list(
    statistic = unname(res$statistic),
    num_df = unname(res$parameter[1]),
    denom_df = unname(res$parameter[2]),
    p = unname(res$p.value)
  )
}

kw <- function(formula, data) {
  res <- stats::kruskal.test(formula, data = data)
  list(statistic = unname(res$statistic), df = unname(res$parameter), p = unname(res$p.value))
}

chisq2 <- function(tbl) {
  tblm <- matrix(as.vector(tbl), nrow = nrow(tbl), ncol = ncol(tbl))
  rownames(tblm) <- NULL
  colnames(tblm) <- NULL
  res <- suppressWarnings(stats::chisq.test(tblm, correct = FALSE))
  v <- sqrt(unname(res$statistic) / (sum(tblm) * (min(dim(tblm)) - 1)))
  list(
    statistic = unname(res$statistic),
    df = unname(res$parameter),
    p = unname(res$p.value),
    cramers_v = unname(v),
    table = tblm
  )
}

fisher2x2 <- function(tbl) {
  res <- stats::fisher.test(tbl)
  list(
    p = unname(res$p.value),
    or = unname(res$estimate),
    ci_low = unname(res$conf.int[1]),
    ci_high = unname(res$conf.int[2])
  )
}

# Family A: Correlations -------------------------------------------------
df_ins <- subset(df, !is.na(insurance_satisfaction_num))

family_A <- list(
  A1_age_ai_comfort = cor_pair(df$age, df$ai_comfort_num),
  A2_age_ai_interest = cor_pair(df$age, df$ai_interest_num),
  A3_age_human_helper = cor_pair(df$age, df$human_helper_importance_num),
  A4_age_ins_sat = cor_pair(df_ins$age, df_ins$insurance_satisfaction_num),
  A5_wb_ins_sat = cor_pair(df_ins$wellbeing_num, df_ins$insurance_satisfaction_num)
)

# Family B ----------------------------------------------------------------
gender_subset <- subset(df, is_female == 1 | is_male == 1)
fire_subset <- subset(df, fire_eaton == 1 | fire_palisade == 1)
dfs_claim <- subset(df, !is.na(insurance_satisfaction_num))
fire_subset_ins <- subset(fire_subset, !is.na(insurance_satisfaction_num))

family_B <- list(
  B1a_aic_by_gender = list(
    welch = welch_t(ai_comfort_num ~ is_female, gender_subset),
    mwu = mwu(ai_comfort_num ~ is_female, gender_subset)
  ),
  B1b_aii_by_gender = list(
    welch = welch_t(ai_interest_num ~ is_female, gender_subset),
    mwu = mwu(ai_interest_num ~ is_female, gender_subset)
  ),
  B2a_aic_by_fire = list(
    welch = welch_t(ai_comfort_num ~ fire_eaton, fire_subset),
    mwu = mwu(ai_comfort_num ~ fire_eaton, fire_subset)
  ),
  B2b_aii_by_fire = list(
    welch = welch_t(ai_interest_num ~ fire_eaton, fire_subset),
    mwu = mwu(ai_interest_num ~ fire_eaton, fire_subset)
  ),
  B3a_aic_by_TL = list(
    welch = welch_t(ai_comfort_num ~ totalLoss, df),
    mwu = mwu(ai_comfort_num ~ totalLoss, df)
  ),
  B3b_aii_by_TL = list(welch = welch_t(ai_interest_num ~ totalLoss, df), mwu = mwu(ai_interest_num ~ totalLoss, df)),
  B3c_aic_by_aD = list(
    welch = welch_t(ai_comfort_num ~ anyDamage, df),
    mwu = mwu(ai_comfort_num ~ anyDamage, df)
  ),
  B3d_aii_by_aD = list(
    welch = welch_t(ai_interest_num ~ anyDamage, df),
    mwu = mwu(ai_interest_num ~ anyDamage, df)
  ),
  B3e_aic_by_eT = list(
    anova = oneway_welch(ai_comfort_num ~ factor(exposureTier), df),
    kw = kw(ai_comfort_num ~ factor(exposureTier), df)
  ),
  B3f_aii_by_eT = list(
    anova = oneway_welch(ai_interest_num ~ factor(exposureTier), df),
    kw = kw(ai_interest_num ~ factor(exposureTier), df)
  ),
  B4a_aic_by_hC = list(welch = welch_t(ai_comfort_num ~ has_children, df), mwu = mwu(ai_comfort_num ~ has_children, df)),
  B4b_aii_by_hC = list(
    welch = welch_t(ai_interest_num ~ has_children, df),
    mwu = mwu(ai_interest_num ~ has_children, df)
  ),
  B5a_aic_by_iCg = list(
    welch = welch_t(ai_comfort_num ~ is_caregiver, df),
    mwu = mwu(ai_comfort_num ~ is_caregiver, df)
  ),
  B5b_aii_by_iCg = list(
    welch = welch_t(ai_interest_num ~ is_caregiver, df),
    mwu = mwu(ai_interest_num ~ is_caregiver, df)
  ),
  B6a_aic_by_pAI = list(
    welch = welch_t(ai_comfort_num ~ prior_ai_use, df),
    mwu = mwu(ai_comfort_num ~ prior_ai_use, df)
  ),
  B6b_aii_by_pAI = list(
    welch = welch_t(ai_interest_num ~ prior_ai_use, df),
    mwu = mwu(ai_interest_num ~ prior_ai_use, df)
  ),
  B9a_ins_by_TL = list(
    welch = welch_t(insurance_satisfaction_num ~ totalLoss, dfs_claim),
    mwu = mwu(insurance_satisfaction_num ~ totalLoss, dfs_claim)
  ),
  B9b_ins_by_aD = list(
    welch = welch_t(insurance_satisfaction_num ~ anyDamage, dfs_claim),
    mwu = mwu(insurance_satisfaction_num ~ anyDamage, dfs_claim)
  ),
  B9c_ins_by_fire = list(
    welch = welch_t(insurance_satisfaction_num ~ fire_eaton, fire_subset_ins),
    mwu = mwu(insurance_satisfaction_num ~ fire_eaton, fire_subset_ins)
  ),
  B9_ins_by_eT = list(
    anova = oneway_welch(insurance_satisfaction_num ~ factor(exposureTier), dfs_claim),
    kw = kw(insurance_satisfaction_num ~ factor(exposureTier), dfs_claim)
  ),
  B7_wb_by_aES = list(welch = welch_t(wellbeing_num ~ ai_emo_support, df), mwu = mwu(wellbeing_num ~ ai_emo_support, df)),
  B8_age_by_aMH = list(welch = welch_t(age ~ any_mh_util, df), mwu = mwu(age ~ any_mh_util, df))
)

# Family C ----------------------------------------------------------------
tab_C1 <- table(df$any_mh_util, df$ai_emo_support)
tab_C2 <- table(df$accessBarrier, df$ai_emo_support)
tab_C3a <- table(df$any_mh_util, df$totalLoss)
tab_C3b <- table(df$any_mh_util, df$anyDamage)
tab_C3c <- table(df$any_mh_util, df$exposureTier)

family_C <- list(
  C1_aMH_x_aES = list(chisq = chisq2(tab_C1), fisher = fisher2x2(tab_C1)),
  C2_aB_x_aES = list(chisq = chisq2(tab_C2), fisher = fisher2x2(tab_C2)),
  C3a_aMH_x_TL = list(chisq = chisq2(tab_C3a), fisher = fisher2x2(tab_C3a)),
  C3b_aMH_x_aD = list(chisq = chisq2(tab_C3b), fisher = fisher2x2(tab_C3b)),
  C3c_aMH_x_eT = list(chisq = chisq2(tab_C3c))
)

out_json <- list(
  generated_by = "scripts/generate-inferential-fixture-references.R",
  r_version = R.version.string,
  family_A = family_A,
  family_B = family_B,
  family_C = family_C
)

out_path <- "src/lib/__tests__/fixtures/inferential-references.json"
writeLines(toJSON(out_json, auto_unbox = TRUE, digits = NA, pretty = TRUE), out_path)
cat("Wrote", out_path, "\n")
