// Figure 2 - Paths of progress: log GDP pc (x) vs well-being score (y)
// Grey bubbles = all countries in 2022; lines = the "expected well-being at this income" curve
// in 2000 and 2022; trails = 2000->2022 paths of six illustrative countries.
function drawFig2(data) {
  const { panel, curves } = data;
  const FOCUS = ["CHN", "IND", "ETH", "LKA", "NGA", "QAT"];
  const container = document.querySelector("#fig2");
  const W = WB.width(container, 1000), H = Math.max(420, Math.min(600, W * 0.56));
  const m = { t: 16, r: 24, b: 48, l: 104 };
  const tip = WB.tooltip(container);

  const x = d3.scaleLog([500, 200000], [m.l, W - m.r]).clamp(true);
  const y = d3.scaleLinear([10, 100], [H - m.b, m.t]);
  const r = d3.scaleSqrt([0, 1.4e9], [0, 26]);

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "Scatterplot of GDP per capita against well-being score with country trails");

  // grid + axes
  const xt = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  svg.append("g").attr("class", "grid").selectAll("line").data(xt).join("line")
    .attr("x1", x).attr("x2", x).attr("y1", m.t).attr("y2", H - m.b);
  svg.append("g").attr("class", "grid").selectAll("line").data(d3.range(20, 101, 20)).join("line")
    .attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(xt).tickFormat(WB.fmtUSD).tickSize(0).tickPadding(8));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8));
  svg.append("text").attr("class", "lab-muted").attr("x", W - m.r).attr("y", H - 8).attr("text-anchor", "end")
    .text("GDP per capita, PPP (log scale)");
  svg.append("text").attr("class", "lab-muted").attr("x", m.l).attr("y", m.t - 4)
    .text("Well-being score (0–100)");

  // all countries, 2022
  const now = panel.filter(d => d.year === 2022).sort((a, b) => b.pop - a.pop);
  svg.append("g").selectAll("circle").data(now).join("circle")
    .attr("cx", d => x(d.gdp_pc)).attr("cy", d => y(d.wellbeing)).attr("r", d => Math.max(2.2, r(d.pop)))
    .attr("fill", d => WB.gapColor(d.gap)).attr("fill-opacity", 0.75)
    .attr("stroke", "#fff").attr("stroke-width", 0.6)
    .on("mousemove", (e, d) => tip.show(`<strong>${d.name}</strong> (2022)<br>GDP pc ${WB.fmtUSD(d.gdp_pc)}<br>Well-being ${d.wellbeing.toFixed(1)}, expected ${d.expected.toFixed(1)}<br>Gap ${WB.fmtGap(d.gap)}`, e))
    .on("mouseleave", tip.hide);

  // expected curves
  const line = d3.line().x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveBasis);
  [["2000", "4 4", "Expected, 2000"], ["2022", null, "Expected, 2022"]].forEach(([yr, dash, lab]) => {
    const c = curves[yr];
    svg.append("path").attr("d", line(c)).attr("fill", "none")
      .attr("stroke", "var(--ink)").attr("stroke-width", 1.6).attr("stroke-dasharray", dash);
    const first = c[0];
    svg.append("text").attr("class", "lab-muted halo").attr("x", x(first[0]) - 6).attr("y", y(first[1]) + 4)
      .attr("text-anchor", "end").text(lab);
  });

  // focus trails
  const trails = d3.group(panel.filter(d => FOCUS.includes(d.iso3)), d => d.iso3);
  const tl = d3.line().x(d => x(d.gdp_pc)).y(d => y(d.wellbeing)).curve(d3.curveBasis);
  const g = svg.append("g");
  for (const [iso, rows] of trails) {
    rows.sort((a, b) => a.year - b.year);
    const end = rows[rows.length - 1], start = rows[0];
    // 3-year centred moving average (log GDP) so year-to-year noise does not dominate the path
    const sm = rows.map((d, i) => {
      const w = rows.slice(Math.max(0, i - 1), Math.min(rows.length, i + 2));
      return { gdp_pc: 10 ** d3.mean(w, v => Math.log10(v.gdp_pc)), wellbeing: d3.mean(w, v => v.wellbeing) };
    });
    sm[0] = start; sm[sm.length - 1] = end;
    const col = end.gap >= 0 ? "var(--above)" : "var(--below)";
    g.append("path").attr("d", tl(sm)).attr("fill", "none").attr("stroke", col).attr("stroke-width", 2.2);
    g.append("circle").attr("cx", x(start.gdp_pc)).attr("cy", y(start.wellbeing)).attr("r", 3)
      .attr("fill", "#fff").attr("stroke", col).attr("stroke-width", 1.5);
    g.append("circle").attr("cx", x(end.gdp_pc)).attr("cy", y(end.wellbeing)).attr("r", 4.5).attr("fill", col);
    const right = iso !== "QAT";
    const dy = { ETH: -10, NGA: 4, IND: 4, CHN: -8, LKA: -8, QAT: -10 }[iso] || 4;
    g.append("text").attr("class", "lab-strong halo")
      .attr("x", x(end.gdp_pc) + (right ? 8 : -8)).attr("y", y(end.wellbeing) + dy)
      .attr("text-anchor", right ? "start" : "end").text(`${end.name} ${WB.fmtGap(end.gap)}`);
  }

  // key
  const k = svg.append("g").attr("transform", `translate(${m.l + 14},${m.t + 18})`);
  k.append("circle").attr("r", 3).attr("fill", "#fff").attr("stroke", "var(--ink)");
  k.append("text").attr("class", "lab-muted").attr("x", 8).attr("y", 4).text("2000");
  k.append("circle").attr("cx", 52).attr("r", 4.5).attr("fill", "var(--ink)");
  k.append("text").attr("class", "lab-muted").attr("x", 60).attr("y", 4).text("2022 (label = gap in points)");
  k.append("text").attr("class", "lab-muted").attr("y", 22).text("Bubble area = population; colour = 2022 gap");
}
