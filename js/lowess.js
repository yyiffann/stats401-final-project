// LOWESS (locally weighted linear regression with robustness iterations).
// A port of the statsmodels algorithm used in scripts/02_build_dataset.py
// (frac = 0.6, it = 2, delta = 0), so that the weight sliders in Figure 3 recompute
// exactly the same "expected well-being at this income" as the Python pipeline.
(function (root) {
  function lowess(xs, ys, frac = 0.6, it = 2) {
    const n = xs.length;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b] || a - b);
    const x = order.map(i => xs[i]), y = order.map(i => ys[i]);
    const k = Math.floor(frac * n + 1e-10);
    const fit = new Float64Array(n), rw = new Float64Array(n).fill(1), res = new Float64Array(n);
    const range = x[n - 1] - x[0];

    for (let iter = 0; iter <= it; iter++) {
      let left = 0, right = k - 1;
      for (let i = 0; i < n; i++) {
        while (right < n - 1 && x[i] - x[left] > x[right + 1] - x[i]) { left++; right++; }
        const h = Math.max(x[i] - x[left], x[right] - x[i]);
        const h9 = 0.999 * h, h1 = 0.001 * h;
        const w = new Float64Array(right - left + 1);
        let sw = 0;
        for (let j = left; j <= right; j++) {
          const r = Math.abs(x[j] - x[i]);
          let v = 0;
          if (r <= h9) { v = r <= h1 ? 1 : Math.pow(1 - Math.pow(r / h, 3), 3); v *= rw[j]; }
          w[j - left] = v; sw += v;
        }
        if (sw <= 0) { fit[i] = y[i]; continue; }
        let a = 0;
        for (let j = left; j <= right; j++) { w[j - left] /= sw; a += w[j - left] * x[j]; }
        let c = 0;
        for (let j = left; j <= right; j++) c += w[j - left] * (x[j] - a) * (x[j] - a);
        if (Math.sqrt(c) > 0.001 * range) {
          const b = (x[i] - a) / c;
          for (let j = left; j <= right; j++) w[j - left] *= (b * (x[j] - a) + 1);
        }
        let s = 0;
        for (let j = left; j <= right; j++) s += w[j - left] * y[j];
        fit[i] = s;
      }
      if (iter === it) break;
      for (let i = 0; i < n; i++) res[i] = y[i] - fit[i];
      const abs = Array.from(res, Math.abs).sort((p, q) => p - q);
      const med = n % 2 ? abs[(n - 1) / 2] : (abs[n / 2 - 1] + abs[n / 2]) / 2;
      const cmad = 6 * med, c9 = 0.999 * cmad, c1 = 0.001 * cmad;
      for (let i = 0; i < n; i++) {
        const r = Math.abs(res[i]);
        rw[i] = r <= c1 ? 1 : r <= c9 ? Math.pow(1 - Math.pow(r / cmad, 2), 2) : 0;
      }
    }
    const out = new Array(n);
    order.forEach((orig, i) => { out[orig] = fit[i]; });
    return out;
  }
  root.lowess = lowess;
  if (typeof module !== "undefined") module.exports = { lowess };
})(typeof window !== "undefined" ? (window.WB = window.WB || {}) : globalThis);