"""
Step 2 - clean, integrate and derive everything the visualizations need.

Input : data/raw/*        (see 01_download_data.py)
Output: data/processed/*  (small CSV/JSON files loaded by the D3 pages)

Pipeline
  1. harmonise country ids (ISO-3), keep sovereign countries with >= 1M people
  2. build a 2000-2022 country-year panel from WDI + UNDP HDR
  3. fill short gaps (linear interpolation, edge carry <= 3 yrs) and flag them
  4. rescale every indicator to 0-100 with fixed goalposts (comparable over time)
  5. aggregate 11 indicators into 5 well-being dimensions + composite score
  6. "expected well-being at this income": yearly LOWESS of score on log GDP pc
     -> well-being gap = actual - expected (the central derived variable)
  7. weight-sensitivity: 2,000 random dimension weightings -> rank intervals
  8. development profiles: k-means on (log GDP + 5 dimensions) pooled over
     2000/2008/2015/2022 so cluster meaning is fixed over time -> transitions
  9. validation: correlation of the score with WHR life-satisfaction

Run from repo root:  python scripts/02_build_dataset.py
"""
import json
import pathlib

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from statsmodels.nonparametric.smoothers_lowess import lowess

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

YEARS = list(range(2000, 2023))          # HDR schooling series ends in 2022
MIN_POP = 1_000_000
RNG = np.random.default_rng(401)

# --------------------------------------------------------------------------
# 1. country metadata
# --------------------------------------------------------------------------
meta = pd.read_csv(RAW / "countries_meta.csv", low_memory=False)
meta = meta[(meta["is--country"] == True) & meta["iso3166_1_alpha3"].notna()]
meta = meta.rename(columns={"country": "geo", "iso3166_1_alpha3": "iso3",
                            "iso3166_1_numeric": "iso_num", "world_6region": "region",
                            "income_groups": "income"})
meta = meta[["geo", "iso3", "iso_num", "name", "region", "income"]]
REGION_LABEL = {
    "east_asia_pacific": "East Asia & Pacific", "europe_central_asia": "Europe & Central Asia",
    "america": "Americas", "middle_east_north_africa": "Middle East & N. Africa",
    "south_asia": "South Asia", "sub_saharan_africa": "Sub-Saharan Africa"}
meta["region"] = meta["region"].map(REGION_LABEL)

# --------------------------------------------------------------------------
# 2. panel
# --------------------------------------------------------------------------
WDI = {  # file -> short column name
    "ny_gdp_pcap_pp_kd": "gdp_pc", "sp_pop_totl": "pop", "sp_dyn_le00_in": "life_exp",
    "sh_dyn_mort": "u5_mort", "sl_uem_totl_zs": "unemp", "sl_emp_vuln_zs": "vuln_emp",
    "sh_h2o_basw_zs": "water", "sh_sta_bass_zs": "sanitation", "eg_elc_accs_zs": "electricity",
    "en_atm_pm25_mc_m3": "pm25", "en_ghg_co2_pc_ce_ar5": "co2_pc"}

frames = []
for f, col in WDI.items():
    d = pd.read_csv(RAW / "wdi" / f"{f}.csv")
    d.columns = ["geo", "year", col]
    frames.append(d.set_index(["geo", "year"]))
wdi = pd.concat(frames, axis=1).reset_index()

hdr = pd.read_csv(RAW / "undp" / "HDR23-24_Composite_indices_complete_time_series.csv",
                  encoding="latin1")
hdr = hdr[hdr["iso3"].str.len() == 3]
long = []
for var, col in {"mys": "school_mean", "eys": "school_exp"}.items():
    cols = [f"{var}_{y}" for y in YEARS]
    m = hdr[["iso3"] + cols].melt(id_vars="iso3", var_name="year", value_name=col)
    m["year"] = m["year"].str[-4:].astype(int)
    long.append(m.set_index(["iso3", "year"]))
hdr_long = pd.concat(long, axis=1).reset_index()
hdr_long["geo"] = hdr_long["iso3"].str.lower()
hdr_long = hdr_long.drop(columns="iso3")

grid = pd.MultiIndex.from_product([meta["geo"], YEARS], names=["geo", "year"]).to_frame(index=False)
panel = (grid.merge(wdi, on=["geo", "year"], how="left")
             .merge(hdr_long, on=["geo", "year"], how="left"))
raw_obs = panel.copy()

# --------------------------------------------------------------------------
# 3. gap filling (within country only) + flags
# --------------------------------------------------------------------------
INDICATORS = ["life_exp", "u5_mort", "school_mean", "school_exp", "water", "sanitation",
              "electricity", "unemp", "vuln_emp", "pm25"]
FILL = INDICATORS + ["gdp_pc", "pop", "co2_pc"]
panel = panel.sort_values(["geo", "year"])
# slow-moving coverage indicators may be carried up to 6 years at the edges,
# everything else up to 3 years; interior gaps are linearly interpolated
SLOW = ["water", "sanitation", "electricity", "school_mean", "school_exp"]
filled = panel[FILL].copy()
for cols, lim in [(SLOW, 6), ([c for c in FILL if c not in SLOW], 3)]:
    filled[cols] = panel.groupby("geo")[cols].transform(
        lambda s: s.interpolate(limit_area="inside").ffill(limit=lim).bfill(limit=lim))
was_missing = filled.notna() & panel[FILL].isna()
imputed_cells = int(was_missing.sum().sum())
panel["n_imputed"] = was_missing[INDICATORS].sum(axis=1)
panel[FILL] = filled

# sample: >= 1M people in 2022, complete GDP and >= 9 of 10 well-being indicators every year
pop22 = panel[panel.year == 2022].set_index("geo")["pop"]
big = pop22[pop22 >= MIN_POP].index
panel = panel[panel.geo.isin(big)]
ok = panel.groupby("geo").apply(
    lambda g: g["gdp_pc"].notna().all() and (g[INDICATORS].notna().sum(axis=1) >= 9).all(),
    include_groups=False)
dropped = sorted(set(big) - set(ok[ok].index))
panel = panel[panel.geo.isin(ok[ok].index)].copy()

# --------------------------------------------------------------------------
# 4. rescale to 0-100 with fixed goalposts
# --------------------------------------------------------------------------
# (lo, hi, higher_is_better, log)
GOALPOSTS = {
    "life_exp":    (20, 85, True, False),        # UNDP HDI goalposts
    "school_mean": (0, 15, True, False),         # UNDP HDI goalposts
    "school_exp":  (0, 18, True, False),         # UNDP HDI goalposts
    "u5_mort":     (2, 200, False, True),        # log scale, per 1,000
    "water":       (0, 100, True, False),
    "sanitation":  (0, 100, True, False),
    "electricity": (0, 100, True, False),
    "unemp":       (0, 25, False, False),
    "vuln_emp":    (0, 95, False, False),
    "pm25":        (5, 100, False, True),        # 5 ug/m3 = WHO 2021 guideline
}
for col, (lo, hi, up, lg) in GOALPOSTS.items():
    x = panel[col].clip(lo, hi)
    if lg:
        x, lo, hi = np.log(x), np.log(lo), np.log(hi)
    s = (x - lo) / (hi - lo)
    panel[f"s_{col}"] = 100 * (s if up else 1 - s)

DIMENSIONS = {
    "health":      ["life_exp", "u5_mort"],
    "education":   ["school_mean", "school_exp"],
    "living":      ["water", "sanitation", "electricity"],
    "work":        ["unemp", "vuln_emp"],
    "environment": ["pm25"],
}
DIMS = list(DIMENSIONS)
for dim, cols in DIMENSIONS.items():
    panel[dim] = panel[[f"s_{c}" for c in cols]].mean(axis=1)
panel["wellbeing"] = panel[DIMS].mean(axis=1)
panel["log_gdp"] = np.log10(panel["gdp_pc"])

# --------------------------------------------------------------------------
# 5. expected well-being given income (yearly LOWESS) and gaps
# --------------------------------------------------------------------------
FRAC = 0.6


def expected(x, y):
    """LOWESS fit of y on x, evaluated at x (returns array aligned with input)."""
    fit = lowess(y, x, frac=FRAC, it=2, return_sorted=False)
    return fit


curves = {}
for y, g in panel.groupby("year"):
    idx = g.index
    panel.loc[idx, "expected"] = expected(g["log_gdp"].values, g["wellbeing"].values)
    for dim in DIMS:
        panel.loc[idx, f"exp_{dim}"] = expected(g["log_gdp"].values, g[dim].values)
    xs = np.linspace(g["log_gdp"].min(), g["log_gdp"].max(), 40)
    fit = lowess(g["wellbeing"].values, g["log_gdp"].values, frac=FRAC, it=2)
    curves[int(y)] = [[round(float(10 ** a), 1), round(float(b), 2)]
                      for a, b in zip(xs, np.interp(xs, fit[:, 0], fit[:, 1]))]
panel["gap"] = panel["wellbeing"] - panel["expected"]
for dim in DIMS:
    panel[f"gap_{dim}"] = panel[dim] - panel[f"exp_{dim}"]

# --------------------------------------------------------------------------
# 6. weight sensitivity (latest year)
# --------------------------------------------------------------------------
N_DRAWS = 2000
latest = panel[panel.year == 2022].reset_index(drop=True)
D = latest[DIMS].values
x = latest["log_gdp"].values
W = RNG.dirichlet(np.ones(len(DIMS)) * 2.0, size=N_DRAWS)   # concentrated around equal weights
gaps = np.empty((N_DRAWS, len(latest)))
for i, w in enumerate(W):
    score = D @ w
    gaps[i] = score - expected(x, score)
ranks = (-gaps).argsort(axis=1).argsort(axis=1) + 1          # 1 = largest positive gap
unc = pd.DataFrame({
    "geo": latest["geo"],
    "gap_equal": latest["gap"].round(2),
    "gap_p05": np.percentile(gaps, 5, axis=0).round(2),
    "gap_p95": np.percentile(gaps, 95, axis=0).round(2),
    "rank_equal": latest["gap"].rank(ascending=False).astype(int),
    "rank_p05": np.percentile(ranks, 5, axis=0).astype(int),
    "rank_p50": np.median(ranks, axis=0).astype(int),
    "rank_p95": np.percentile(ranks, 95, axis=0).astype(int),
    "share_positive": (gaps > 0).mean(axis=0).round(3),
})

# --------------------------------------------------------------------------
# 7. development profiles and transitions
# --------------------------------------------------------------------------
SNAP = [2000, 2008, 2015, 2022]
feat = ["log_gdp"] + DIMS
snap = panel[panel.year.isin(SNAP)].copy()
Z = StandardScaler().fit_transform(snap[feat])
K = 5
km = KMeans(n_clusters=K, n_init=50, random_state=401).fit(Z)
snap["cluster_raw"] = km.labels_
# order clusters by mean composite well-being so labels read low -> high
order = snap.groupby("cluster_raw")["wellbeing"].mean().sort_values().index.tolist()
remap = {c: i for i, c in enumerate(order)}
snap["profile"] = snap["cluster_raw"].map(remap)
centroids = (snap.groupby("profile")[feat + ["gdp_pc", "wellbeing"]].mean()
                 .assign(n=snap.groupby("profile").size()))
panel = panel.merge(snap[["geo", "year", "profile"]], on=["geo", "year"], how="left")

# --------------------------------------------------------------------------
# 8. validation against life satisfaction (WHR)
# --------------------------------------------------------------------------
whr = pd.read_csv(RAW / "gapminder" / "hapiscore_whr.csv")
whr.columns = ["geo", "year", "life_sat"]
val = panel.merge(whr, on=["geo", "year"], how="inner")
validation = {
    "n_country_years": int(len(val)),
    "r_wellbeing_lifesat": round(float(val[["wellbeing", "life_sat"]].corr().iloc[0, 1]), 3),
    "r_loggdp_lifesat": round(float(val[["log_gdp", "life_sat"]].corr().iloc[0, 1]), 3),
    "r_gap_lifesat_resid": round(float(np.corrcoef(
        val["gap"], val["life_sat"] - np.poly1d(np.polyfit(val["log_gdp"], val["life_sat"], 1))(val["log_gdp"]))[0, 1]), 3),
}

# --------------------------------------------------------------------------
# 9. export
# --------------------------------------------------------------------------
panel = panel.merge(meta, on="geo", how="left")
keep = (["iso3", "iso_num", "name", "region", "income", "year", "pop", "gdp_pc", "co2_pc"]
        + INDICATORS + DIMS + ["wellbeing", "expected", "gap"]
        + [f"gap_{d}" for d in DIMS] + ["profile", "n_imputed"])
out = panel[keep].copy()
out["iso_num"] = out["iso_num"].astype(int)
out["pop"] = out["pop"].round(0).astype("int64")
num = out.select_dtypes("float").columns
out[num] = out[num].round(2)
out = out.sort_values(["iso3", "year"])
out.to_csv(OUT / "panel_2000_2022.csv", index=False)

unc = unc.merge(meta[["geo", "iso3", "name", "region"]], on="geo").drop(columns="geo")
unc.sort_values("rank_equal").to_csv(OUT / "gap_weight_sensitivity_2022.csv", index=False)

with open(OUT / "expected_curves.json", "w") as f:
    json.dump(curves, f)

centroids.round(2).to_csv(OUT / "profile_centroids.csv")

# heatmap: which dimensions drive the gap?  rows = 20 largest positive + 20 largest
# negative gaps in 2022, ordered by Ward clustering of their 5 dimension gaps
from scipy.cluster.hierarchy import linkage, to_tree
hm = out[out.year == 2022].sort_values("gap")
hm = pd.concat([hm.head(20), hm.tail(20)])
G = hm[[f"gap_{d}" for d in DIMS]].values
tree = to_tree(linkage(G, method="ward"))


def as_dict(node):
    if node.is_leaf():
        return {"iso3": hm.iloc[node.id]["iso3"], "h": 0}
    return {"h": round(float(node.dist), 2), "children": [as_dict(node.left), as_dict(node.right)]}


rows = hm[["iso3", "name", "region", "gdp_pc", "gap"] + [f"gap_{d}" for d in DIMS]]
with open(OUT / "heatmap_2022.json", "w") as f:
    json.dump({"dimensions": DIMS, "tree": as_dict(tree),
               "rows": json.loads(rows.to_json(orient="records"))}, f)

report = {
    "years": [YEARS[0], YEARS[-1]],
    "countries": int(out.iso3.nunique()),
    "rows": int(len(out)),
    "raw_country_year_rows": int(len(raw_obs)),
    "imputed_cells": imputed_cells,
    "dropped_for_missing": dropped,
    "missing_share_raw": {c: round(float(raw_obs[raw_obs.geo.isin(out.iso3.str.lower())][c].isna().mean()), 3)
                          for c in INDICATORS + ["gdp_pc"]},
    "lowess_frac": FRAC,
    "weight_draws": N_DRAWS,
    "k_profiles": K,
    "validation": validation,
}
with open(OUT / "build_report.json", "w") as f:
    json.dump(report, f, indent=2)
print(json.dumps(report, indent=2))
print(centroids.round(1))
