// Shared helpers for all figures (plain script, exposes window.WB)
(function () {
  const DIMS = ["health", "education", "living", "work", "environment"];
  const DIM_LABEL = {
    health: "Health", education: "Education", living: "Living conditions",
    work: "Work", environment: "Clean air"
  };

  // development profiles (k-means, ordered by mean well-being)
  const PROFILES = [
    { id: 4, name: "High income, high well-being", color: "#1f4e79" },
    { id: 3, name: "Upper-middle, broad gains", color: "#4e83b3" },
    { id: 2, name: "Resource-rich, well-being lags income", color: "#c9962b" },
    { id: 1, name: "Lower-middle, catching up", color: "#8eb3d1" },
    { id: 0, name: "Low income, low well-being", color: "#c3cfdb" }
  ];
  const profileColor = id => (PROFILES.find(p => p.id === id) || {}).color || "#ccc";

  const gapColor = d3.scaleDivergingPow()
    .exponent(0.65)
    .domain([-15, 0, 15])
    .interpolator(d3.interpolateRgbBasis(["#8a1f4b", "#c65a83", "#ebc8d5", "#f1f2f3", "#c8e5e0", "#4ea497", "#0d6158"]))
    .clamp(true);

  const fmtUSD = d => d >= 1000 ? `$${d3.format(",.0f")(d / 1000)}k` : `$${d3.format(",.0f")(d)}`;
  const fmtGap = d => (d > 0 ? "+" : "") + d3.format(".1f")(d);

  const num = r => {
    for (const k in r) {
      if (!["iso3", "name", "region", "income"].includes(k)) r[k] = r[k] === "" ? null : +r[k];
    }
    return r;
  };

  async function loadAll() {
    const [panel, sens, curves, heat, world] = await Promise.all([
      d3.csv("data/processed/panel_2000_2022.csv", num),
      d3.csv("data/processed/gap_weight_sensitivity_2022.csv", num),
      d3.json("data/processed/expected_curves.json"),
      d3.json("data/processed/heatmap_2022.json"),
      d3.json("data/raw/geo/countries-110m.json")
    ]);
    return { panel, sens, curves, heat, world };
  }

  // one tooltip per figure container
  function tooltip(container) {
    const el = d3.select(container).append("div").attr("class", "tooltip");
    return {
      show(html, event) {
        const box = container.getBoundingClientRect();
        el.html(html).style("opacity", 1)
          .style("left", `${Math.min(event.clientX - box.left + 12, box.width - 180)}px`)
          .style("top", `${event.clientY - box.top + 12}px`);
      },
      hide() { el.style("opacity", 0); }
    };
  }

  function width(container, fallback = 900) {
    return Math.max(320, container.clientWidth || fallback);
  }

  window.WB = { DIMS, DIM_LABEL, PROFILES, profileColor, gapColor, fmtUSD, fmtGap, loadAll, tooltip, width };
})();
