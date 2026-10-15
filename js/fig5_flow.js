// Figure 5 - Which countries moved to a higher stage of development?
// An alluvial diagram of the five development profiles at four snapshot years. The horizontal
// axis is true time (2000 -> 2022), so the gaps between columns are uneven. Ribbons are
// countries that moved (or stayed) between snapshots, sized by number of countries or by
// population. Clicking a ribbon or a block selects those countries in every other view; the
// countries already selected elsewhere are drawn as an orange overlay inside the ribbons.
function initFig5(data) {
  const { byYearIso, info } = data;
  const S = WB.state;
  const SNAPS = WB.SNAPSHOTS;
  const P = WB.PROFILES, pIndex = new Map(P.map((p, i) => [p.id, i]));
  const container = document.querySelector("#fig5");
  const tip = WB.tooltip(container);
  const isos = [...info.keys()];
  const path = new Map(isos.map(iso => [iso, SNAPS.map(y => byYearIso.get(y).get(iso).profile)]));
  const popOf = (iso, ci) => byYearIso.get(SNAPS[ci]).get(iso).pop;
  const nameOf = iso => info.get(iso).name;
  const fmtPop = v => v >= 1e9 ? d3.format(".2f")(v / 1e9) + " billion" : d3.format(".0f")(v / 1e6) + " million";

  const W = WB.width(container, 1000), narrow = W < 700;
  const H = Math.max(400, Math.min(500, W * 0.46));
  const m = { t: 40, r: narrow ? 14 : 214, b: 20, l: narrow ? 14 : 214 }, nodeW = 14, pad = 12;
  const colX = d3.scaleLinear([SNAPS[0], SNAPS[SNAPS.length - 1]], [m.l, W - m.r - nodeW]);

  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img").attr("aria-label", "Alluvial diagram of development profiles in 2000, 2008, 2015 and 2022");
  const g = svg.append("g");
  const marker = svg.append("g").style("pointer-events", "none");
  const markerLine = marker.append("line").attr("y1", m.t - 8).attr("y2", H - m.b).attr("stroke", "var(--ink)").attr("stroke-dasharray", "3 3").attr("stroke-width", 1);
  const markerText = marker.append("text").attr("class", "lab-strong halo").attr("y", H - m.b - 4).attr("text-anchor", "middle");

  const weightOf = (iso, ci) => S.fig5Weight === "pop" ? popOf(iso, ci) : 1;
  const fmtVal = v => S.fig5Weight === "pop" ? fmtPop(v) : `${v} ${v === 1 ? "country" : "countries"}`;

  function ribbon(x0, y0, x1, y1, h) {
    const xm = (x0 + x1) / 2;
    return `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + h}C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h}Z`;
  }

  function render() {
    g.selectAll("*").remove();
    // nodes
    const nodes = SNAPS.map((_, ci) => P.map(p => ({ ci, id: p.id, members: [], value: 0 })));
    isos.forEach(iso => path.get(iso).forEach((pid, ci) => {
      const n = nodes[ci][pIndex.get(pid)]; n.members.push(iso); n.value += weightOf(iso, ci);
    }));
    const totals = nodes.map(col => d3.sum(col, n => n.value));
    const k = (H - m.t - m.b - pad * (P.length - 1)) / d3.max(totals);
    nodes.forEach(col => { let y = m.t; col.forEach(n => { n.y = y; n.h = n.value * k; y += n.h + pad; }); });

    // links between consecutive snapshots
    const links = [];
    for (let ci = 0; ci < SNAPS.length - 1; ci++) {
      const grp = d3.group(isos, iso => `${path.get(iso)[ci]}>${path.get(iso)[ci + 1]}`);
      grp.forEach((members, key) => {
        const [a, b] = key.split(">").map(Number);
        links.push({ ci, a, b, ai: pIndex.get(a), bi: pIndex.get(b), members,
          value: d3.sum(members, iso => weightOf(iso, ci)) });
      });
    }
    nodes.forEach((col, ci) => col.forEach((n, pi) => {
      let sy = n.y; links.filter(l => l.ci === ci && l.ai === pi).sort((p, q) => p.bi - q.bi).forEach(l => { l.sy = sy; l.h = l.value * k; sy += l.h; });
      let ty = n.y; links.filter(l => l.ci === ci - 1 && l.bi === pi).sort((p, q) => p.ai - q.ai).forEach(l => { l.ty = ty; ty += l.value * k; });
    }));

    // ribbons
    const lg = g.append("g");
    const sel = S.selected;
    lg.selectAll("path.flow").data(links).join("path").attr("class", "flow")
      .attr("d", l => ribbon(colX(SNAPS[l.ci]) + nodeW, l.sy, colX(SNAPS[l.ci + 1]), l.ty, l.h))
      .attr("fill", l => WB.profileColor(l.a)).attr("fill-opacity", l => l.a === l.b ? 0.28 : 0.62)
      .on("mousemove", (e, l) => {
        const top = l.members.slice().sort((p, q) => popOf(q, l.ci) - popOf(p, l.ci)).slice(0, 8).map(nameOf);
        const dir = l.ai === l.bi ? "stayed in" : l.bi < l.ai ? "moved up to" : "moved down to";
        tip.show(`<strong>${fmtVal(l.value)}</strong> ${dir}<br>${WB.profileName(l.b)}<br>between ${SNAPS[l.ci]} and ${SNAPS[l.ci + 1]}<br><span class="tip-list">${top.join(", ")}${l.members.length > 8 ? `, +${l.members.length - 8} more` : ""}</span><br><span class="tip-hint">click to select these countries everywhere</span>`, e);
      })
      .on("mouseleave", tip.hide)
      .on("click", (e, l) => {
        const same = l.members.length === sel.size && l.members.every(i => sel.has(i));
        WB.select(same ? [] : l.members);
      });
    // selected overlay inside each ribbon
    if (sel.size) {
      const ov = links.map(l => {
        const inSel = l.members.filter(i => sel.has(i));
        return { l, v: d3.sum(inSel, iso => weightOf(iso, l.ci)), n: inSel.length };
      }).filter(o => o.n);
      lg.selectAll("path.flow-sel").data(ov).join("path").attr("class", "flow-sel").style("pointer-events", "none")
        .attr("d", o => ribbon(colX(SNAPS[o.l.ci]) + nodeW, o.l.sy, colX(SNAPS[o.l.ci + 1]), o.l.ty, Math.max(1.5, o.v * k)))
        .attr("fill", "var(--sel)").attr("fill-opacity", 0.9);
    }

    // node blocks and labels
    const ng = g.append("g");
    const flat = nodes.flat().filter(n => n.value > 0);
    const nodeSel = ng.selectAll("g.node").data(flat).join("g").attr("class", "node")
      .on("mousemove", (e, n) => tip.show(`<strong>${WB.profileName(n.id)}</strong>, ${SNAPS[n.ci]}<br>${fmtVal(n.value)}<br><span class="tip-hint">click to select these countries everywhere</span>`, e))
      .on("mouseleave", tip.hide)
      .on("click", (e, n) => WB.select(n.members));
    nodeSel.append("rect").attr("x", n => colX(SNAPS[n.ci])).attr("y", n => n.y).attr("width", nodeW).attr("height", n => Math.max(1, n.h))
      .attr("fill", n => WB.profileColor(n.id)).attr("stroke", "#fff");
    if (!narrow) {
      const first = flat.filter(n => n.ci === 0), last = flat.filter(n => n.ci === SNAPS.length - 1);
      const lab = (arr, anchor, dxp) => {
        const t = ng.selectAll(null).data(arr).join("text").attr("class", "lab").attr("text-anchor", anchor)
          .attr("x", n => colX(SNAPS[n.ci]) + dxp).attr("y", n => n.y + n.h / 2 - 2).style("pointer-events", "none");
        t.append("tspan").style("font-weight", 650).text(n => WB.PROFILES[pIndex.get(n.id)].short);
        t.append("tspan").attr("class", "lab-muted").attr("x", n => colX(SNAPS[n.ci]) + dxp).attr("dy", "1.25em").text(n => fmtVal(n.value));
      };
      lab(first, "end", -8); lab(last, "start", nodeW + 8);
    }
    // middle columns: counts next to the blocks
    ng.selectAll("text.mid").data(flat.filter(n => n.ci > 0 && n.ci < SNAPS.length - 1 && n.h > 11)).join("text").attr("class", "lab-muted halo mid")
      .attr("x", n => colX(SNAPS[n.ci]) + nodeW + 4).attr("y", n => n.y + 11).attr("text-anchor", "start").style("pointer-events", "none")
      .text(n => S.fig5Weight === "pop" ? d3.format(".2s")(n.value).replace("G", "B") : n.value);
    // year headings
    ng.selectAll("text.yr").data(SNAPS).join("text").attr("class", "lab-strong yr").attr("x", y => colX(y) + nodeW / 2).attr("y", m.t - 18)
      .attr("text-anchor", "middle").text(y => y);
    updateMarker();
    d3.select("#fig5-weight").property("value", S.fig5Weight);
    d3.select("#fig5-note").text(sel.size ? `Orange: ${sel.size} selected ${sel.size === 1 ? "country" : "countries"}` : "");
  }
  function updateMarker() {
    const cx = colX(S.year) + nodeW / 2;
    markerLine.transition().duration(450).ease(d3.easeLinear).attr("x1", cx).attr("x2", cx);
    markerText.transition().duration(450).ease(d3.easeLinear).attr("x", cx).text(SNAPS.includes(S.year) ? "" : S.year);
  }

  d3.select("#fig5-weight").on("change", function () { WB.set({ fig5Weight: this.value }); });
  WB.on(["fig5Weight", "selected"], render);
  WB.on(["year"], updateMarker);
  render();
}