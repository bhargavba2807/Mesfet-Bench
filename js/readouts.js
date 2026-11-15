/**
 * readouts.js — the computed-quantity tiles and the substituted derivation.
 *
 * renderTiles() returns the operating point it computed so renderSteps() can
 * print the same numbers without solving twice.
 */

import { op, gm, gd, Cgs, fT, Vdsat, Iint, Igcm, Ivel, depletionWidth } from "./physics.js";
import { f, sci } from "./format.js";

/** Live readout tiles + the regime badge. Returns the operating point. */
export function renderTiles(S, d, tilesEl, regimeEl, noteEl) {
  const lam = S.lam, Vgs = S.Vgs, Vds = S.Vds;
  const o = op(d, Vgs, Vds, lam);
  const V0 = d.Phi - o.vgi;

  const I = o.I;
  const G = gm(d, Vgs, Vds, lam);
  const GD = gd(d, Vgs, Vds, lam);
  const C = Cgs(d, o.vgi);
  const F = fT(d, Vgs, Vds, lam);
  const vdi = Vdsat(d, o.vgi);
  const vd = vdi + Iint(d, o.vgi, vdi, 0) * (d.Rs + d.Rd);   // knee, referred to the terminals
  const Ws = depletionWidth(d, V0);
  const open = 1 - Math.min(Ws / d.a, 1);
  const Gi = G / Math.max(1 - G * d.Rs, 1e-6);               // intrinsic g_m before degeneration

  const cut = V0 >= d.Vp;
  const sat = Vds >= vd;
  const regime = cut ? ["crit", "Cut-off"]
    : Vds <= 0 ? ["warn", "Zero bias"]
    : sat ? ["ok", "Saturation"]
    : ["warn", "Linear / triode"];

  regimeEl.innerHTML = '<span class="badge ' + regime[0] + '"><i class="dot"></i>' + regime[1] + "</span>";

  const limitedBy = d.model === "vel" && Igcm(d, o.vgi, d.Vp - V0) > Ivel(d, o.vgi)
    ? "velocity-limited" : "gradual-channel";

  const tiles = [
    { k: "Pinch-off V<sub>p</sub>",        v: f(d.Vp, 3),                          u: "V",   d: "qN<sub>D</sub>a²/2ε<sub>s</sub>", hero: 1 },
    { k: "Threshold V<sub>T</sub>",        v: (d.VT >= 0 ? "+" : "") + f(d.VT, 3), u: "V",   d: d.VT < 0 ? "depletion mode" : "enhancement mode", hero: 1 },
    { k: "Drain current I<sub>DS</sub>",   v: f(I * 1e3, 2),                       u: "mA",  d: f(I / d.Z, 0) + " mA/mm", hero: 1 },
    { k: "Transconductance g<sub>m</sub>", v: f(G * 1e3, 2),                       u: "mS",  d: f(G / d.Z, 0) + " mS/mm" },
    { k: "Cutoff freq f<sub>T</sub>",      v: f(F / 1e9, 1),                       u: "GHz", d: limitedBy, hero: 1 },
    { k: "Gate cap. C<sub>gs</sub>",       v: f(C * 1e15, 1),                      u: "fF",  d: "ε<sub>s</sub>ZL/W<sub>s</sub>" },
    { k: "Source depletion W<sub>s</sub>", v: f(Ws * 1e6, 3),                      u: "µm",  d: f(open * 100, 0) + "% of channel open" },
    { k: "V<sub>DS,sat</sub>",             v: f(vd, 2),                            u: "V",   d: "knee voltage" },
    { k: "Transit time τ",                 v: f(d.tau * 1e12, 2),                  u: "ps",  d: "L / v<sub>sat</sub>" },
    { k: "Output cond. g<sub>d</sub>",     v: f(GD * 1e3, 3),                      u: "mS",  d: "slope in saturation" },
    { k: "Voltage gain g<sub>m</sub>/g<sub>d</sub>", v: GD > 1e-9 ? f(G / GD, 1) : "∞", u: "", d: "intrinsic" },
    { k: "Max f<sub>T</sub> (transit)",    v: f(d.fTtransit / 1e9, 1),             u: "GHz", d: "v<sub>sat</sub>/2πL ceiling" },
    { k: "Series R<sub>s</sub> + R<sub>d</sub>", v: f(d.Rs + d.Rd, 1),             u: "Ω",   d: f(I * (d.Rs + d.Rd), 2) + " V lost of " + f(Vds, 2) + " V" },
    { k: "g<sub>m</sub> lost to R<sub>s</sub>",  v: Gi > 1e-9 ? f((1 - G / Gi) * 100, 0) : "0", u: "%", d: "intrinsic " + f(Gi * 1e3, 1) + " mS" },
  ];

  tilesEl.innerHTML = tiles.map((t) =>
    '<div class="tile' + (t.hero ? " hero" : "") + '"><div class="k">' + t.k + "</div>" +
    '<div class="v">' + t.v + (t.u ? '<span class="u">' + t.u + "</span>" : "") + "</div>" +
    '<div class="d">' + t.d + "</div></div>").join("");

  noteEl.innerHTML = d.model === "vel"
    ? "Current is capped at qN<sub>D</sub>v<sub>sat</sub>Z(a−W<sub>s</sub>) once carriers reach saturation velocity. This is what a 0.5 µm GaAs device actually does."
    : "Pure Shockley solution: mobility stays constant all the way to pinch-off. Valid for long gates, optimistic by several times at 0.5 µm.";

  return { I, G, Gi, C, F, vd, vdi, Ws, V0, cut, vgi: o.vgi, vdint: o.vdi };
}

/** The seven-step derivation, with the live numbers substituted in. */
export function renderSteps(S, d, r, el) {
  const es = d.es, Ws = r.Ws, V0 = r.V0;
  const fr = (n, dn) => '<span class="frac"><span class="n">' + n + '</span><span class="d">' + dn + "</span></span>";

  const step1 =
    '<div class="step"><div class="step-n">Step 1 · Pinch-off voltage</div>' +
    "<p>The gate depletion region has to swallow the whole channel thickness <i>a</i>. Setting W = a in the depletion-width expression and solving for the voltage gives V<sub>p</sub>.</p>" +
    '<div class="eq">V<sub>p</sub> = ' + fr("q N<sub>D</sub> a²", "2 ε<sub>s</sub>") + "</div>" +
    '<div class="eq num">= ' + fr("(1.602×10⁻¹⁹)(" + sci(d.ND, 2) + " m⁻³)(" + sci(d.a, 2) + " m)²", "2 × " + sci(es, 3) + " F/m") +
    " = <b>" + f(d.Vp, 3) + " V</b></div></div>";

  const step2 =
    '<div class="step"><div class="step-n">Step 2 · Threshold voltage</div>' +
    "<p>The Schottky barrier already depletes part of the channel at zero gate bias, so the gate voltage that just closes the channel is offset by Φ<sub>b</sub>.</p>" +
    '<div class="eq">V<sub>T</sub> = Φ<sub>b</sub> − V<sub>p</sub></div>' +
    '<div class="eq num">= ' + f(d.Phi, 2) + " − " + f(d.Vp, 3) + " = <b>" + (d.VT >= 0 ? "+" : "") + f(d.VT, 3) + " V</b> &nbsp;→&nbsp; " +
    (d.VT < 0 ? "normally-on (depletion mode)" : "normally-off (enhancement mode)") + "</div></div>";

  const step3 =
    '<div class="step"><div class="step-n">Step 3 · Depletion width at the source end</div>' +
    "<p>The applied V<sub>GS</sub> = " + f(S.Vgs, 2) + " V reaches the channel as " + f(r.vgi, 3) +
    " V after the drop across R<sub>s</sub>. The reverse bias across the Schottky contact at the source end is then Φ<sub>b</sub> − V<sub>GS</sub>.</p>" +
    '<div class="eq">W<sub>s</sub> = √( 2ε<sub>s</sub>(Φ<sub>b</sub> − V<sub>GS</sub>) / qN<sub>D</sub> ) = a √( (Φ<sub>b</sub>−V<sub>GS</sub>) / V<sub>p</sub> )</div>' +
    '<div class="eq num">= ' + f(d.a * 1e6, 3) + " µm × √(" + f(V0, 3) + " / " + f(d.Vp, 3) + ") = <b>" + f(Ws * 1e6, 4) +
    " µm</b> &nbsp;·&nbsp; open channel a − W<sub>s</sub> = " + f(Math.max(d.a - Ws, 0) * 1e6, 4) + " µm</div></div>";

  const vg = d.Vp - V0;
  const step4 =
    '<div class="step"><div class="step-n">Step 4 · Drain current (gradual channel)</div>' +
    "<p>Integrate the channel conductance along the gate, letting the depletion width grow with the local channel potential. g<sub>0</sub> = qN<sub>D</sub>µ<sub>n</sub>aZ/L is the conductance of the fully open channel.</p>" +
    '<div class="eq">I<sub>DS</sub> = g<sub>0</sub> { V<sub>DS</sub> − ' + fr("2", "3") + " " +
    fr("(V<sub>DS</sub>+Φ<sub>b</sub>−V<sub>GS</sub>)<sup>3/2</sup> − (Φ<sub>b</sub>−V<sub>GS</sub>)<sup>3/2</sup>", "√V<sub>p</sub>") + " }</div>" +
    '<div class="eq num">g<sub>0</sub> = ' + f(d.g0 * 1e3, 1) +
    " mS &nbsp;·&nbsp; saturates at V<sub>DS,sat</sub> = V<sub>p</sub> − (Φ<sub>b</sub>−V<sub>GS</sub>) = " + f(Math.max(vg, 0), 3) +
    " V &nbsp;·&nbsp; I<sub>sat</sub> = " + f(Igcm(d, r.vgi, Math.max(vg, 0)) * 1e3, 2) + " mA</div></div>";

  const Ilim = Ivel(d, r.vgi);
  const dominates = Igcm(d, r.vgi, Math.max(vg, 0)) > Ilim;
  const step5 =
    '<div class="step"><div class="step-n">Step 5 · Velocity saturation takes over</div>' +
    "<p>GaAs electrons stop accelerating past v<sub>sat</sub> ≈ " + f(S.vs, 2) +
    "×10⁷ cm/s. Once that happens the current is just charge density × velocity × open cross-section, and the gradual-channel formula no longer applies.</p>" +
    '<div class="eq">I<sub>sat</sub> = q N<sub>D</sub> v<sub>sat</sub> Z (a − W<sub>s</sub>)</div>' +
    '<div class="eq num">= ' + f(Ilim * 1e3, 2) + " mA &nbsp;vs&nbsp; " + f(Igcm(d, r.vgi, Math.max(vg, 0)) * 1e3, 2) +
    " mA from Step 4 → <b>" + (dominates ? "velocity saturation sets the current" : "gradual channel sets the current") + "</b></div></div>";

  const step6 =
    '<div class="step"><div class="step-n">Step 6 · Transconductance</div>' +
    "<p>Differentiate the saturated current with respect to V<sub>GS</sub>. In the velocity-saturated case the result collapses to a capacitance times a velocity.</p>" +
    '<div class="eq">g<sub>m</sub> = ∂I<sub>DS</sub>/∂V<sub>GS</sub> │<sub>V<sub>DS</sub></sub> &nbsp;·&nbsp; velocity-limited: g<sub>m,i</sub> = ε<sub>s</sub>Zv<sub>sat</sub>/W<sub>s</sub> &nbsp;·&nbsp; g<sub>m</sub> = g<sub>m,i</sub> / (1 + g<sub>m,i</sub>R<sub>s</sub>)</div>' +
    '<div class="eq num">intrinsic ' + f(r.Gi * 1e3, 2) + " mS → terminal <b>" + f(r.G * 1e3, 2) + " mS</b> = " +
    f(r.G / d.Z, 0) + " mS/mm of gate width</div></div>";

  const step7 =
    '<div class="step"><div class="step-n">Step 7 · Cutoff frequency</div>' +
    "<p>f<sub>T</sub> is where the short-circuit current gain falls to unity: the transconductance divided by the charging admittance of the gate capacitance. With velocity saturation the geometry cancels and only the transit time survives.</p>" +
    '<div class="eq">C<sub>gs</sub> = ' + fr("ε<sub>s</sub> Z L", "W<sub>s</sub>") + " &nbsp;·&nbsp; f<sub>T</sub> = " +
    fr("g<sub>m</sub>", "2π C<sub>gs</sub>") + " &nbsp;⟶&nbsp; " + fr("v<sub>sat</sub>", "2π L") + "</div>" +
    '<div class="eq num">C<sub>gs</sub> = ' + f(r.C * 1e15, 2) + " fF &nbsp;·&nbsp; f<sub>T</sub> = <b>" + f(r.F / 1e9, 1) +
    " GHz</b> &nbsp;·&nbsp; transit ceiling v<sub>sat</sub>/2πL = " + f(d.fTtransit / 1e9, 1) +
    " GHz &nbsp;(τ = " + f(d.tau * 1e12, 2) + " ps)</div></div>";

  el.innerHTML = step1 + step2 + step3 + step4 + step5 + step6 + step7;
}
