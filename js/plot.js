/**
 * plot.js — a small generic canvas plotter.
 *
 * One function draws axes, grid, filled bands, line series, point markers and
 * inline labels from a config object. Series are clipped to the plot box, so an
 * off-scale curve runs out of frame instead of painting over the axis labels.
 */

import { f } from "./format.js";
import { cssVar } from "./theme.js";

/**
 * Turn a CSS colour into "rgba(r,g,b,alpha)". Accepts #RGB, #RRGGBB and the
 * rgb()/rgba() forms that getComputedStyle may hand back, so gradient stops can
 * be built from the theme tokens without hard-coding any colour here.
 */
function withAlpha(color, alpha) {
  const c = (color || "").trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    const n = parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return c;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x) => parseFloat(x));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return c;
}

/** Size a canvas for the device pixel ratio and return its 2D context. */
export function setupCanvas(cv, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth || 600;
  cv.style.height = height + "px";
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(height * dpr);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, height);
  return { ctx, w, h: height };
}

/**
 * @param {HTMLCanvasElement} cv
 * @param {object} cfg
 *   height, x0, x1, y0, y1      plot box and data range
 *   xlab, ylab                  axis titles
 *   xfmt, yfmt                  tick formatters
 *   bands   [{pts, fill}]       filled polygons in data space
 *   series  [{pts, color, w, dash, alpha}]
 *   marks   [{x, y, color, label}]   point markers with crosshairs
 *   labels  [{text, x, y, color, align, dx, dy}]
 */
export function plot(cv, cfg) {
  const h = cfg.height || 300;
  const { ctx, w } = setupCanvas(cv, h);

  const M = { l: 62, r: cfg.mr || 16, t: 12, b: 42 };
  const PW = Math.max(w - M.l - M.r, 10);
  const PH = h - M.t - M.b;

  const line = cssVar("--line");
  const soft = cssVar("--line-soft");
  const mut = cssVar("--muted");
  const fgc = cssVar("--fg");
  const mono = cssVar("--mono");

  const X = (x) => M.l + ((x - cfg.x0) / (cfg.x1 - cfg.x0)) * PW;
  const Y = (y) => M.t + PH - ((y - cfg.y0) / (cfg.y1 - cfg.y0)) * PH;

  // ---- plot-area ground: a soft vertical wash so curves sit on something ----
  const ground = ctx.createLinearGradient(0, M.t, 0, M.t + PH);
  ground.addColorStop(0, withAlpha(cssVar("--fg"), 0.030));
  ground.addColorStop(1, withAlpha(cssVar("--fg"), 0.008));
  ctx.fillStyle = ground;
  ctx.fillRect(M.l, M.t, PW, PH);

  // ---- grid and ticks ----
  ctx.font = "11px " + mono;
  const nx = 6, ny = 5;
  const minor = 4;   // minor divisions between each labelled gridline

  // minor grid first, so major lines draw over it
  ctx.strokeStyle = withAlpha(soft, 0.5);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < nx * minor; i++) {
    const x = M.l + (PW * i) / (nx * minor);
    if (i % minor === 0) continue;
    ctx.moveTo(x, M.t); ctx.lineTo(x, M.t + PH);
  }
  for (let i = 0; i < ny * minor; i++) {
    const y = M.t + (PH * i) / (ny * minor);
    if (i % minor === 0) continue;
    ctx.moveTo(M.l, y); ctx.lineTo(M.l + PW, y);
  }
  ctx.stroke();

  ctx.lineWidth = 1;
  for (let i = 0; i <= nx; i++) {
    const v = cfg.x0 + ((cfg.x1 - cfg.x0) * i) / nx;
    const x = X(v);
    ctx.strokeStyle = soft;
    ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, M.t + PH); ctx.stroke();
    // tick mark on the axis
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(x, M.t + PH); ctx.lineTo(x, M.t + PH + 4); ctx.stroke();
    ctx.fillStyle = mut; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(cfg.xfmt ? cfg.xfmt(v) : f(v, 1), x, M.t + PH + 9);
  }
  for (let i = 0; i <= ny; i++) {
    const v = cfg.y0 + ((cfg.y1 - cfg.y0) * i) / ny;
    const y = Y(v);
    ctx.strokeStyle = soft;
    ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(M.l + PW, y); ctx.stroke();
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(M.l - 4, y); ctx.lineTo(M.l, y); ctx.stroke();
    ctx.fillStyle = mut; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(cfg.yfmt ? cfg.yfmt(v) : f(v, 1), M.l - 10, y);
  }

  ctx.strokeStyle = line; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, M.t + PH); ctx.lineTo(M.l + PW, M.t + PH);
  ctx.stroke();

  // ---- axis titles ----
  ctx.fillStyle = mut; ctx.font = "11.5px " + mono;
  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText(cfg.xlab, M.l + PW / 2, h - 6);
  ctx.save();
  ctx.translate(13, M.t + PH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "top"; ctx.fillText(cfg.ylab, 0, 0);
  ctx.restore();

  // ---- filled bands ----
  (cfg.bands || []).forEach((b) => {
    ctx.fillStyle = b.fill;
    ctx.beginPath();
    b.pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
    ctx.closePath(); ctx.fill();
  });

  // ---- line series, clipped to the plot box ----
  ctx.save();
  ctx.beginPath(); ctx.rect(M.l, M.t, PW, PH); ctx.clip();
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  (cfg.series || []).forEach((se) => {
    // optional area fill between the curve and the x-axis
    if (se.fill) {
      ctx.save();
      const g = ctx.createLinearGradient(0, M.t, 0, M.t + PH);
      g.addColorStop(0, withAlpha(se.color, 0.26));
      g.addColorStop(1, withAlpha(se.color, 0.01));
      ctx.fillStyle = g;
      ctx.beginPath();
      let begun = false, lastX = M.l;
      se.pts.forEach((p) => {
        const x = X(p[0]), y = Y(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (begun) ctx.lineTo(x, y); else { ctx.moveTo(x, Y(cfg.y0)); ctx.lineTo(x, y); begun = true; }
        lastX = x;
      });
      if (begun) {
        ctx.lineTo(lastX, Y(cfg.y0));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = se.color;
    ctx.lineWidth = se.w || 2;
    ctx.globalAlpha = se.alpha == null ? 1 : se.alpha;
    if (se.dash) ctx.setLineDash(se.dash);
    // a soft glow lifts the hero trace off the grid; used sparingly
    if (se.glow) {
      ctx.shadowColor = withAlpha(se.color, 0.55);
      ctx.shadowBlur = 9;
    }
    ctx.beginPath();
    let started = false;
    se.pts.forEach((p) => {
      const x = X(p[0]), y = Y(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
    });
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();

  // ---- operating-point markers ----
  (cfg.marks || []).forEach((m) => {
    const x = X(m.x), y = Y(m.y);

    ctx.strokeStyle = m.color; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(x, y); ctx.lineTo(x, M.t + PH); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // halo, white collar, core — reads clearly over a dense curve family
    ctx.fillStyle = withAlpha(m.color, 0.18);
    ctx.beginPath(); ctx.arc(x, y, 10, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = cssVar("--surface");
    ctx.beginPath(); ctx.arc(x, y, 5.8, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(x, y, 3.8, 0, 2 * Math.PI); ctx.fill();

    if (m.label) {
      ctx.font = "600 11px " + mono;
      const right = x > M.l + PW * 0.72;
      const tx = right ? x - 11 : x + 11;
      const ty = y - 9;
      ctx.textAlign = right ? "right" : "left";
      ctx.textBaseline = "bottom";
      // a padded plate keeps the readout legible wherever the point lands
      const tw = ctx.measureText(m.label).width;
      const bx = right ? tx - tw - 5 : tx - 5;
      ctx.fillStyle = withAlpha(cssVar("--surface"), 0.88);
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, ty - 13, tw + 10, 16, 4);
      } else {
        ctx.rect(bx, ty - 13, tw + 10, 16);   // pre-2022 browsers
      }
      ctx.fill();
      ctx.fillStyle = fgc;
      ctx.fillText(m.label, tx, ty);
    }
  });

  // ---- inline curve labels ----
  (cfg.labels || []).forEach((t) => {
    ctx.font = "10.5px " + mono;
    ctx.fillStyle = t.color;
    ctx.textAlign = t.align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t.text, X(t.x) + (t.dx || 0), Y(t.y) + (t.dy || 0));
  });
}
