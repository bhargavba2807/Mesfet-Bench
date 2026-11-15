/**
 * main.js — state, controls and the render loop.
 *
 * One `state` object is the single source of truth. Every control writes into
 * it and calls render(); nothing else stores state. render() is throttled to
 * one animation frame so dragging a slider stays smooth.
 */

import { DEFAULTS, SPECS, PRESETS } from "./config.js";
import { derive } from "./physics.js";
import { symHTML } from "./format.js";
import { restoreTheme, toggleTheme } from "./theme.js";
import { drawDevice } from "./device.js";
import { chartOutput, chartSweep } from "./charts.js";
import { renderTiles, renderSteps } from "./readouts.js";

const state = { ...DEFAULTS, model: "vel", view: "id" };

const el = (id) => document.getElementById(id);
const els = {
  dev: el("dev"), tiles: el("tiles"), regime: el("regimeslot"), note: el("modelnote"),
  c1: el("c1"), k1: el("k1"), c2: el("c2"), k2: el("k2"), c2title: el("c2title"),
  steps: el("steps"), presets: el("presets"), modelseg: el("modelseg"),
  c2seg: el("c2seg"), themebtn: el("themebtn"),
};

/* ---------------- controls ---------------- */

function buildControls() {
  SPECS.forEach((sp) => {
    const box = el(sp.g);
    if (!box) return;

    const wrap = document.createElement("div");
    wrap.className = "ctl";
    wrap.innerHTML =
      '<div class="ctl-h"><label for="r_' + sp.k + '">' + sp.lab + " <b>" + symHTML(sp.sym) + "</b></label>" +
      '<span class="val" id="v_' + sp.k + '"></span></div>' +
      '<input type="range" id="r_' + sp.k + '">';
    box.appendChild(wrap);

    const r = wrap.querySelector("input");
    if (sp.log) {
      r.min = Math.log10(sp.min); r.max = Math.log10(sp.max); r.step = 0.005;
      r.value = Math.log10(state[sp.k]);
    } else {
      r.min = sp.min; r.max = sp.max; r.step = sp.step;
      r.value = state[sp.k];
    }
    r.addEventListener("input", () => {
      state[sp.k] = sp.log ? Math.pow(10, +r.value) : +r.value;
      render();
    });
  });
}

function syncControls() {
  SPECS.forEach((sp) => {
    const r = el("r_" + sp.k), v = el("v_" + sp.k);
    if (!r) return;
    const want = sp.log ? Math.log10(state[sp.k]) : state[sp.k];
    if (Math.abs(+r.value - want) > 1e-9) r.value = want;
    v.textContent = sp.fmt(state[sp.k]);

    // --p drives the filled portion of the track in WebKit (see styles.css).
    const lo = +r.min, hi = +r.max;
    const pct = hi > lo ? ((+r.value - lo) / (hi - lo)) * 100 : 0;
    r.style.setProperty("--p", Math.max(0, Math.min(100, pct)) + "%");
  });
}

function buildPresets() {
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = p.n;
    b.addEventListener("click", () => {
      Object.assign(state, DEFAULTS, p.v);
      syncControls();
      render();
    });
    els.presets.appendChild(b);
  });
}

/* ---------------- render ---------------- */

let frame = null;
function render() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    syncControls();
    const d = derive(state);
    const r = renderTiles(state, d, els.tiles, els.regime, els.note);
    drawDevice(els.dev, state, d);
    chartOutput(state, d, els.c1, els.k1);
    chartSweep(state, d, els.c2, els.k2, els.c2title);
    renderSteps(state, d, r, els.steps);
  });
}

/* ---------------- wiring ---------------- */

function pressGroup(container, target) {
  [...container.children].forEach((x) => x.setAttribute("aria-pressed", String(x === target)));
}

els.modelseg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.model = b.dataset.m;
  pressGroup(e.currentTarget, b);
  render();
});

els.c2seg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.view = b.dataset.v;
  pressGroup(e.currentTarget, b);
  render();
});

els.themebtn.addEventListener("click", () => {
  toggleTheme();
  render();
});

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

// Re-draw the canvases when the column width changes, but ignore sub-pixel noise.
let lastWidth = 0;
new ResizeObserver((entries) => {
  const w = Math.round(entries[0].contentRect.width);
  if (w && Math.abs(w - lastWidth) > 1) {
    lastWidth = w;
    render();
  }
}).observe(els.c1.parentElement);

restoreTheme();
buildPresets();
buildControls();
syncControls();
render();
