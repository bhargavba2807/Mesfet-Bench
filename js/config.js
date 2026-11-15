/**
 * config.js — the default device, the slider definitions and the presets.
 * Edit this file to change what the bench exposes; nothing else needs to know.
 */

import { f, sci } from "./format.js";

/** Default parameter set: the PS-57 specification. */
export const DEFAULTS = {
  L: 0.5,      // gate length, µm
  a: 0.2,      // channel thickness, µm
  ND: 1e17,    // doping, cm^-3
  Phi: 0.8,    // Schottky barrier height, V
  Z: 100,      // gate width, µm
  er: 12.9,    // relative permittivity (GaAs)
  mu: 4500,    // low-field electron mobility, cm²/V·s
  vs: 1.0,     // saturation velocity, ×10^7 cm/s
  lam: 0.04,   // channel-length modulation, V^-1
  Rs: 1.5,     // source resistance, Ω·mm
  Rd: 1.5,     // drain resistance, Ω·mm
  Vgs: 0,      // gate-source bias, V
  Vds: 3,      // drain-source bias, V
};

/**
 * Slider definitions.
 *   g    — which control group the slider is appended to (a DOM id)
 *   k    — key into the state object
 *   log  — slider travels in log10 space (for doping)
 *   fmt  — how the live value is printed
 */
export const SPECS = [
  { g: "geo",  k: "L",   lab: "Gate length",          sym: "L",     min: 0.1,  max: 3,     step: 0.05,  fmt: (v) => f(v, 2) + " µm" },
  { g: "geo",  k: "a",   lab: "Channel thickness",    sym: "a",     min: 0.05, max: 0.6,   step: 0.01,  fmt: (v) => f(v, 2) + " µm" },
  { g: "geo",  k: "ND",  lab: "Doping",               sym: "N_D",   min: 1e16, max: 5e17,  step: 1e15, log: true, fmt: (v) => sci(v, 2) + " cm⁻³" },
  { g: "geo",  k: "Z",   lab: "Gate width",           sym: "Z",     min: 20,   max: 400,   step: 5,     fmt: (v) => f(v, 0) + " µm" },

  { g: "mat",  k: "Phi", lab: "Schottky barrier",     sym: "Φ_b",   min: 0.3,  max: 1.2,   step: 0.01,  fmt: (v) => f(v, 2) + " V" },
  { g: "mat",  k: "er",  lab: "Rel. permittivity",    sym: "ε_r",   min: 9,    max: 16,    step: 0.1,   fmt: (v) => f(v, 1) },
  { g: "mat",  k: "mu",  lab: "Low-field mobility",   sym: "µ_n",   min: 500,  max: 8500,  step: 50,    fmt: (v) => f(v, 0) + " cm²/V·s" },
  { g: "mat",  k: "vs",  lab: "Saturation velocity",  sym: "v_sat", min: 0.3,  max: 2.5,   step: 0.05,  fmt: (v) => f(v, 2) + "×10⁷ cm/s" },
  { g: "mat",  k: "Rs",  lab: "Source resistance",    sym: "R_s",   min: 0,    max: 6,     step: 0.1,   fmt: (v) => f(v, 1) + " Ω·mm" },
  { g: "mat",  k: "Rd",  lab: "Drain resistance",     sym: "R_d",   min: 0,    max: 6,     step: 0.1,   fmt: (v) => f(v, 1) + " Ω·mm" },

  { g: "bias", k: "Vgs", lab: "Gate–source",          sym: "V_GS",  min: -6,   max: 0.5,   step: 0.01,  fmt: (v) => (v >= 0 ? "+" : "") + f(v, 2) + " V" },
  { g: "bias", k: "Vds", lab: "Drain–source",         sym: "V_DS",  min: 0,    max: 10,    step: 0.05,  fmt: (v) => f(v, 2) + " V" },
  { g: "bias", k: "lam", lab: "Channel-length mod.",  sym: "λ",     min: 0,    max: 0.2,   step: 0.005, fmt: (v) => f(v, 3) + " V⁻¹" },
];

/** One-click parameter sets. Each is merged over DEFAULTS. */
export const PRESETS = [
  { n: "PS-57 spec",           v: { ...DEFAULTS } },
  { n: "0.25 µm gate",         v: { L: 0.25, a: 0.15, ND: 2e17, Vds: 3, Vgs: 0 } },
  { n: "Enhancement mode",     v: { L: 0.5, a: 0.1, ND: 1e17, Phi: 0.8, Vgs: 0.4, Vds: 3 } },
  { n: "Thick + lightly doped", v: { L: 1.0, a: 0.4, ND: 3e16, Vgs: 0, Vds: 5 } },
  { n: "Silicon JFET-like",    v: { er: 11.7, mu: 1300, vs: 0.8, L: 2, a: 0.5, ND: 5e16, Phi: 0.7, Vgs: 0, Vds: 6 } },
  { n: "No parasitics",        v: { Rs: 0, Rd: 0 } },
];
