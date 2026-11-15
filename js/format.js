/** format.js — pure number/string helpers. No DOM. */

/** Fixed-decimal formatter that survives NaN and Infinity. */
export const f = (x, n) => (Number.isFinite(x) ? x.toFixed(n == null ? 2 : n) : "—");

/** Unicode superscript digits, for exponents in plain text and SVG. */
export function sup(n) {
  const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  return String(n).split("").map((c) => map[c] || c).join("");
}

/** Scientific notation as "1.00×10¹⁷". */
export function sci(x, d) {
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / Math.pow(10, e);
  return m.toFixed(d == null ? 2 : d) + "×10" + sup(e);
}

/** Round a value up to a readable axis maximum (1, 2, 2.5, 5 or 10 × 10^n). */
export function niceMax(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
}

/** "V_GS" -> "V<sub>GS</sub>" for control labels. */
export function symHTML(s) {
  const p = s.split("_");
  return p[1] ? p[0] + "<sub>" + p[1] + "</sub>" : p[0];
}
