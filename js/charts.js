/**
 * charts.js — the two characteristic plots.
 *
 * Both draw the inactive model as a dashed "ghost" family so the gap between
 * the long-channel algebra and the velocity-saturated reality stays visible.
 * The ghost never sets the y-scale: it runs off the top of the frame with an
 * annotation saying what it reaches, which makes the point better than fitting
 * it would.
 */

import { Id, Iint, gm, fT, Vdsat } from "./physics.js";
import { f, niceMax } from "./format.js";
import { cssVar } from "./theme.js";
import { plot } from "./plot.js";

/** One entry in a chart key. */
function key(color, style, text) {
  const st = style === "dashed" ? "dashed" : style === "dotted" ? "dotted" : "solid";
  return '<span><i class="ln" style="border-top-color:' + color +
         ";border-top-style:" + st + '"></i>' + text + "</span>";
}

/** I_DS vs V_DS, a family stepped over V_GS from 0 down to threshold. */
export function chartOutput(S, d, canvas, keyEl) {
  const lam = S.lam;
  const nCurves = 6;
  const VdsMax = Math.max(S.Vds * 1.15, (d.Vp - d.Phi + 0.5) * 1.9, 2);

  const vgsList = [];
  for (let i = 0; i < nCurves; i++) vgsList.push((d.VT * 0.92 * i) / (nCurves - 1));

  const other = { ...d, model: d.model === "vel" ? "gcm" : "vel" };
  const series = [], labels = [];
  let ymax = 0, ghostMax = 0;

  const sample = (dd, Vgs, track) => {
    const p = [];
    for (let i = 0; i <= 160; i++) {
      const v = (VdsMax * i) / 160;
      const I = Id(dd, Vgs, v, lam) * 1e3;
      p.push([v, I]);
      if (track) ymax = Math.max(ymax, I); else ghostMax = Math.max(ghostMax, I);
    }
    return p;
  };

  // ghost family first, so the active family draws over it
  vgsList.forEach((vg) => {
    series.push({ pts: sample(other, vg, false), color: cssVar("--accent2"), w: 1.2, dash: [4, 4], alpha: 0.6 });
  });
  vgsList.forEach((vg, i) => {
    const p = sample(d, vg, true);
    series.push({
      pts: p, color: cssVar("--accent"),
      w: i === 0 ? 2.6 : 1.9,
      alpha: i === 0 ? 1 : 0.82,
      // no area fill here — under a family of curves it washes over the rest
      glow: i === 0,
    });
    labels.push({
      text: (vg >= 0 ? "+" : "") + f(vg, 1) + " V",
      x: VdsMax, y: p[p.length - 1][1],
      color: cssVar("--accent"), align: "right", dx: -4, dy: -9,
    });
  });

  // saturation locus — the knee shifts out by the parasitic drop
  const locus = [];
  for (let i = 0; i <= 60; i++) {
    const vg = d.VT * 0.999 * (1 - i / 60);
    const vdi = Vdsat(d, vg);
    const Isat = Iint(d, vg, vdi, 0);
    locus.push([vdi + Isat * (d.Rs + d.Rd), Isat * 1e3]);
  }
  series.push({ pts: locus, color: cssVar("--fg"), w: 1.3, dash: [2, 4], alpha: 0.45 });

  const y1 = niceMax(Math.max(ymax, 1e-3) * 1.08);
  const Iop = Id(d, S.Vgs, S.Vds, lam) * 1e3;

  if (ghostMax > y1 * 1.02) {
    labels.push({
      text: "↑ other model reaches " + f(ghostMax, 0) + " mA",
      x: VdsMax * 0.52, y: y1 * 0.955,
      color: cssVar("--accent2"), align: "center",
    });
  }

  plot(canvas, {
    height: 330, x0: 0, x1: VdsMax, y0: 0, y1,
    xlab: "V_DS   (V)", ylab: "I_DS   (mA)",
    xfmt: (v) => f(v, 1),
    yfmt: (v) => (y1 >= 10 ? f(v, 0) : f(v, 1)),
    series, labels,
    marks: [{ x: Math.min(S.Vds, VdsMax), y: Iop, color: cssVar("--accent-ink"), label: f(Iop, 2) + " mA" }],
  });

  keyEl.innerHTML =
    key(cssVar("--accent"), "solid", "Active model, V<sub>GS</sub> stepped 0 → V<sub>T</sub>") +
    key(cssVar("--accent2"), "dashed", d.model === "vel" ? "Gradual channel only (no v<sub>sat</sub>)" : "With velocity saturation") +
    key(cssVar("--fg"), "dotted", "Saturation locus V<sub>DS</sub> = V<sub>DS,sat</sub>");
}

/**
 * A sweep over V_GS at the current V_DS. `S.view` selects what is plotted:
 * "id" transfer characteristic, "gm" transconductance, "ft" cutoff frequency.
 * The f_T view also draws the transit-time ceiling v_sat / 2πL.
 */
export function chartSweep(S, d, canvas, keyEl, titleEl) {
  const lam = S.lam, view = S.view;
  const lo = Math.min(d.VT - 0.25, -0.3), hi = 0.5, N = 220;
  const other = { ...d, model: d.model === "vel" ? "gcm" : "vel" };

  const sweep = (dd, fn) => {
    const p = [];
    for (let i = 0; i <= N; i++) {
      const vg = lo + ((hi - lo) * i) / N;
      p.push([vg, fn(dd, vg)]);
    }
    return p;
  };

  let fn, ylab, unit, title;
  if (view === "id") {
    fn = (dd, vg) => Id(dd, vg, S.Vds, lam) * 1e3;
    ylab = "I_DS   (mA)"; unit = "mA"; title = "Transfer characteristic";
  } else if (view === "gm") {
    fn = (dd, vg) => gm(dd, vg, S.Vds, lam) * 1e3;
    ylab = "g_m   (mS)"; unit = "mS"; title = "Transconductance";
  } else {
    fn = (dd, vg) => fT(dd, vg, S.Vds, lam) / 1e9;
    ylab = "f_T   (GHz)"; unit = "GHz"; title = "Cutoff frequency";
  }
  titleEl.textContent = title;

  const active = sweep(d, fn), ghost = sweep(other, fn);
  let ymax = 0, ghostMax = 0;
  active.forEach((p) => { if (Number.isFinite(p[1])) ymax = Math.max(ymax, p[1]); });
  ghost.forEach((p) => { if (Number.isFinite(p[1])) ghostMax = Math.max(ghostMax, p[1]); });

  const y1 = niceMax(Math.max(ymax, 1e-6) * 1.1);
  const yop = fn(d, S.Vgs);

  const series = [
    { pts: ghost, color: cssVar("--accent2"), w: 1.5, dash: [4, 4], alpha: 0.7 },
    { pts: active, color: cssVar("--accent"), w: 2.6, fill: true, glow: true },
  ];
  if (view === "ft") {
    series.push({ pts: [[lo, d.fTtransit / 1e9], [hi, d.fTtransit / 1e9]], color: cssVar("--ok"), w: 1.5, dash: [6, 4] });
  }

  const labels = [];
  if (view === "ft") {
    labels.push({
      text: "v_sat / 2πL = " + f(d.fTtransit / 1e9, 1) + " GHz",
      x: lo, y: d.fTtransit / 1e9, color: cssVar("--ok"), dx: 8, dy: -16,
    });
  }
  if (ghostMax > y1 * 1.02) {
    labels.push({
      text: "↑ other model reaches " + f(ghostMax, y1 >= 10 ? 0 : 2) + " " + unit,
      x: (lo + hi) / 2, y: y1 * 0.955, color: cssVar("--accent2"), align: "center",
    });
  }

  plot(canvas, {
    height: 300, x0: lo, x1: hi, y0: 0, y1,
    xlab: "V_GS   (V)", ylab,
    xfmt: (x) => f(x, 1),
    yfmt: (y) => (y1 >= 10 ? f(y, 0) : f(y, 2)),
    series, labels,
    marks: [{ x: S.Vgs, y: yop, color: cssVar("--accent-ink"), label: f(yop, y1 >= 10 ? 1 : 2) + " " + unit }],
  });

  keyEl.innerHTML =
    key(cssVar("--accent"), "solid", "Active model at V<sub>DS</sub> = " + f(S.Vds, 2) + " V") +
    key(cssVar("--accent2"), "dashed", d.model === "vel" ? "Gradual channel only" : "With velocity saturation") +
    (view === "ft" ? key(cssVar("--ok"), "dashed", "Transit-time ceiling") : "");
}
