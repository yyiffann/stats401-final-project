// Figure 1 - Where is prosperity, and where does well-being beat it?
// Two choropleths for 2022: GDP per capita (sequential, log) and well-being gap (diverging)
function drawFig1(data, year = 2022) {
  const { panel, world } = data;
  const rows = new Map(panel.filter(d => d.year === year)
    .map(d => [String(d.iso_num).padStart(3, "0"), d]));
  const countries = topojson.feature(world, world.objects.countries);
  countries.features = countries.features.filter(f => f.properties.name !== "Antarctica");

  const gdpColor = d3.scaleSequentialLog([1000, 100000],
    d3.interpolateRgbBasis(["#eef2f6", "#b9cde0", "#5f8fbd", "#1f4e79", "#0f2a44"])).clamp(true);

  const maps = [
    { el: "#fig1-gdp", value: d => d.gdp_pc, color: gdpColor, fmt: WB.fmtUSD,
      legend: { type: "log", ticks: [1000, 3000, 10000, 30000, 100000], label: "GDP per capita, PPP (2021 intl $)" } },
    { el: "#fig1-gap", value: d => d.gap, color: WB.gapColor, fmt: WB.fmtGap,
      legend: { type: "div", ticks: [-15, -10, -5, 0, 5, 10, 15], label: "Well-being gap: points above (+) or below (−) countries of similar income" } }
  ];

  maps.forEach(m => {
    const container = document.querySelector(m.el);
    const W = WB.width(container, 520), H = W * 0.52;
    const proj = d3.geoEqualEarth().fitExtent([[0, 0], [W, H]], countries);
    const path = d3.geoPath(proj);
    const tip = WB.tooltip(container);
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H + 58}`)
      .attr("role", "img").attr("aria-label", m.legend.label);
    const hatchId = `hatch-${m.el.slice(1)}`;
    const pat = svg.append("defs").append("pattern").attr("id", hatchId).attr("patternUnits", "userSpaceOnUse")
      .attr("width", 4).attr("height", 4).attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 4).attr("height", 4).attr("fill", "#fff");
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 4).attr("stroke", "#c5cbd2").attr("stroke-width", 1.2);

    svg.append("g").selectAll("path").data(countries.features).join("path")
      .attr("d", path)
      .attr("fill", f => { const r = rows.get(f.id); return r ? m.color(m.value(r)) : `url(#${hatchId})`; })
      .attr("stroke", "#fff").attr("stroke-width", 0.4)
      .on("mousemove", (e, f) => {
        const r = rows.get(f.id);
        tip.show(r ? `<strong>${r.name}</strong><br>GDP pc ${WB.fmtUSD(r.gdp_pc)}<br>Well-being ${r.wellbeing.toFixed(1)} (gap ${WB.fmtGap(r.gap)})`
                   : `<strong>${f.properties.name}</strong><br>not in sample`, e);
      })
      .on("mouseleave", tip.hide);

    // legend
    const lw = Math.min(260, W - 40), lx = 14, ly = H + 18;
    const g = svg.append("g").attr("transform", `translate(${lx},${ly})`);
    const x = m.legend.type === "log" ? d3.scaleLog([1000, 100000], [0, lw]) : d3.scaleLinear([-15, 15], [0, lw]);
    const id = `grad-${m.el.slice(1)}`;
    const grad = svg.append("defs").append("linearGradient").attr("id", id);
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t)
      .attr("stop-color", m.color(x.invert(t * lw))));
    g.append("rect").attr("width", lw).attr("height", 9).attr("fill", `url(#${id})`);
    g.selectAll("text.t").data(m.legend.ticks).join("text").attr("class", "lab-muted")
      .attr("x", d => x(d)).attr("y", 23).attr("text-anchor", "middle")
      .text(d => m.legend.type === "log" ? WB.fmtUSD(d) : WB.fmtGap(d).replace("+0.0", "0").replace(".0", ""));
    g.append("text").attr("class", "lab-muted").attr("y", -6).text(m.legend.label);
    if (m.legend.type === "log") {
      g.append("rect").attr("x", lw + 18).attr("width", 12).attr("height", 9).attr("fill", `url(#${hatchId})`).attr("stroke", "#c5cbd2");
      g.append("text").attr("class", "lab-muted").attr("x", lw + 34).attr("y", 8).text("not in sample");
    }
  });
}
