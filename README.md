# Economic Growth and Human Well-being

STATS 401 final project, Luyu Su and Yifan Zuo.

- Project page (GitHub Pages): [`index.html`](index.html)
- Proposal: [`proposal.md`](proposal.md)

## Repository layout

```
index.html                 interim check-in page (D3.js figures)
css/style.css
js/common.js               shared scales, loading, tooltip
js/fig1_maps.js            Figure 1  paired choropleths
js/fig2_paths.js           Figure 2  connected scatterplot + expected curve
js/fig3_rank.js            Figure 3  gap ranking with weight-sensitivity intervals
js/fig4_heatmap.js         Figure 4  clustered heatmap of dimension gaps
lib/                       d3 v7 and topojson-client (vendored, no CDN needed)
scripts/01_download_data.py   downloads every raw file
scripts/02_build_dataset.py   cleaning, integration, derived measures
data/raw/                  raw downloads (WDI, UNDP HDR, WHR, world map)
data/processed/            files loaded by the page
images/                    proposal sketches
```

## Reproduce the data

```bash
pip install pandas numpy scipy scikit-learn statsmodels
python scripts/01_download_data.py
python scripts/02_build_dataset.py
```

## View locally

The page loads CSV/JSON with `fetch`, so it must be served, not opened as a file:

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Publish with GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)`.
The page will be at `https://yyiffann.github.io/stats401-final-project/`.
