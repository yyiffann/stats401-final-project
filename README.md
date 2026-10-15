# Economic Growth and Human Well-being

STATS 401 final project, Luyu Su and Yifan Zuo. Final version: five linked interactive views.

- Project page (GitHub Pages): [`index.html`](index.html)
- Proposal: [`proposal.md`](proposal.md)

## Repository layout

```
index.html                 final interactive site (five linked D3.js views, guided tour)
interim/                   archived interim check-in page
report/report.md           final report (~1,500 words)
poster/                    poster (HTML, PNG, PDF)
images/final/              screenshots of the final figures
css/style.css
js/common.js               shared state, loading, tooltip, cross-view hover/selection
js/lowess.js               LOWESS port (recomputes gaps live in Figure 3)
js/controls.js             year slider/play, selection chips, guided tour
js/fig1_maps.js            Figure 1  paired choropleths (year, metric, zoom)
js/fig2_paths.js           Figure 2  connected scatterplot + expected curve
js/fig3_rank.js            Figure 3  gap ranking with weight-sensitivity intervals
js/fig4_heatmap.js         Figure 4  clustered heatmap of dimension gaps
js/fig5_flow.js            Figure 5  alluvial diagram of development profiles
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