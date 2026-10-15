// Figure 2 - Paths of progress: GDP per capita (x, log) against well-being (y).
// Every country is a bubble that moves with the global year slider; the black curve is the
// "expected well-being at this income" for that year. Selected countries leave a trail from
// 2000. The y-axis can switch from the score to the gap (distance from the curve), and a
// brush on the plot selects a group of countries for all other views.
function initFig2(data) {
  const { curves, byIso, byYearIso, info, gapExtent } = data;
  const S = WB.state;
  const container = document.querySelector("#fig2");
  const W = WB.width(container, 1000), H = Math.max(440, Math.min(620, W * 0.58));
  const m = { t: 22, r: 24, b: 48, l: 64 };
  const tip = WB.tooltip(container);

  const x = d3.scaleLog([500, 200000], [m.l, W - m.r]).clamp(true);
  const gLo = Math.floor((gapExtent[0] - 3) / 5) * 5, gHi = Math.ceil((gapExtent[1] + 3) / 5) * 5;
  const yScale = { score: d3.scaleLinear([10, 100], [H - m.b, m.t]), gap: d3.scaleLinear([gLo, gHi], [H - m.b, m.t]) };
  const r = d3.scaleSqrt([0, 1.5e9], [0, 26]);
  const val = (d, mode) => mode === "score" ? d.wellbeing : d.gap;

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "Scatterplot of GDP per capita against well-being with country trails");

  const xt = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const gridX = svg.append("g").attr("class", "grid");
  gridX.selectAll("line").data(xt).join("line").attr("x1", x).attr("x2", x).attr("y1", m.t).attr("y2", H - m.b);
  const gridY = svg.append("g").attr("class", "grid");
  const axisY = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(xt).tickFormat(WB.fmtUSD).tickSize(0).tickPadding(8));
  svg.append("text").attr("class", "lab-muted").attr("x", W - m.r).attr("y", H - 8).attr("text-anchor", "end")
    .text("GDP per capita, PPP (log scale)");
  const yLabel = svg.append("text").attr("class", "lab-muted").attr("x", m.l).attr("y", m.t - 8);
  const zeroLine = svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("stroke", "var(--ink)").attr("stroke-width", 1.4);
  const zeroLab = svg.append("text").attr("class", "lab-muted halo").attr("x", W - m.r - 4).attr("text-anchor", "end")
    .text("countries of similar income (gap = 0)");

  // brush first, so bubbles sit above it and stay clickable
  const brushG = svg.append("g").attr("class", "brush");
  const brush = d3.brush().extent([[m.l, m.t], [W - m.r, H - m.b]])
    .on("end", e => {
      if (!e.sourceEvent || !e.selection) return;
      const [[bx0, by0], [bx1, by1]] = e.selection;
      const rows = [...byYearIso.get(S.year).values()];
      const hit = rows.filter(d => { const px = x(d.gdp_pc), py = yScale[S.yMode](val(d, S.yMode)); return px >= bx0 && px <= bx1 && py >= by0 && py <= by1; }).map(d => d.iso3);
      brushG.call(brush.move, null);
      if (hit.length) WB.select(hit, e.sourceEvent.shiftKey ? "add" : "replace");
    });
  brushG.call(brush);

  const curveG = svg.append("g").style("pointer-events", "none");
  const curve0 = curveG.append("path").attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 1.4).attr("stroke-dasharray", "4 4");
  const curve1 = curveG.append("path").attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 1.8);
  const curveLab0 = curveG.append("text").attr("class", "lab-muted halo").attr("text-anchor", "end");
  const curveLab1 = curveG.append("text").attr("class", "lab-muted halo").attr("text-anchor", "end");
  const line = d3.line().x(d => x(d[0])).curve(d3.curveBasis);

  const order = [...info.values()].sort((a, b) => b.pop - a.pop).map(d => d.iso3);
  const bubbles = svg.append("g").selectAll("circle").data(order).join("circle")
    .attr("class", "bubble").attr("data-iso", d => d)
    .on("click", (e, iso) => WB.toggleSelected(iso))
    .on("mousemove", (e, iso) => {
      const d = byYearIso.get(S.year).get(iso);
      tip.show(`<strong>${d.name}</strong> (${S.year})<br>GDP pc ${WB.fmtUSD(d.gdp_pc)}<br>Well-being ${d.wellbeing.toFixed(1)}, expected ${d.expected.toFixed(1)}<br>Gap ${WB.fmtGap(d.gap)}<br><span class="tip-hint">click to ${S.selected.has(iso) ? "deselect" : "select"}</span>`, e);
    })
    .on("mouseleave", tip.hide);

  const trailG = svg.append("g").style("pointer-events", "none");

  // key
  const k = svg.append("g").attr("transform", `translate(${m.l + 14},${m.t + 16})`).style("pointer-events", "none");
  k.append("text").attr("class", "lab-muted").text("Bubble area = population; colour = gap; ring = selected");
  k.append("text").attr("class", "lab-muted").attr("y", 16).text("Trails run from 2000 (hollow) to the chosen year (filled)");

  const smooth = rows => rows.map((d, i) => {
    const w = rows.slice(Math.max(0, i - 1), Math.min(rows.length, i + 2));
    return { year: d.year, gdp_pc: 10 ** d3.mean(w, v => Math.log10(v.gdp_pc)), v: { score: d3.mean(w, v => v.wellbeing), gap: d3.mean(w, v => v.gap) } };
  });

  function update(changed) {
    const mode = S.yMode, y = yScale[mode];
    const yearChange = changed && changed.length === 1 && changed[0] === "year";
    const dur = yearChange ? 520 : 450;
    const rows = byYearIso.get(S.year);

    // axes
    axisY.transition().duration(dur).call(d3.axisLeft(y).ticks(mode === "score" ? 5 : 8).tickSize(0).tickPadding(8)
      .tickFormat(mode === "score" ? d3.format("d") : (d => d === 0 ? "0" : WB.fmtGapInt(d))));
    const yt = mode === "score" ? d3.range(20, 101, 20) : d3.range(gLo, gHi + 1, 5);
    gridY.selectAll("line").data(yt, d => d).join("line").attr("x1", m.l).attr("x2", W - m.r)
      .transition().duration(dur).attr("y1", y).attr("y2", y);
    yLabel.text(mode === "score" ? "Well-being score (0–100)" : "Well-being gap (points above / below the expected value)");
    zeroLine.transition().duration(dur).attr("y1", y(0)).attr("y2", y(0)).attr("opacity", mode === "gap" ? 1 : 0);
    zeroLab.transition().duration(dur).attr("y", y(0) - 6).attr("opacity", mode === "gap" ? 1 : 0);

    // expected curve for this year (and 2000 as a reference)
    const c1 = curves[String(S.year)], c0 = curves["2000"];
    const showCurve = mode === "score";
    curve1.attr("d", line.y(d => y(d[1]))(c1)).attr("opacity", showCurve ? 1 : 0);
    curve0.attr("d", line.y(d => y(d[1]))(c0)).attr("opacity", showCurve && S.year !== 2000 ? 0.7 : 0);
    curveLab1.attr("x", x(c1[0][0]) - 6).attr("y", y(c1[0][1]) + 4).attr("opacity", showCurve ? 1 : 0).text(`Expected, ${S.year}`);
    curveLab0.attr("x", x(c0[0][0]) - 6).attr("y", y(c0[0][1]) + 16).attr("opacity", showCurve && S.year !== 2000 ? 1 : 0).text("Expected, 2000");

    // bubbles
    const any = S.selected.size > 0;
    bubbles.classed("sel", d => S.selected.has(d)).classed("dim", d => any && !S.selected.has(d))
      .transition().duration(dur).ease(d3.easeLinear)
      .attr("cx", d => x(rows.get(d).gdp_pc)).attr("cy", d => y(val(rows.get(d), mode)))
      .attr("r", d => Math.max(2.4, r(rows.get(d).pop)))
      .attr("fill", d => WB.gapColor(rows.get(d).gap));
    bubbles.filter(".sel").raise();

    // trails + labels for the selection
    const sel = [...S.selected].filter(iso => rows.has(iso));
    const many = sel.length > 8;
    trailG.selectAll("*").remove();
    const tl = d3.line().x(d => x(d.gdp_pc)).y(d => y(d.v[mode])).curve(d3.curveBasis);
    const labels = [];
    sel.forEach(iso => {
      const hist = byIso.get(iso).filter(d => d.year <= S.year);
      if (hist.length < 2) return;
      const sm = smooth(hist); sm[0] = { year: hist[0].year, gdp_pc: hist[0].gdp_pc, v: { score: hist[0].wellbeing, gap: hist[0].gap } };
      const last = hist[hist.length - 1]; sm[sm.length - 1] = { year: last.year, gdp_pc: last.gdp_pc, v: { score: last.wellbeing, gap: last.gap } };
      const col = last.gap >= 0 ? "var(--above)" : "var(--below)";
      trailG.append("path").attr("d", tl(sm)).attr("fill", "none").attr("stroke", col).attr("stroke-width", many ? 1.2 : 2.2).attr("stroke-opacity", many ? 0.6 : 1);
      trailG.append("circle").attr("cx", x(sm[0].gdp_pc)).attr("cy", y(sm[0].v[mode])).attr("r", 3).attr("fill", "#fff").attr("stroke", col).attr("stroke-width", 1.5);
      if (!many) labels.push({ iso, name: last.name, gap: last.gap, px: x(last.gdp_pc), py: y(val(last, mode)), col });
    });
    // simple label de-collision: sort by y, push down when closer than 13px
    labels.sort((a, b) => a.py - b.py);
    let prev = -Infinity;
    labels.forEach(l => { l.ly = Math.max(l.py + 4, prev + 13); prev = l.ly; });
    labels.forEach(l => {
      const right = l.px < W - 170;
      trailG.append("text").attr("class", "lab-strong halo").attr("x", l.px + (right ? 10 : -10)).attr("y", l.ly)
        .attr("text-anchor", right ? "start" : "end").text(`${l.name} ${WB.fmtGap(l.gap)}`);
    });
    d3.select("#fig2-ymode").property("value", mode);
  }

  d3.select("#fig2-ymode").on("change", function () { WB.set({ yMode: this.value }); });
  WB.on(["year", "yMode", "selected"], update);
  update();
}