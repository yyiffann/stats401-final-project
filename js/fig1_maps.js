// Figure 1 - Where is prosperity, and where does well-being beat it?
// Two linked choropleths. Left: GDP per capita (sequential, log). Right: a switchable measure
// (well-being gap by default). Both follow the global year slider, share zoom/pan, and
// clicking a country adds it to the shared selection.
function initFig1(data) {
  const { world, numToIso, byYearIso, info, regions } = data;
  const S = WB.state;
  const countries = topojson.feature(world, world.objects.countries);
  countries.features = countries.features.filter(f => f.properties.name !== "Antarctica");

  const gdpColor = d3.scaleSequentialLog([1000, 100000],
    d3.interpolateRgbBasis(["#eef2f6", "#b9cde0", "#5f8fbd", "#1f4e79", "#0f2a44"])).clamp(true);
  const scoreColor = d3.scaleSequential([20, 95],
    d3.interpolateRgbBasis(["#eef2f6", "#b9cde0", "#5f8fbd", "#1f4e79", "#0f2a44"])).clamp(true);
  const gap30 = d3.scaleDivergingPow().exponent(0.65).domain([-30, 0, 30])
    .interpolator(d3.interpolateRgbBasis(["#8a1f4b", "#c65a83", "#ebc8d5", "#f1f2f3", "#c8e5e0", "#4ea497", "#0d6158"])).clamp(true);

  const GAPNOTE = "points above (+) or below (−) countries of similar income";
  const METRICS = {
    gap: { label: "Well-being gap", kind: "div", color: WB.gapColor, value: r => r.gap, fmt: WB.fmtGap, ticks: [-15, -10, -5, 0, 5, 10, 15], title: `Well-being gap: ${GAPNOTE}` },
    wellbeing: { label: "Well-being score", kind: "seq", color: scoreColor, value: r => r.wellbeing, fmt: d => d.toFixed(1), ticks: [20, 40, 60, 80], title: "Well-being score (0–100, mean of five dimensions)" },
    ...Object.fromEntries(WB.DIMS.map(d => [`gap_${d}`, {
      label: `${WB.DIM_LABEL[d]} gap`, kind: "div", color: gap30, value: r => r[`gap_${d}`], fmt: WB.fmtGap,
      ticks: [-30, -15, 0, 15, 30], title: `${WB.DIM_LABEL[d]} gap: ${GAPNOTE}` }])),
    profile: { label: "Development profile", kind: "cat", value: r => r.profile, title: "Development profile (k-means, nearest snapshot year ≤ selected year)" }
  };
  const snapshotFor = y => d3.max(WB.SNAPSHOTS.filter(s => s <= y));

  // row for a given country and year (profile comes from the nearest earlier snapshot)
  const rowOf = (iso, year) => {
    const r = byYearIso.get(year).get(iso);
    if (!r) return null;
    return Object.assign({}, r, { profile: byYearIso.get(snapshotFor(year)).get(iso).profile });
  };

  // ---- controls
  const metricSel = d3.select("#fig1-metric");
  metricSel.selectAll("option").data(Object.entries(METRICS)).join("option")
    .attr("value", d => d[0]).text(d => d[1].label);
  metricSel.property("value", S.mapMetric).on("change", function () { WB.set({ mapMetric: this.value }); });
  const regionSel = d3.select("#fig1-region");
  regionSel.selectAll("option").data(["World", ...regions]).join("option").attr("value", d => d).text(d => d);

  const defs = [
    { el: "#fig1-gdp", id: "gdp" },
    { el: "#fig1-gap", id: "right" }
  ];
  const maps = defs.map(def => {
    const container = document.querySelector(def.el);
    const W = WB.width(container, 520), H = W * 0.52;
    const proj = d3.geoEqualEarth().fitExtent([[0, 0], [W, H]], countries);
    const path = d3.geoPath(proj);
    const tip = WB.tooltip(container);
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H + 64}`)
      .attr("role", "img");
    svg.append("defs").append("clipPath").attr("id", `clip-${def.id}`).append("rect").attr("width", W).attr("height", H);
    const hatchId = `hatch-${def.id}`;
    const pat = svg.select("defs").append("pattern").attr("id", hatchId).attr("patternUnits", "userSpaceOnUse")
      .attr("width", 4).attr("height", 4).attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 4).attr("height", 4).attr("fill", "#fff");
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 4).attr("stroke", "#c5cbd2").attr("stroke-width", 1.2);
    const clipG = svg.append("g").attr("clip-path", `url(#clip-${def.id})`);
    clipG.append("rect").attr("width", W).attr("height", H).attr("fill", "transparent");
    const g = clipG.append("g");
    const paths = g.selectAll("path").data(countries.features).join("path")
      .attr("d", path).attr("class", "country")
      .attr("data-iso", f => numToIso.get(f.id) || null)
      .attr("fill", `url(#${hatchId})`)
      .on("click", (e, f) => { const iso = numToIso.get(f.id); if (iso) WB.toggleSelected(iso); })
      .on("mousemove", (e, f) => {
        const iso = numToIso.get(f.id), r = iso && rowOf(iso, S.year);
        tip.show(r ? `<strong>${r.name}</strong> (${S.year})<br>GDP pc ${WB.fmtUSD(r.gdp_pc)}<br>Well-being ${r.wellbeing.toFixed(1)} (gap ${WB.fmtGap(r.gap)})<br><span class="tip-hint">click to ${S.selected.has(iso) ? "deselect" : "select"}</span>`
                   : `<strong>${f.properties.name}</strong><br>not in sample`, e);
      })
      .on("mouseleave", tip.hide);
    const legendG = svg.append("g").attr("transform", `translate(14,${H + 22})`);
    const label = d3.select(container.parentNode).select(".map-title");
    return { def, container, W, H, svg, g, paths, legendG, hatchId, label, path };
  });

  // ---- shared zoom / pan
  maps.forEach(m => {
    m.zoom = d3.zoom().scaleExtent([1, 8]).extent([[0, 0], [m.W, m.H]]).translateExtent([[0, 0], [m.W, m.H]])
      .on("zoom", e => {
        m.g.attr("transform", e.transform);
        if (e.sourceEvent) maps.forEach(o => { if (o !== m) o.svg.call(o.zoom.transform, e.transform); });
      });
    m.svg.call(m.zoom).on("dblclick.zoom", null);
  });
  const zoomAll = (t, animate) => maps.forEach(m =>
    (animate ? m.svg.transition().duration(650) : m.svg).call(m.zoom.transform, t));
  regionSel.on("change", function () {
    const reg = this.value;
    const m0 = maps[0];
    if (reg === "World") return zoomAll(d3.zoomIdentity, true);
    const feats = countries.features.filter(f => { const iso = numToIso.get(f.id); return iso && info.get(iso).region === reg; });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    feats.forEach(f => { const [[a, b], [c, d]] = m0.path.bounds(f); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); });
    const k = Math.min(8, 0.9 / Math.max((x1 - x0) / m0.W, (y1 - y0) / m0.H));
    const t = d3.zoomIdentity.translate(m0.W / 2, m0.H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    zoomAll(t, true);
  });
  d3.select("#fig1-reset").on("click", () => { regionSel.property("value", "World"); zoomAll(d3.zoomIdentity, true); });

  // ---- legends
  function drawLegend(m, spec) {
    const g = m.legendG; g.selectAll("*").remove();
    const lw = Math.min(260, m.W - 40);
    if (spec.kind === "cat") {
      g.append("text").attr("class", "lab-muted").attr("y", -6).text(spec.title);
      WB.PROFILES.forEach((p, i) => {
        const x = (i % 3) * Math.min(150, m.W / 3.2), y = Math.floor(i / 3) * 16 + 6;
        g.append("rect").attr("x", x).attr("y", y).attr("width", 10).attr("height", 10).attr("fill", p.color);
        g.append("text").attr("class", "lab-muted").attr("x", x + 14).attr("y", y + 9).text(p.short);
      });
      return;
    }
    const isLog = spec.kind === "log";
    const x = isLog ? d3.scaleLog([1000, 100000], [0, lw]) : d3.scaleLinear(spec.color.domain().length === 3 ? [spec.color.domain()[0], spec.color.domain()[2]] : spec.color.domain(), [0, lw]);
    const gid = `grad-${m.def.id}`;
    m.svg.select(`#${gid}`).remove();
    const grad = m.svg.select("defs").append("linearGradient").attr("id", gid);
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", spec.color(x.invert(t * lw))));
    g.append("rect").attr("width", lw).attr("height", 9).attr("fill", `url(#${gid})`);
    g.selectAll("text.t").data(spec.ticks).join("text").attr("class", "lab-muted")
      .attr("x", d => x(d)).attr("y", 23).attr("text-anchor", "middle")
      .text(d => isLog ? WB.fmtUSD(d) : (spec.kind === "div" ? (d === 0 ? "0" : WB.fmtGap(d).replace(".0", "")) : d));
    g.append("text").attr("class", "lab-muted").attr("y", -6).text(spec.title);
    g.append("rect").attr("x", lw + 18).attr("width", 12).attr("height", 9).attr("fill", `url(#${m.hatchId})`).attr("stroke", "#c5cbd2");
    g.append("text").attr("class", "lab-muted").attr("x", lw + 34).attr("y", 8).text("not in sample");
  }
  const GDP_SPEC = { kind: "log", color: gdpColor, ticks: [1000, 3000, 10000, 30000, 100000], title: "GDP per capita, PPP (2021 intl $), log scale" };
  drawLegend(maps[0], GDP_SPEC);

  // ---- update
  function update(changed) {
    const spec = METRICS[S.mapMetric];
    const dur = changed && changed.includes("year") ? 520 : 350;
    maps.forEach((m, i) => {
      const color = i === 0 ? r => gdpColor(r.gdp_pc)
        : spec.kind === "cat" ? r => WB.profileColor(r.profile) : r => spec.color(spec.value(r));
      m.paths.each(function (f) {
        const iso = numToIso.get(f.id), r = iso && rowOf(iso, S.year);
        d3.select(this).transition().duration(dur).ease(d3.easeLinear)
          .attr("fill", r ? color(r) : `url(#${m.hatchId})`);
      });
      m.svg.attr("aria-label", i === 0 ? GDP_SPEC.title : spec.title);
      m.label.text(i === 0 ? `GDP per capita, ${S.year}` : `${spec.label}, ${S.year}`);
    });
    if (!changed || changed.includes("mapMetric")) drawLegend(maps[1], spec);
    metricSel.property("value", S.mapMetric);
    maps.forEach(m => { m.paths.classed("sel", f => S.selected.has(numToIso.get(f.id))); m.paths.filter(".sel").raise(); });
  }
  WB.on(["year", "mapMetric", "selected"], update);
  update();
}