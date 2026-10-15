// Global controls (year slider with animation, selection chips + search).
function initControls(data) {
  const S = WB.state;
  const YEARS = [2000, 2022];
  const play = document.getElementById("cb-play");
  const slider = document.getElementById("cb-year");
  const out = document.getElementById("cb-year-out");
  let timer = null;

  // ---- year slider and play button
  function stop() { if (timer) { clearInterval(timer); timer = null; } play.textContent = "▶"; play.setAttribute("aria-label", "Play year animation"); }
  function start() {
    if (S.year >= YEARS[1]) WB.set({ year: YEARS[0] });
    play.textContent = "❚❚"; play.setAttribute("aria-label", "Pause year animation");
    timer = setInterval(() => {
      if (S.year >= YEARS[1]) return stop();
      WB.set({ year: S.year + 1 });
    }, 650);
  }
  play.addEventListener("click", () => timer ? stop() : start());
  slider.addEventListener("input", () => { stop(); WB.set({ year: +slider.value }); });
  WB.on(["year"], () => { slider.value = S.year; out.textContent = S.year; });
  WB.controls = { play: start, stop };

  // ---- selection chips and search
  const chips = d3.select("#cb-chips");
  const list = d3.select("#cb-countries");
  list.selectAll("option").data(data.countries).join("option").attr("value", d => d.name);
  const byName = new Map(data.countries.map(d => [d.name.toLowerCase(), d.iso3]));
  const search = document.getElementById("cb-search");
  function addFromSearch() {
    const iso = byName.get(search.value.trim().toLowerCase());
    if (iso) { WB.select([iso], "add"); search.value = ""; }
  }
  search.addEventListener("change", addFromSearch);
  search.addEventListener("keydown", e => { if (e.key === "Enter") addFromSearch(); });
  document.getElementById("cb-clear").addEventListener("click", () => WB.select([]));
  function renderChips() {
    const isos = [...S.selected].sort((a, b) => d3.ascending(data.info.get(a).name, data.info.get(b).name));
    const shown = isos.slice(0, 3);
    const items = shown.map(iso => ({ iso, text: data.info.get(iso).name }));
    if (isos.length > 3) items.push({ iso: null, text: `+${isos.length - 3} more` });
    const c = chips.selectAll("span.chip").data(items, d => d.iso || "more").join("span")
      .attr("class", d => d.iso ? "chip" : "chip more");
    c.selectAll("*").remove();
    c.append("span").text(d => d.text);
    c.filter(d => d.iso).append("button").attr("aria-label", d => `Deselect ${d.text}`).text("×")
      .on("click", (e, d) => WB.toggleSelected(d.iso));
    document.getElementById("cb-clear").disabled = !S.selected.size;
    document.querySelector("#cb-sel .cb-label").textContent = S.selected.size ? `Selected (${S.selected.size}):` : "Nothing selected —";
  }
  WB.on(["selected"], () => { renderChips(); WB.applySel(document); });
  renderChips();
  WB.applySel(document);
}
