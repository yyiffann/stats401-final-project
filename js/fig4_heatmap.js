// Figure 4 - Which dimensions drive the gap?
// Rows: the 20 most positive and 20 most negative gaps in 2022, ordered by Ward clustering of
// their five dimension gaps (dendrogram on the left). Cells: dimension score minus the score
// expected at that income. Last column: overall gap.
function drawFig4(data) {
  const { heat } = data;
  const byIso = new Map(heat.rows.map(r => [r.iso3, r]));
  const container = document.querySelector("#fig4");
  const W = WB.width(container, 1000);
  const tip = WB.tooltip(container);
  const narrow = W < 640;
  const rowH = 17;
  const cols = [...heat.dimensions.map(d => ({ key: `gap_${d}`, label: WB.DIM_LABEL[d] })),
                { key: "gap", label: "Overall gap" }];
  const dendW = narrow ? 50 : 110, nameW = narrow ? 104 : 150;
  const m = { t: 58, r: 10, b: 60, l: 4 };
  const cellW = Math.min(96, (W - m.l - m.r - dendW - nameW - 14) / cols.length);
  const root = d3.hierarchy(heat.tree);
  const leaves = root.leaves();
  const H = m.t + leaves.length * rowH + m.b;

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "Clustered heatmap of dimension-level well-being gaps");

  // dendrogram: x by merge height, y by leaf order
  const maxH = root.data.h;
  const dx = d3.scaleLinear([maxH, 0], [m.l, m.l + dendW]);
  leaves.forEach((l, i) => { l.y = m.t + i * rowH + rowH / 2; });
  root.eachAfter(n => { if (n.children) n.y = d3.mean(n.children, c => c.y); });
  svg.append("g").attr("fill", "none").attr("stroke", "var(--faint)").attr("stroke-width", 1)
    .selectAll("path").data(root.links()).join("path")
    .attr("d", l => `M${dx(l.source.data.h)},${l.source.y}V${l.target.y}H${dx(l.target.data.h)}`);

  // names
  const x0 = m.l + dendW + 8;
  svg.append("g").selectAll("text").data(leaves).join("text").attr("class", "lab")
    .attr("x", x0).attr("y", d => d.y + 4).text(d => byIso.get(d.data.iso3).name);

  // cells
  const cx0 = x0 + nameW;
  const colX = (i) => cx0 + i * cellW + (i === cols.length - 1 ? 10 : 0);
  svg.append("g").selectAll("text").data(cols).join("text").attr("class", "lab-strong")
    .attr("transform", (d, i) => `translate(${colX(i) + cellW / 2},${m.t - 10}) rotate(${narrow ? -40 : 0})`)
    .attr("text-anchor", narrow ? "start" : "middle").style("font-size", "11px").text(d => d.label);

  const cells = [];
  leaves.forEach(l => cols.forEach((c, i) => cells.push({ r: byIso.get(l.data.iso3), c, i, y: l.y })));
  const heatColor = d3.scaleDiverging([-30, 0, 30], t => WB.gapColor(-15 + 30 * t)).clamp(true);
  const cg = svg.append("g").selectAll("g").data(cells).join("g")
    .attr("transform", d => `translate(${colX(d.i)},${d.y - rowH / 2})`)
    .on("mousemove", (e, d) => tip.show(`<strong>${d.r.name}</strong><br>${d.c.label}: ${WB.fmtGap(d.r[d.c.key])} points vs. income peers`, e))
    .on("mouseleave", tip.hide);
  cg.append("rect").attr("width", cellW - 2).attr("height", rowH - 2)
    .attr("fill", d => heatColor(d.r[d.c.key]));
  if (!narrow) cg.append("text").attr("x", cellW / 2 - 1).attr("y", rowH / 2 + 3).attr("text-anchor", "middle")
    .style("font-size", "10px").style("font-variant-numeric", "tabular-nums")
    .style("fill", d => Math.abs(d.r[d.c.key]) >= 18 ? "#fff" : "var(--ink)")
    .text(d => { const v = Math.round(d.r[d.c.key]); return v === 0 ? "0" : d3.format("+")(v).replace("-", "−"); });

  // legend
  const lw = 220, ly = H - m.b + 26;
  const g = svg.append("g").attr("transform", `translate(${cx0},${ly})`);
  const lx = d3.scaleLinear([-30, 30], [0, lw]);
  const grad = svg.append("defs").append("linearGradient").attr("id", "grad-fig4");
  d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", heatColor(lx.invert(t * lw))));
  g.append("rect").attr("width", lw).attr("height", 9).attr("fill", "url(#grad-fig4)");
  g.selectAll("text.t").data([-30, -15, 0, 15, 30]).join("text").attr("class", "lab-muted")
    .attr("x", lx).attr("y", 23).attr("text-anchor", "middle").text(d => d === 0 ? "0" : d3.format("+")(d));
  g.append("text").attr("class", "lab-muted").attr("y", -6).text("Points above / below countries of similar income");
}
