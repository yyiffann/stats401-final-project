// Figure 4 - Which dimensions drive the gap?
// Cells: a dimension's score minus the score expected at that income, 2022. Two row sets:
//   "cluster": the 20 largest positive and 20 largest negative gaps, ordered by a Ward
//              clustering of their five dimension gaps (dendrogram on the left; click a branch
//              to select the whole group in every view);
//   "selected": whatever countries are selected in the other views.
// Click a column header to sort (descending, ascending, back to the default order).
function initFig4(data) {
  const { heat, byYearIso } = data;
  const S = WB.state;
  const rows22 = byYearIso.get(2022);
  const heatBy = new Map(heat.rows.map(r => [r.iso3, r]));
  const rowFor = iso => heatBy.get(iso) || rows22.get(iso);
  const container = document.querySelector("#fig4");
  const W = WB.width(container, 1000);
  const tip = WB.tooltip(container);
  const narrow = W < 640;
  const rowH = 17, MAXSEL = 40;
  const cols = [...heat.dimensions.map(d => ({ key: `gap_${d}`, label: WB.DIM_LABEL[d] })), { key: "gap", label: "Overall gap" }];
  const dendW = narrow ? 50 : 110, nameW = narrow ? 104 : 150;
  const m = { t: 62, r: 10, b: 62, l: 4 };
  const cellW = Math.min(96, (W - m.l - m.r - dendW - nameW - 14) / cols.length);
  const x0 = m.l + dendW + 8, cx0 = x0 + nameW;
  const colX = i => cx0 + i * cellW + (i === cols.length - 1 ? 10 : 0);
  const heatColor = d3.scaleDiverging([-30, 0, 30], t => WB.gapColor(-15 + 30 * t)).clamp(true);

  const root = d3.hierarchy(heat.tree);
  const leaves = root.leaves();
  const clusterOrder = leaves.map(l => l.data.iso3);
  const maxH = root.data.h;
  const dx = d3.scaleLinear([maxH, 0], [m.l, m.l + dendW]);
  leaves.forEach((l, i) => { l.y = m.t + i * rowH + rowH / 2; });
  root.eachAfter(n => { if (n.children) n.y = d3.mean(n.children, c => c.y); });

  const svg = d3.select(container).append("svg").attr("role", "img")
    .attr("aria-label", "Clustered heatmap of dimension-level well-being gaps");
  const dendG = svg.append("g").attr("class", "dend");
  dendG.append("g").attr("fill", "none").attr("stroke", "var(--faint)").selectAll("path").data(root.links()).join("path")
    .attr("d", l => `M${dx(l.source.data.h)},${l.source.y}V${l.target.y}H${dx(l.target.data.h)}`);
  dendG.append("g").selectAll("circle").data(root.descendants().filter(n => n.children)).join("circle")
    .attr("class", "dend-node").attr("cx", n => dx(n.data.h)).attr("cy", n => n.y).attr("r", 4)
    .on("mouseenter", (e, n) => {
      const isos = new Set(n.leaves().map(l => l.data.iso3));
      svg.selectAll("g.row").classed("grp", d => isos.has(d));
      tip.show(`<strong>${isos.size} countries</strong><br><span class="tip-hint">click to select this group everywhere</span>`, e);
    })
    .on("mouseleave", () => { svg.selectAll("g.row").classed("grp", false); tip.hide(); })
    .on("click", (e, n) => WB.select(n.leaves().map(l => l.data.iso3)));

  const head = svg.append("g").selectAll("text").data(cols).join("text").attr("class", "lab-strong col-head")
    .attr("transform", (d, i) => `translate(${colX(i) + cellW / 2},${m.t - 12}) rotate(${narrow ? -40 : 0})`)
    .attr("text-anchor", narrow ? "start" : "middle").style("font-size", "11px")
    .on("click", (e, d) => {
      const cur = S.fig4Sort;
      WB.set({ fig4Sort: !cur || cur.key !== d.key ? { key: d.key, dir: "desc" } : cur.dir === "desc" ? { key: d.key, dir: "asc" } : null });
    });
  const rowsG = svg.append("g");
  const emptyMsg = svg.append("text").attr("class", "lab-muted").attr("x", x0).attr("y", m.t + 30)
    .text("Select countries in any view (click, or drag on Figure 2) to compare them here.");
  const legendG = svg.append("g");

  // legend (static position is set in update because height varies)
  const lw = 220, lx = d3.scaleLinear([-30, 30], [0, lw]);
  const grad = svg.append("defs").append("linearGradient").attr("id", "grad-fig4");
  d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", heatColor(lx.invert(t * lw))));
  legendG.append("rect").attr("width", lw).attr("height", 9).attr("fill", "url(#grad-fig4)");
  legendG.selectAll("text.t").data([-30, -15, 0, 15, 30]).join("text").attr("class", "lab-muted")
    .attr("x", lx).attr("y", 23).attr("text-anchor", "middle").text(d => d === 0 ? "0" : d3.format("+")(d).replace("-", "−"));
  legendG.append("text").attr("class", "lab-muted").attr("y", -6).text("Points above / below countries of similar income");

  function order() {
    let isos;
    if (S.fig4Mode === "cluster") isos = clusterOrder.slice();
    else isos = [...S.selected].filter(i => rows22.has(i)).sort((a, b) => rows22.get(b).gap - rows22.get(a).gap).slice(0, MAXSEL);
    const s = S.fig4Sort;
    if (s) isos.sort((a, b) => (s.dir === "desc" ? -1 : 1) * (rowFor(a)[s.key] - rowFor(b)[s.key]));
    return isos;
  }

  function update() {
    const isos = order();
    const showDend = S.fig4Mode === "cluster" && !S.fig4Sort;
    const n = Math.max(isos.length, 3);
    const H = m.t + n * rowH + m.b;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    legendG.attr("transform", `translate(${cx0},${H - m.b + 26})`);
    dendG.style("pointer-events", showDend ? "all" : "none").transition().duration(300).attr("opacity", showDend ? 1 : 0);
    emptyMsg.attr("opacity", isos.length ? 0 : 1);
    head.text(d => d.label + (S.fig4Sort && S.fig4Sort.key === d.key ? (S.fig4Sort.dir === "desc" ? " ▼" : " ▲") : ""));

    const items = isos.map((iso, i) => ({ iso, y: m.t + i * rowH + rowH / 2 }));
    rowsG.selectAll("g.row").data(items, d => d.iso).join(
      enter => {
        const g = enter.append("g").attr("class", "row").attr("data-iso", d => d.iso)
          .attr("transform", d => `translate(0,${d.y})`).attr("opacity", 0);
        g.append("rect").attr("class", "row-bg").attr("x", x0 - 4).attr("y", -rowH / 2).attr("width", nameW + cols.length * cellW + 16).attr("height", rowH);
        g.append("text").attr("class", "lab name").attr("x", x0).attr("y", 4).text(d => rowFor(d.iso).name);
        const cg = g.selectAll("g.cell").data(d => cols.map((c, i) => ({ r: rowFor(d.iso), c, i }))).join("g").attr("class", "cell")
          .attr("transform", d => `translate(${colX(d.i)},${-rowH / 2})`);
        cg.append("rect").attr("width", cellW - 2).attr("height", rowH - 2).attr("fill", d => heatColor(d.r[d.c.key]));
        if (!narrow) cg.append("text").attr("x", cellW / 2 - 1).attr("y", rowH / 2 + 3).attr("text-anchor", "middle")
          .style("font-size", "10px").style("font-variant-numeric", "tabular-nums")
          .style("fill", d => Math.abs(d.r[d.c.key]) >= 18 ? "#fff" : "var(--ink)").text(d => WB.fmtGapInt(d.r[d.c.key]));
        g.on("click", (e, d) => WB.toggleSelected(d.iso))
          .on("mousemove", (e, d) => {
            const r = rowFor(d.iso), cell = e.target.closest("g.cell");
            const c = cell ? d3.select(cell).datum().c : null;
            tip.show(`<strong>${r.name}</strong><br>${c ? `${c.label}: ${WB.fmtGap(r[c.key])} points vs. income peers` : `Overall gap ${WB.fmtGap(r.gap)}`}<br><span class="tip-hint">click to ${S.selected.has(d.iso) ? "deselect" : "select"}</span>`, e);
          })
          .on("mouseleave", tip.hide);
        g.transition("fade").duration(300).attr("opacity", 1);
        return g;
      },
      upd => upd,
      exit => exit.transition("fade").duration(200).attr("opacity", 0).remove()
    ).transition().duration(600).attr("transform", d => `translate(0,${d.y})`);
    WB.applySel(container);
    d3.select("#fig4-mode").property("value", S.fig4Mode);
    d3.select("#fig4-resetsort").property("disabled", !S.fig4Sort);
  }
  d3.select("#fig4-mode").on("change", function () { WB.set({ fig4Mode: this.value }); });
  d3.select("#fig4-resetsort").on("click", () => WB.set({ fig4Sort: null }));
  WB.on(["fig4Mode", "fig4Sort", "selected"], update);
  update();
}