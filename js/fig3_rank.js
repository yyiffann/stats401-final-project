// Figure 3 - Who beats (or trails) their income, and is it robust to how well-being is weighted?
// Bar = middle 90% of the gap over 2,000 random weightings (fixed, precomputed in Python).
// Hollow dot = gap with equal weights. Filled dot = gap under the user's own weights, recomputed
// in the browser with the same LOWESS fit as the pipeline (js/lowess.js), so dragging a slider
// shows at once whether the user's definition of well-being is typical or extreme.
function initFig3(data) {
  const { sens, byYearIso, regions } = data;
  const S = WB.state;
  const rows22 = [...byYearIso.get(2022).values()];
  const logx = rows22.map(d => Math.log10(d.gdp_pc));
  const sensBy = new Map(sens.map(d => [d.iso3, d]));
  const container = document.querySelector("#fig3");
  const tip = WB.tooltip(container);
  const N = rows22.length, rowH = 20;

  // ---- controls
  const wBox = d3.select("#fig3-weights");
  const wRows = wBox.selectAll("label.w").data(WB.DIMS).join("label").attr("class", "w");
  wRows.append("span").attr("class", "w-name").text(d => WB.DIM_LABEL[d]);
  wRows.append("input").attr("type", "range").attr("min", 0).attr("max", 100).attr("step", 1).attr("value", 50)
    .attr("aria-label", d => `Weight of ${WB.DIM_LABEL[d]}`)
    .on("input", function (e, d) { WB.set({ weights: { ...S.weights, [d]: +this.value } }); });
  wRows.append("output").attr("class", "w-val");
  d3.select("#fig3-reset").on("click", () => WB.set({ weights: Object.fromEntries(WB.DIMS.map(d => [d, 50])) }));
  d3.select("#fig3-rerank").on("change", function () { WB.set({ rerank: this.checked }); });
  const regSel = d3.select("#fig3-region");
  regSel.selectAll("option").data(["all", ...regions]).join("option").attr("value", d => d).text(d => d === "all" ? "All regions" : d);
  regSel.on("change", function () { WB.set({ region: this.value }); });

  function userGaps() {
    const tot = d3.sum(WB.DIMS, d => S.weights[d]);
    const w = WB.DIMS.map(d => tot > 0 ? S.weights[d] / tot : 1 / WB.DIMS.length);
    const score = rows22.map(r => d3.sum(WB.DIMS.map((d, j) => w[j] * r[d])));
    const fit = WB.lowess(logx, score);
    return new Map(rows22.map((r, i) => [r.iso3, score[i] - fit[i]]));
  }

  function render(changed) {
    const W = WB.width(container, 1000), narrow = W < 680;
    const m = { t: 40, r: narrow ? 66 : 270, b: 56, l: narrow ? 112 : 176 };
    const gaps = userGaps();
    const rank = new Map([...gaps].sort((a, b) => b[1] - a[1]).map(([iso], i) => [iso, i + 1]));
    const keyGap = S.rerank ? (iso => gaps.get(iso)) : (iso => sensBy.get(iso).gap_equal);

    const pool = rows22.filter(d => S.region === "all" || d.region === S.region).map(d => d.iso3).sort((a, b) => keyGap(b) - keyGap(a));
    const n = Math.max(1, Math.min(15, Math.floor(pool.length / 2)));
    const top = pool.slice(0, n), bottom = pool.length > 1 ? pool.slice(-n) : [];
    const shown = new Set([...top, ...bottom]);
    const extra = [...S.selected].filter(iso => gaps.has(iso) && !shown.has(iso)).sort((a, b) => keyGap(b) - keyGap(a)).slice(0, 12);
    const blocks = [
      { key: "top", title: S.region === "all" ? `${n} largest positive gaps${S.rerank ? " under your weights" : ""}` : `Top ${n} in ${S.region}`, isos: top },
      { key: "bottom", title: S.region === "all" ? `${n} largest negative gaps${S.rerank ? " under your weights" : ""}` : `Bottom ${n} in ${S.region}`, isos: bottom },
      { key: "extra", title: "Other selected countries", isos: extra }
    ].filter(b => b.isos.length);
    let cursor = m.t + 6;
    const items = [], titles = [];
    blocks.forEach(b => {
      titles.push({ title: b.title, y: cursor });
      cursor += 14;
      b.isos.forEach((iso, i) => items.push({ iso, y: cursor + i * rowH + rowH / 2, block: b.key }));
      cursor += b.isos.length * rowH + 30;
    });
    const H = cursor - 30 + m.b;

    const vals = items.flatMap(d => [gaps.get(d.iso), sensBy.get(d.iso).gap_p05, sensBy.get(d.iso).gap_p95]);
    const lo = Math.min(-40, Math.floor(d3.min(vals) / 10) * 10), hi = Math.max(25, Math.ceil(d3.max(vals) / 10) * 10);
    const ticks = d3.range(lo, hi + 1, 10);
    const x = d3.scaleLinear([lo, hi], [m.l, W - m.r]);
    container.querySelector("svg")?.remove();
    const svg = d3.select(container).insert("svg", ".tooltip").attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img").attr("aria-label", "Ranked dot plot of well-being gaps with weight-sensitivity intervals");
    svg.append("g").attr("class", "grid").selectAll("line").data(ticks).join("line")
      .attr("x1", x).attr("x2", x).attr("y1", m.t - 6).attr("y2", H - m.b);
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t - 6).attr("y2", H - m.b).attr("stroke", "var(--ink)");
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b + 4})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d => d === 0 ? "0" : WB.fmtGapInt(d)).tickSize(0));
    svg.append("text").attr("class", "lab-muted").attr("x", x(0)).attr("y", H - 28).attr("text-anchor", "middle")
      .text("Well-being gap vs. countries of similar income, 2022 (points)");
    // legend / key
    const key = svg.append("g").attr("transform", `translate(${m.l},${H - 10})`);
    key.append("line").attr("x1", 0).attr("x2", 30).attr("stroke", "var(--muted)").attr("stroke-opacity", .35).attr("stroke-width", 7).attr("stroke-linecap", "round");
    key.append("text").attr("class", "lab-muted").attr("x", 38).attr("y", 4).text("middle 90% of 2,000 random weightings");
    key.append("circle").attr("cx", 270).attr("r", 4.5).attr("fill", "#fff").attr("stroke", "var(--ink)").attr("stroke-width", 1.5);
    key.append("text").attr("class", "lab-muted").attr("x", 280).attr("y", 4).text("equal weights");
    key.append("circle").attr("cx", 372).attr("r", 4.5).attr("fill", "var(--ink)");
    key.append("text").attr("class", "lab-muted").attr("x", 382).attr("y", 4).text("your weights");

    const c1 = W - m.r + 10, c2 = c1 + 56, c3 = c2 + 62;
    svg.append("text").attr("class", "lab-muted").attr("x", c1).attr("y", m.t - 16).text(narrow ? "rank" : "your rank");
    if (!narrow) {
      svg.append("text").attr("class", "lab-muted").attr("x", c2).attr("y", m.t - 16).text("rank range");
      svg.append("text").attr("class", "lab-muted").attr("x", c3).attr("y", m.t - 16).text("region");
    }
    titles.forEach(t => svg.append("text").attr("class", "lab-strong").attr("x", 0).attr("y", t.y + 4).text(t.title));

    const byIso = new Map(items.map(d => [d.iso, d]));
    const g = svg.append("g").selectAll("g").data(items, d => d.iso).join("g").attr("class", "row")
      .attr("data-iso", d => d.iso)
      .attr("transform", d => `translate(0,${d.y})`)
      .on("click", (e, d) => WB.toggleSelected(d.iso))
      .on("mousemove", (e, d) => {
        const s = sensBy.get(d.iso);
        tip.show(`<strong>${s.name}</strong><br>Equal weights: gap ${WB.fmtGap(s.gap_equal)}, rank ${s.rank_equal} of ${N}<br>Your weights: gap ${WB.fmtGap(gaps.get(d.iso))}, rank ${rank.get(d.iso)}<br>Middle 90% of weightings: ${WB.fmtGap(s.gap_p05)} to ${WB.fmtGap(s.gap_p95)} (rank ${s.rank_p05}–${s.rank_p95})<br>Positive in ${(s.share_positive * 100).toFixed(0)}% of weightings<br><span class="tip-hint">click to ${S.selected.has(d.iso) ? "deselect" : "select"}</span>`, e);
      })
      .on("mouseleave", tip.hide);
    g.append("rect").attr("class", "row-bg").attr("x", 0).attr("y", -rowH / 2).attr("width", W).attr("height", rowH);
    g.append("text").attr("class", "lab").attr("x", m.l - 10).attr("y", 4).attr("text-anchor", "end").text(d => sensBy.get(d.iso).name);
    g.append("line").attr("x1", d => x(sensBy.get(d.iso).gap_p05)).attr("x2", d => x(sensBy.get(d.iso).gap_p95))
      .attr("stroke", d => sensBy.get(d.iso).gap_equal >= 0 ? "var(--above)" : "var(--below)").attr("stroke-opacity", .35)
      .attr("stroke-width", 7).attr("stroke-linecap", "round");
    g.append("circle").attr("cx", d => x(sensBy.get(d.iso).gap_equal)).attr("r", 4.5).attr("fill", "#fff")
      .attr("stroke", d => sensBy.get(d.iso).gap_equal >= 0 ? "var(--above)" : "var(--below)").attr("stroke-width", 1.6);
    g.append("circle").attr("r", 4.5).attr("stroke", "#fff")
      .attr("fill", d => gaps.get(d.iso) >= 0 ? "var(--above)" : "var(--below)")
      .attr("cx", d => x(gaps.get(d.iso)));
    g.append("text").attr("class", "lab").attr("x", c1).attr("y", 4).style("font-weight", 650).text(d => rank.get(d.iso));
    if (!narrow) {
      g.append("text").attr("class", "lab-muted").attr("x", c2).attr("y", 4).text(d => `${sensBy.get(d.iso).rank_p05}–${sensBy.get(d.iso).rank_p95}`);
      g.append("text").attr("class", "lab-muted").attr("x", c3).attr("y", 4).text(d => sensBy.get(d.iso).region);
    }
    WB.applySel(container);
    container.dataset.rows = items.length;

    // controls reflect state
    const tot = d3.sum(WB.DIMS, d => S.weights[d]) || 1;
    wRows.select("input").property("value", d => S.weights[d]);
    wRows.select("output").text(d => `${Math.round(100 * S.weights[d] / tot)}%`);
    d3.select("#fig3-rerank").property("checked", S.rerank);
    regSel.property("value", S.region);
  }
  WB.on(["weights", "rerank", "region", "selected"], render);
  window.addEventListener("resize", () => render());
  render();
}