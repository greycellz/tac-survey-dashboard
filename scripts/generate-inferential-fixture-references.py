#!/usr/bin/env python3
"""Regenerate inferential-references.json when R is unavailable.

Canonical source remains R (scripts/generate-inferential-fixture-references.R).
This script ports the same Welch / Wilcox asymptotic / Welch one-way / KW / χ²
definitions as src/lib/inferential.ts (aligned with R defaults in Brief 3).
Fisher 2×2: scipy.stats.fisher_exact(alternative=\"two-sided\").

Usage (repo root): python3 scripts/generate-inferential-fixture-references.py

Requires: pip install numpy scipy
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from scipy import stats


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "src/lib/__tests__/fixtures/inferential-fixture.csv"
OUT_PATH = ROOT / "src/lib/__tests__/fixtures/inferential-references.json"


def load_csv() -> list[dict[str, float]]:
    rows: list[dict[str, float]] = []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append({k: float(v) for k, v in r.items()})
    return rows


def subset(rows: list[dict[str, float]], pred) -> list[dict[str, float]]:
    return [r for r in rows if pred(r)]


def sample_variance(vals: np.ndarray) -> float:
    if vals.size < 2:
        return float("nan")
    return float(np.var(vals, ddof=1))


def welch_two_sample(x_vals: np.ndarray, y_vals: np.ndarray) -> tuple[float, float, float]:
    """inferential.ts welchTwoSampleT (first arg minus second)."""
    n1, n2 = x_vals.size, y_vals.size
    if n1 < 2 or n2 < 2:
        return float("nan"), float("nan"), float("nan")
    v1, v2 = sample_variance(x_vals), sample_variance(y_vals)
    m1, m2 = float(np.mean(x_vals)), float(np.mean(y_vals))
    se2 = v1 / n1 + v2 / n2
    if not (se2 > 0) or math.isnan(se2):
        return float("nan"), float("nan"), float("nan")
    t = (m1 - m2) / math.sqrt(se2)
    num = se2 ** 2
    den = (v1 * v1) / (n1 * n1 * (n1 - 1)) + (v2 * v2) / (n2 * n2 * (n2 - 1))
    df = num / den
    p = 2 * stats.t.cdf(-abs(t), df)
    return t, df, min(1.0, max(0.0, p))


def welch_t_conf_int(
    x_vals: np.ndarray, y_vals: np.ndarray
) -> tuple[float, float]:
    m1, m2 = float(np.mean(x_vals)), float(np.mean(y_vals))
    v1, v2 = sample_variance(x_vals), sample_variance(y_vals)
    n1, n2 = x_vals.size, y_vals.size
    se = math.sqrt(v1 / n1 + v2 / n2)
    if se <= 0 or math.isnan(se):
        return float("nan"), float("nan")
    _, df_w, _ = welch_two_sample(x_vals, y_vals)
    if not math.isfinite(df_w):
        return float("nan"), float("nan")
    h = stats.t.ppf(0.975, df_w) * se
    diff = m1 - m2
    return diff - h, diff + h


def pooled_cohens_d(x_vals: np.ndarray, y_vals: np.ndarray) -> dict[str, float]:
    """inferential.ts pooledCohenD."""
    n1, n2 = x_vals.size, y_vals.size
    if n1 < 2 or n2 < 2:
        return {"d": float("nan"), "lo": float("nan"), "hi": float("nan")}
    v1, v2 = sample_variance(x_vals), sample_variance(y_vals)
    if not math.isfinite(v1) or not math.isfinite(v2):
        return {"d": float("nan"), "lo": float("nan"), "hi": float("nan")}
    sp = math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
    if sp == 0 or math.isnan(sp):
        return {"d": float("nan"), "lo": float("nan"), "hi": float("nan")}
    d = (float(np.mean(x_vals)) - float(np.mean(y_vals))) / sp
    se = math.sqrt((n1 + n2) / (n1 * n2) + d * d / (2 * (n1 + n2)))
    z = 1.96
    return {"d": float(d), "lo": float(d - z * se), "hi": float(d + z * se)}


def pooled_average_ranks(values: np.ndarray) -> np.ndarray:
    """Average ranks for ties (inferential.ts pooledAverageRanks)."""
    n = values.size
    ranks = np.zeros(n, dtype=float)
    i = 0
    while i < n:
        j = i + 1
        while j < n and values[j] == values[i]:
            j += 1
        avg = ((i + 1) + j) / 2.0
        for k in range(i, j):
            ranks[k] = avg
        i = j
    return ranks


def wilcox_rank_sum_w(x_vals: np.ndarray, y_vals: np.ndarray) -> tuple[float, float]:
    """inferential.ts wilcoxRankSumW — W = sum of ranks in first group, asymptotic p."""
    pairs = [(v, 0) for v in x_vals] + [(v, 1) for v in y_vals]
    pairs.sort(key=lambda t: (t[0], t[1]))
    vals = np.array([p[0] for p in pairs], dtype=float)
    ranks = pooled_average_ranks(vals)
    w = 0.0
    for idx, p in enumerate(pairs):
        if p[1] == 0:
            w += ranks[idx]
    n1, n2 = x_vals.size, y_vals.size
    ntot = n1 + n2
    mu = n1 * (ntot + 1) / 2.0
    tie_adj = 0.0
    k = 0
    while k < ntot:
        l = k + 1
        while l < ntot and vals[l] == vals[k]:
            l += 1
        ln = l - k
        tie_adj += ln**3 - ln
        k = l
    sigma_sq = (n1 * n2 / 12.0) * (ntot + 1)
    if ntot > 1 and tie_adj != 0:
        sigma_sq -= (n1 * n2 * tie_adj) / (12.0 * ntot * (ntot - 1))
    if sigma_sq <= 0 or math.isnan(sigma_sq):
        return w, 1.0
    sigma = math.sqrt(sigma_sq)
    zsc = (w - mu) / sigma
    cdf = stats.norm.cdf(zsc)
    p = min(1.0, max(0.0, 2 * min(cdf, 1 - cdf)))
    return w, p


def welch_dict(y: np.ndarray, g: np.ndarray) -> dict[str, float]:
    ok = np.isfinite(y) & np.isfinite(g)
    y, g = y[ok], g[ok]
    ul = np.sort(np.unique(g))
    if ul.size != 2:
        return {
            "statistic": float("nan"),
            "df": float("nan"),
            "p": float("nan"),
            "mean_group_0": float("nan"),
            "mean_group_1": float("nan"),
            "ci_low": float("nan"),
            "ci_high": float("nan"),
            "cohens_d": float("nan"),
            "cohens_d_ci_low": float("nan"),
            "cohens_d_ci_high": float("nan"),
        }
    x0 = y[g == ul[0]]
    x1 = y[g == ul[1]]
    t, df, p = welch_two_sample(x0, x1)
    ci_lo, ci_hi = welch_t_conf_int(x0, x1)
    cd = pooled_cohens_d(x0, x1)
    return {
        "statistic": float(t),
        "df": float(df),
        "p": float(p),
        "mean_group_0": float(np.mean(x0)),
        "mean_group_1": float(np.mean(x1)),
        "ci_low": float(ci_lo),
        "ci_high": float(ci_hi),
        "cohens_d": float(cd["d"]),
        "cohens_d_ci_low": float(cd["lo"]),
        "cohens_d_ci_high": float(cd["hi"]),
    }


def mwu_dict(y: np.ndarray, g: np.ndarray) -> dict[str, float]:
    ok = np.isfinite(y) & np.isfinite(g)
    y, g = y[ok], g[ok]
    ul = np.sort(np.unique(g))
    if ul.size != 2:
        return {"statistic": float("nan"), "p": float("nan")}
    x0 = y[g == ul[0]]
    x1 = y[g == ul[1]]
    w, p = wilcox_rank_sum_w(x0, x1)
    return {"statistic": float(w), "p": float(p)}


def welch_one_way_anova(groups_in: list[np.ndarray]) -> dict[str, float]:
    """inferential.ts welchOneWayANOVA."""
    groups = [g for g in groups_in if g.size > 0]
    k = len(groups)
    if k < 2 or any(g.size < 2 for g in groups):
        return {
            "statistic": float("nan"),
            "num_df": float("nan"),
            "denom_df": float("nan"),
            "p": float("nan"),
        }
    ni = np.array([g.size for g in groups], dtype=float)
    mi = np.array([np.mean(g) for g in groups], dtype=float)
    vi = np.array([sample_variance(g) for g in groups], dtype=float)
    wi = ni / vi
    sum_wi = float(np.sum(wi))
    tmp_val = (
        sum(
            (1 - wi[idx] / sum_wi) ** 2 / (ni[idx] - 1)
            for idx in range(k)
        )
        / (k * k - 1)
    )
    m = float(sum(w * mi[i] for i, w in enumerate(wi))) / sum_wi
    stat_val = (
        sum(w * (mi[i] - m) ** 2 for i, w in enumerate(wi))
        / ((k - 1) * (1 + 2 * (k - 2) * tmp_val))
    )
    df1 = k - 1
    df2 = 1 / (3 * tmp_val)
    p = 1 - stats.f.cdf(stat_val, df1, df2)
    return {
        "statistic": float(stat_val),
        "num_df": float(df1),
        "denom_df": float(df2),
        "p": min(1.0, max(0.0, p)),
    }


def kruskal_wallis(groups_all: list[np.ndarray]) -> dict[str, float]:
    """inferential.ts kruskalWallis (with tie correction)."""
    groups = [np.asarray(g, dtype=float) for g in groups_all if g.size > 0]
    pairs: list[tuple[float, int]] = []
    for gi, grp in enumerate(groups):
        for v in grp:
            pairs.append((float(v), gi))
    pairs.sort(key=lambda t: (t[0], t[1]))
    vals = np.array([p[0] for p in pairs], dtype=float)
    ranks = pooled_average_ranks(vals)
    tie_adj = 0.0
    b = 0
    ntot = vals.size
    while b < ntot:
        e = b + 1
        while e < ntot and vals[e] == vals[b]:
            e += 1
        ln = e - b
        tie_adj += ln**3 - ln
        b = e

    k = len(groups)
    if k < 2:
        return {"statistic": float("nan"), "df": float("nan"), "p": float("nan")}
    rsums = [0.0] * k
    counts = [0] * k
    for idx, p in enumerate(pairs):
        gi = p[1]
        rsums[gi] += ranks[idx]
        counts[gi] += 1
    h = (12 / (ntot * (ntot + 1))) * sum(
        rs * rs / ct for rs, ct in zip(rsums, counts) if ct > 0
    ) - 3 * (ntot + 1)
    denom = ntot**3 - ntot
    if denom != 0 and tie_adj != 0:
        tie_factor = 1 - tie_adj / denom
        if tie_factor != 0:
            h /= tie_factor
    df = max(0.0, float(k - 1))
    pv = (
        min(1.0, max(0.0, 1 - stats.chi2.cdf(h, df)))
        if df > 0 and math.isfinite(h)
        else float("nan")
    )
    return {"statistic": float(h), "df": float(df), "p": float(pv)}


def pearson_chi_square(table: list[list[int]]) -> dict[str, float]:
    """inferential.ts pearsonChiSquare (no Yates)."""
    r_dim = len(table)
    c_dim = len(table[0]) if r_dim else 0
    if r_dim <= 1 or c_dim <= 1:
        return {"statistic": float("nan"), "df": float("nan"), "p": float("nan")}
    row_sum = [sum(row) for row in table]
    col_sum = [0] * c_dim
    for i in range(r_dim):
        for j in range(c_dim):
            col_sum[j] += table[i][j]
    n_all = sum(row_sum)
    if n_all == 0:
        return {"statistic": float("nan"), "df": float("nan"), "p": float("nan")}
    chi2 = 0.0
    for i in range(r_dim):
        for j in range(c_dim):
            o = table[i][j]
            e = (row_sum[i] * col_sum[j]) / n_all
            if e <= 0:
                continue
            diff = o - e
            chi2 += (diff * diff) / e
    df = (r_dim - 1) * (c_dim - 1)
    pcore = 1 - stats.chi2.cdf(chi2, df) if df >= 1 and math.isfinite(chi2) else float("nan")
    if not math.isfinite(pcore):
        return {"statistic": float(chi2), "df": float(df), "p": float("nan")}
    return {"statistic": float(chi2), "df": float(df), "p": min(1.0, max(0.0, pcore))}


def cramers_v(chi: float, n: int, r_dim: int, c_dim: int) -> float:
    dd = min(r_dim, c_dim) - 1
    if n <= 0 or dd <= 0 or not math.isfinite(chi):
        return float("nan")
    return math.sqrt(max(0.0, chi) / (n * dd))


def chisq2(table: list[list[int]]) -> dict[str, Any]:
    pc = pearson_chi_square(table)
    n = sum(sum(r) for r in table)
    r_dim, c_dim = len(table), len(table[0])
    v = cramers_v(pc["statistic"], n, r_dim, c_dim)
    return {
        "statistic": pc["statistic"],
        "df": pc["df"],
        "p": pc["p"],
        "cramers_v": v,
        "table": table,
    }


def fisher2x2(table: list[list[int]]) -> dict[str, float]:
    odd, p, lo, hi = stats.fisher_exact(table, alternative="two-sided")
    return {
        "p": float(p),
        "or": float(odd),
        "ci_low": float(lo),
        "ci_high": float(hi),
    }


def cor_pair(x: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    n = x.size
    pr = stats.pearsonr(x, y)
    r = float(pr.statistic)
    p_p = float(pr.pvalue)
    if n < 3:
        t_stat = float("nan")
    else:
        t_stat = r * math.sqrt((n - 2) / max(1e-15, 1 - r * r))
    ci_lo, ci_hi = float("nan"), float("nan")
    if hasattr(pr, "confidence_interval"):
        ci = pr.confidence_interval(confidence_level=0.95)
        ci_lo, ci_hi = float(ci.low), float(ci.high)
    else:
        # Fisher z fallback
        if abs(r) < 1 and n > 3:
            z = 0.5 * math.log((1 + r) / (1 - r))
            se = 1 / math.sqrt(n - 3)
            zc = 1.96
            lo_z, hi_z = z - zc * se, z + zc * se
            ci_lo = (math.exp(2 * lo_z) - 1) / (math.exp(2 * lo_z) + 1)
            ci_hi = (math.exp(2 * hi_z) - 1) / (math.exp(2 * hi_z) + 1)
    sp = stats.spearmanr(x, y)
    rho = float(sp.statistic)
    p_s = float(sp.pvalue)
    return {
        "pearson": {
            "statistic": t_stat,
            "df": float(n - 2),
            "p": p_p,
            "estimate": r,
            "ci_low": ci_lo,
            "ci_high": ci_hi,
        },
        "spearman": {"rho": rho, "p": p_s},
    }


def df_col(rows: list[dict[str, float]], key: str) -> np.ndarray:
    return np.array([r[key] for r in rows], dtype=float)


def main() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"Missing {CSV_PATH}")
    df = load_csv()

    gender = subset(df, lambda r: r["is_female"] == 1 or r["is_male"] == 1)
    fire_s = subset(df, lambda r: r["fire_eaton"] == 1 or r["fire_palisade"] == 1)

    family_a = {
        "A1_age_ai_comfort": cor_pair(df_col(df, "age"), df_col(df, "ai_comfort_num")),
        "A2_age_ai_interest": cor_pair(df_col(df, "age"), df_col(df, "ai_interest_num")),
        "A3_age_human_helper": cor_pair(df_col(df, "age"), df_col(df, "human_helper_importance_num")),
    }

    fb: dict[str, Any] = {
        "B1a_aic_by_gender": {
            "welch": welch_dict(df_col(gender, "ai_comfort_num"), df_col(gender, "is_female")),
            "mwu": mwu_dict(df_col(gender, "ai_comfort_num"), df_col(gender, "is_female")),
        },
        "B1b_aii_by_gender": {
            "welch": welch_dict(df_col(gender, "ai_interest_num"), df_col(gender, "is_female")),
            "mwu": mwu_dict(df_col(gender, "ai_interest_num"), df_col(gender, "is_female")),
        },
        "B2a_aic_by_fire": {
            "welch": welch_dict(df_col(fire_s, "ai_comfort_num"), df_col(fire_s, "fire_eaton")),
            "mwu": mwu_dict(df_col(fire_s, "ai_comfort_num"), df_col(fire_s, "fire_eaton")),
        },
        "B2b_aii_by_fire": {
            "welch": welch_dict(df_col(fire_s, "ai_interest_num"), df_col(fire_s, "fire_eaton")),
            "mwu": mwu_dict(df_col(fire_s, "ai_interest_num"), df_col(fire_s, "fire_eaton")),
        },
        "B3a_aic_by_TL": {
            "welch": welch_dict(df_col(df, "ai_comfort_num"), df_col(df, "totalLoss")),
            "mwu": mwu_dict(df_col(df, "ai_comfort_num"), df_col(df, "totalLoss")),
        },
        "B3b_aii_by_TL": {
            "welch": welch_dict(df_col(df, "ai_interest_num"), df_col(df, "totalLoss")),
            "mwu": mwu_dict(df_col(df, "ai_interest_num"), df_col(df, "totalLoss")),
        },
        "B3c_aic_by_aD": {
            "welch": welch_dict(df_col(df, "ai_comfort_num"), df_col(df, "anyDamage")),
            "mwu": mwu_dict(df_col(df, "ai_comfort_num"), df_col(df, "anyDamage")),
        },
        "B3d_aii_by_aD": {
            "welch": welch_dict(df_col(df, "ai_interest_num"), df_col(df, "anyDamage")),
            "mwu": mwu_dict(df_col(df, "ai_interest_num"), df_col(df, "anyDamage")),
        },
    }

    et = df_col(df, "exposureTier")
    ac = df_col(df, "ai_comfort_num")
    aii = df_col(df, "ai_interest_num")
    g0 = ac[et == 0]
    g1 = ac[et == 1]
    g2 = ac[et == 2]
    h0 = aii[et == 0]
    h1 = aii[et == 1]
    h2 = aii[et == 2]
    fb["B3e_aic_by_eT"] = {
        "anova": welch_one_way_anova([g0, g1, g2]),
        "kw": kruskal_wallis([g0, g1, g2]),
    }
    fb["B3f_aii_by_eT"] = {
        "anova": welch_one_way_anova([h0, h1, h2]),
        "kw": kruskal_wallis([h0, h1, h2]),
    }

    fb["B4a_aic_by_hC"] = {
        "welch": welch_dict(df_col(df, "ai_comfort_num"), df_col(df, "has_children")),
        "mwu": mwu_dict(df_col(df, "ai_comfort_num"), df_col(df, "has_children")),
    }
    fb["B4b_aii_by_hC"] = {
        "welch": welch_dict(df_col(df, "ai_interest_num"), df_col(df, "has_children")),
        "mwu": mwu_dict(df_col(df, "ai_interest_num"), df_col(df, "has_children")),
    }
    fb["B5a_aic_by_iCg"] = {
        "welch": welch_dict(df_col(df, "ai_comfort_num"), df_col(df, "is_caregiver")),
        "mwu": mwu_dict(df_col(df, "ai_comfort_num"), df_col(df, "is_caregiver")),
    }
    fb["B5b_aii_by_iCg"] = {
        "welch": welch_dict(df_col(df, "ai_interest_num"), df_col(df, "is_caregiver")),
        "mwu": mwu_dict(df_col(df, "ai_interest_num"), df_col(df, "is_caregiver")),
    }
    fb["B6a_aic_by_pAI"] = {
        "welch": welch_dict(df_col(df, "ai_comfort_num"), df_col(df, "prior_ai_use")),
        "mwu": mwu_dict(df_col(df, "ai_comfort_num"), df_col(df, "prior_ai_use")),
    }
    fb["B6b_aii_by_pAI"] = {
        "welch": welch_dict(df_col(df, "ai_interest_num"), df_col(df, "prior_ai_use")),
        "mwu": mwu_dict(df_col(df, "ai_interest_num"), df_col(df, "prior_ai_use")),
    }
    fb["B7_wb_by_aES"] = {
        "welch": welch_dict(df_col(df, "wellbeing_num"), df_col(df, "ai_emo_support")),
        "mwu": mwu_dict(df_col(df, "wellbeing_num"), df_col(df, "ai_emo_support")),
    }
    fb["B8_age_by_aMH"] = {
        "welch": welch_dict(df_col(df, "age"), df_col(df, "any_mh_util")),
        "mwu": mwu_dict(df_col(df, "age"), df_col(df, "any_mh_util")),
    }

    mh = df_col(df, "any_mh_util")
    aes = df_col(df, "ai_emo_support")
    ab = df_col(df, "accessBarrier")
    tl = df_col(df, "totalLoss")
    admg = df_col(df, "anyDamage")

    def tab2(rr: np.ndarray, cc: np.ndarray) -> list[list[int]]:
        a = b = c2 = dd = 0
        for i in range(rr.size):
            rv, cv = rr[i], cc[i]
            if not math.isfinite(rv) or not math.isfinite(cv):
                continue
            ir, ic = int(rv), int(cv)
            if ir == 0 and ic == 0:
                a += 1
            elif ir == 0 and ic == 1:
                b += 1
            elif ir == 1 and ic == 0:
                c2 += 1
            elif ir == 1 and ic == 1:
                dd += 1
        return [[a, b], [c2, dd]]

    def tab_mh_et() -> list[list[int]]:
        t = [[0, 0, 0], [0, 0, 0]]
        lv = [0, 1, 2]
        for i in range(len(df)):
            iy = mh[i]
            ix = et[i]
            if not math.isfinite(iy) or not math.isfinite(ix):
                continue
            j = lv.index(int(ix))
            iy = int(iy)
            if iy == 0:
                t[0][j] += 1
            elif iy == 1:
                t[1][j] += 1
        return t

    t_c1 = tab2(mh, aes)
    t_c2 = tab2(ab, aes)
    t_c3a = tab2(mh, tl)
    t_c3b = tab2(mh, admg)
    t_c3c = tab_mh_et()

    family_c = {
        "C1_aMH_x_aES": {"chisq": chisq2(t_c1), "fisher": fisher2x2(t_c1)},
        "C2_aB_x_aES": {"chisq": chisq2(t_c2), "fisher": fisher2x2(t_c2)},
        "C3a_aMH_x_TL": {"chisq": chisq2(t_c3a), "fisher": fisher2x2(t_c3a)},
        "C3b_aMH_x_aD": {"chisq": chisq2(t_c3b), "fisher": fisher2x2(t_c3b)},
        "C3c_aMH_x_eT": {"chisq": chisq2(t_c3c)},
    }

    out_json = {
        "generated_by": "scripts/generate-inferential-fixture-references.py (SciPy fallback; R is canonical)",
        "family_A": family_a,
        "family_B": fb,
        "family_C": family_c,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out_json, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
