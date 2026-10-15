// Shared helpers and the shared state for all figures (plain script, exposes window.WB)
(function () {
  const WB = window.WB = window.WB || {};

  const DIMS = ["health", "education", "living", "work", "environment"];
  const DIM_LABEL = {
    health: "Health", education: "Education", living: "Living conditions",
    work: "Work", environment: "Clean air"
  };

  // development profiles (k-means, ordered by mean well-being; top of the list = best)
  const PROFILES = [
    { id: 4, name: "High income, high well-being", short: "High income", color: "#1f4e79" },
    { id: 3, name: "Upper-middle, broad gains", short: "Upper-middle", color: "#4e83b3" },
    { id: 2, name: "Resource-rich, well-being lags income", short: "Resource-rich", color: "#c9962b" },
    { id: 1, name: "Lower-middle, catching up", short: "Catching up", color: "#8eb3d1" },
    { id: 0, name: "Low income, low well-being", short: "Low income", color: "#c3cfdb" }
  ];
  const SNAPSHOTS = [2000, 2008, 2015, 2022];
  const FOCUS = ["CHN", "IND", "ETH", "LKA", "NGA", "QAT"];
  const profileColor = id => (PROFILES.find(p => p.id === id) || {}).color || "#ccc";
  const profileName = id => (PROFILES.find(p => p.id === id) || {}).name || "";

  const gapColor = d3.scaleDivergingPow()
    .exponent(0.65)
    .domain([-15, 0, 15])
    .interpolator(d3.interpolateRgbBasis(["#8a1f4b", "#c65a83", "#ebc8d5", "#f1f2f3", "#c8e5e0", "#4ea497", "#0d6158"]))
    .clamp(true);

  const fmtUSD = d => d >= 1000 ? `$${d3.format(",.0f")(d / 1000)}k` : `$${d3.format(",.0f")(d)}`;
  const fmtGap = d => (d > 0 ? "+" : "") + d3.format(".1f")(d);
  const fmtGapInt = d => { const v = Math.round(d); return v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v); };

  const num = r => {
    for (const k in r) {
      if (!["iso3", "name", "region", "income"].includes(k)) r[k] = r[k] === "" ? null : +r[k];
    }
    return r;
  };

  async function loadAll() {
    const base = WB.base || "";
    const [panel, sens, curves, heat, world] = await Promise.all([
      d3.csv(base + "data/processed/panel_2000_2022.csv", num),
      d3.csv(base + "data/processed/gap_weight_sensitivity_2022.csv", num),
      d3.json(base + "data/processed/expected_curves.json"),
      d3.json(base + "data/processed/heatmap_2022.json"),
      d3.json(base + "data/raw/geo/countries-110m.json")
    ]);
    const byIso = d3.group(panel, d => d.iso3);
    byIso.forEach(rows => rows.sort((a, b) => a.year - b.year));
    const byYear = d3.group(panel, d => d.year);
    const byYearIso = new Map([...byYear].map(([y, rows]) => [y, new Map(rows.map(r => [r.iso3, r]))]));
    const numToIso = new Map(panel.map(d => [String(d.iso_num).padStart(3, "0"), d.iso3]));
    const info = new Map([...byIso].map(([iso, rows]) => [iso, rows[rows.length - 1]]));
    const countries = [...info.values()].sort((a, b) => d3.ascending(a.name, b.name));
    const regions = [...new Set(countries.map(d => d.region))].sort();
    const gapExtent = d3.extent(panel, d => d.gap);
    return { panel, sens, curves, heat, world, byIso, byYear, byYearIso, numToIso, info, countries, regions, gapExtent };
  }

  // ---------------------------------------------------------------- shared state
  // One small store drives every view: the selected year, the selected countries,
  // the dimension weights and the per-view display options.
  const state = {
    year: 2022,
    selected: new Set(FOCUS),
    hover: null,
    mapMetric: "gap",
    yMode: "score",
    weights: { health: 1, education: 1, living: 1, work: 1, environment: 1 },
    rerank: false,
    region: "all",
    fig4Mode: "cluster",
    fig4Sort: null,           // {key, dir} or null = cluster order
    fig5Weight: "count"
  };
  const listeners = [];
  function on(keys, fn) { listeners.push({ keys: [].concat(keys), fn }); }
  function set(patch) {
    const changed = [];
    for (const k in patch) {
      const a = state[k], b = patch[k];
      const same = a instanceof Set ? (b.size === a.size && [...b].every(v => a.has(v)))
                  : (typeof a === "object" && a !== null ? JSON.stringify(a) === JSON.stringify(b) : a === b);
      if (!same) { state[k] = b; changed.push(k); }
    }
    if (!changed.length) return;
    listeners.forEach(l => { if (l.keys.some(k => changed.includes(k))) l.fn(changed); });
  }
  function toggleSelected(iso) {
    const s = new Set(state.selected);
    s.has(iso) ? s.delete(iso) : s.add(iso);
    set({ selected: s });
  }
  function select(isos, mode = "replace") {
    const s = mode === "add" ? new Set([...state.selected, ...isos]) : new Set(isos);
    set({ selected: s });
  }

  // -------- cross-view hover: any element with data-iso lights up everywhere
  function installHoverLink() {
    document.addEventListener("mouseover", e => {
      const el = e.target.closest && e.target.closest("[data-iso]");
      const iso = el ? el.dataset.iso : null;
      if (iso === state.hover) return;
      state.hover = iso;
      document.querySelectorAll(".hov").forEach(n => n.classList.remove("hov"));
      if (iso) document.querySelectorAll(`[data-iso="${iso}"]`).forEach(n => n.classList.add("hov"));
    });
  }
  function applySel(root = document) {
    root.querySelectorAll("[data-iso]").forEach(n =>
      n.classList.toggle("sel", state.selected.has(n.dataset.iso)));
  }

  // one tooltip per figure container
  function tooltip(container) {
    const el = d3.select(container).append("div").attr("class", "tooltip");
    return {
      show(html, event) {
        const box = container.getBoundingClientRect();
        el.html(html).style("opacity", 1)
          .style("left", `${Math.min(event.clientX - box.left + 12, box.width - 190)}px`)
          .style("top", `${event.clientY - box.top + 12}px`);
      },
      hide() { el.style("opacity", 0); }
    };
  }

  function width(container, fallback = 900) {
    return Math.max(320, container.clientWidth || fallback);
  }

  Object.assign(WB, {
    DIMS, DIM_LABEL, PROFILES, SNAPSHOTS, FOCUS, profileColor, profileName, gapColor,
    fmtUSD, fmtGap, fmtGapInt, loadAll, tooltip, width,
    state, on, set, toggleSelected, select, installHoverLink, applySel
  });
})();