// Figure 3 - Who beats (or trails) their income, and is it robust to how well-being is weighted?
// Dot = gap with equal dimension weights; bar = 5th-95th percentile of the gap over
// 2,000 random weightings (Dirichlet, alpha = 2). Right column = rank range across weightings.
function drawFig3(data, n = 15) {
  const all = data.sens.slice().sort((a, b) => b.gap_equal - a.gap_equal);
  const top = all.slice(0, n), bottom = all.slice(-n);
  const N = all.length;
  const container = document.querySelector("#fig3");
  const W = WB.width(container, 1000);
  const tip = WB.tooltip(container);
  const narrow = W < 640;
  const rowH = 20, gapH = 46;
  const m = { t: 34, r: narrow ? 70 : 200, b: 40, l: narrow ? 118 : 180 };
  const H = m.t + rowH * n * 2 + gapH + m.b;

  const x = d3.scaleLinear([-40, 22], [m.l, W - m.r]);
  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "Ranked dot plot of well-being gaps with uncertainty intervals");

  svg.append("g").attr("class", "grid").selectAll("line").data(d3.range(-40, 21, 10)).join("line")
    .attr("x1", x).attr("x2", x).attr("y1", m.t - 8).attr("y2", H - m.b);
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t - 8).attr("y2", H - m.b)
    .attr("stroke", "var(--ink)").attr("stroke-width", 1);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b + 4})`)
    .call(d3.axisBottom(x).tickValues(d3.range(-40, 21, 10)).tickFormat(d => d === 0 ? "0" : WB.fmtGap(d).replace(".0", "")).tickSize(0));
  svg.append("text").attr("class", "lab-muted").attr("x", x(0)).attr("y", H - 6).attr("text-anchor", "middle")
    .text("Well-being gap vs. countries of similar income (points)");
  svg.append("text").attr("class", "lab-muted").attr("x", W - m.r + 12).attr("y", m.t - 14)
    .text(narrow ? "rank" : `rank range of ${N}, region`);

  const blocks = [
    { rows: top, y0: m.t, title: `${n} largest positive gaps` },
    { rows: bottom, y0: m.t + rowH * n + gapH, title: `${n} largest negative gaps` }
  ];
  blocks.forEach(b => {
    svg.append("text").attr("class", "lab-strong").attr("x", 0).attr("y", b.y0 - 14).text(b.title);
    const g = svg.append("g").selectAll("g").data(b.rows).join("g")
      .attr("transform", (d, i) => `translate(0,${b.y0 + i * rowH + rowH / 2})`)
      .on("mousemove", (e, d) => tip.show(`<strong>${d.name}</strong><br>Gap ${WB.fmtGap(d.gap_equal)} (90% of weightings: ${WB.fmtGap(d.gap_p05)} to ${WB.fmtGap(d.gap_p95)})<br>Rank ${d.rank_equal}; ranges ${d.rank_p05}–${d.rank_p95}<br>Positive in ${(d.share_positive * 100).toFixed(0)}% of weightings`, e))
      .on("mouseleave", tip.hide);
    g.append("rect").attr("x", 0).attr("y", -rowH / 2).attr("width", W).attr("height", rowH).attr("fill", "transparent");
    g.append("text").attr("class", "lab").attr("x", m.l - 10).attr("y", 4).attr("text-anchor", "end").text(d => d.name);
    g.append("line").attr("x1", d => x(d.gap_p05)).attr("x2", d => x(d.gap_p95))
      .attr("stroke", d => d.gap_equal >= 0 ? "var(--above)" : "var(--below)").attr("stroke-opacity", 0.35)
      .attr("stroke-width", 7).attr("stroke-linecap", "round");
    g.append("circle").attr("cx", d => x(d.gap_equal)).attr("r", 4.5)
      .attr("fill", d => d.gap_equal >= 0 ? "var(--above)" : "var(--below)").attr("stroke", "#fff");
    g.append("text").attr("class", "lab-muted").attr("x", W - m.r + 12).attr("y", 4)
      .text(d => `${d.rank_p05}–${d.rank_p95}`);
    if (!narrow) g.append("text").attr("class", "lab-muted").attr("x", W - m.r + 72).attr("y", 4)
      .text(d => d.region);
  });

  // interval key
  const kx = x(-38), ky = m.t + 4;
  const k = svg.append("g").attr("transform", `translate(${kx},${ky})`);
  k.append("line").attr("x1", 0).attr("x2", 40).attr("stroke", "var(--muted)").attr("stroke-opacity", 0.35).attr("stroke-width", 7).attr("stroke-linecap", "round");
  k.append("circle").attr("cx", 22).attr("r", 4.5).attr("fill", "var(--muted)").attr("stroke", "#fff");
  if (!narrow) k.append("text").attr("class", "lab-muted").attr("x", 52).attr("y", 4).text("dot: equal weights; bar: middle 90% of 2,000 random weightings");
}
