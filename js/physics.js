/**
 * physics.js — the GaAs MESFET device model.
 *
 * Pure functions over numbers. No DOM, no globals, no side effects, so this
 * module imports cleanly into Node for unit testing (see test/physics.test.js).
 *
 * Two current models are available, selected by `state.model`:
 *
 *   "gcm"  Shockley gradual-channel (long-channel) solution. Mobility is held
 *          constant all the way to pinch-off. Correct for long gates, and
 *          optimistic by several times at L = 0.5 µm.
 *
 *   "vel"  The same solution capped by a velocity-saturated ceiling,
 *          I = q·N_D·v_sat·Z·(a − W_s). This is what a short-gate GaAs device
 *          actually does, and it is why f_T collapses to v_sat / 2πL.
 *
 * Series resistances R_s and R_d are solved self-consistently, so R_s both
 * pushes the knee out and degrades g_m by 1/(1 + g_m·R_s).
 */

export const Q = 1.602176634e-19;      // elementary charge, C
export const EPS0 = 8.8541878128e-12;  // vacuum permittivity, F/m
const PI = Math.PI;

/**
 * Convert a parameter set in engineering units into SI working values plus the
 * derived constants that do not depend on bias.
 *
 * @param {object} s  state: L,a (µm), ND (cm^-3), Z (µm), er, mu (cm²/V·s),
 *                    vs (10^7 cm/s), Phi (V), Rs,Rd (Ω·mm), model ("vel"|"gcm")
 * @returns {object}  derived device constants in SI units
 */
export function derive(s) {
  const es = s.er * EPS0;
  const L = s.L * 1e-6;          // µm  -> m
  const a = s.a * 1e-6;          // µm  -> m
  const ND = s.ND * 1e6;         // cm^-3 -> m^-3
  const Z = s.Z * 1e-6;          // µm  -> m
  const mu = s.mu * 1e-4;        // cm²/V·s -> m²/V·s
  const vsat = s.vs * 1e7 * 1e-2; // 10^7 cm/s -> m/s

  const Vp = (Q * ND * a * a) / (2 * es);   // pinch-off voltage
  const Zmm = s.Z * 1e-3;                   // gate width in mm, for Ω·mm parasitics

  return {
    es, L, a, ND, Z, mu, vsat,
    Vp,
    VT: s.Phi - Vp,                         // threshold voltage
    g0: (Q * ND * mu * a * Z) / L,          // fully-open channel conductance
    Ifull: Q * ND * vsat * Z * a,           // velocity-saturated current, undepleted
    Phi: s.Phi,
    model: s.model,
    Rs: s.Rs / Zmm,                         // Ω·mm -> Ω for this gate width
    Rd: s.Rd / Zmm,
    tau: L / vsat,                          // transit time
    fTtransit: vsat / (2 * PI * L),         // the f_T ceiling set by transit time
  };
}

/** Schottky depletion width for a reverse bias of V volts, in metres. */
export function depletionWidth(d, V) {
  return Math.sqrt((2 * d.es * Math.max(V, 0)) / (Q * d.ND));
}

/**
 * Shockley gradual-channel current, clamped at its own pinch-off.
 * Below threshold the channel is fully depleted and the current is zero.
 */
export function Igcm(d, Vgs, Vds) {
  const V0 = d.Phi - Vgs;
  if (V0 >= d.Vp) return 0;
  const vPinch = d.Vp - V0;
  const v = Math.min(Math.max(Vds, 0), vPinch);
  return d.g0 * (v - ((2 / 3) / Math.sqrt(d.Vp)) *
    (Math.pow(v + V0, 1.5) - Math.pow(V0, 1.5)));
}

/** Velocity-limited current ceiling, set by the open channel at the source end. */
export function Ivel(d, Vgs) {
  const V0 = d.Phi - Vgs;
  if (V0 >= d.Vp) return 0;
  return d.Ifull * (1 - Math.sqrt(V0 / d.Vp));
}

/**
 * Intrinsic knee voltage: where the chosen model stops rising with V_DS.
 * For "vel" this is where the gradual-channel curve first meets the ceiling,
 * found by bisection because Igcm rises monotonically in V_DS.
 */
export function Vdsat(d, Vgs) {
  const V0 = d.Phi - Vgs;
  if (V0 >= d.Vp) return 0;
  const vPinch = d.Vp - V0;
  if (d.model === "gcm") return vPinch;

  const limit = Ivel(d, Vgs);
  if (Igcm(d, Vgs, vPinch) <= limit) return vPinch;

  let lo = 0, hi = vPinch;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (Igcm(d, Vgs, m) < limit) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Intrinsic drain current — what the channel itself sees, before parasitics. */
export function Iint(d, Vgs, Vds, lam) {
  const V0 = d.Phi - Vgs;
  if (V0 >= d.Vp || Vds <= 0) return 0;

  let I = Igcm(d, Vgs, Vds);
  if (d.model === "vel") I = Math.min(I, Ivel(d, Vgs));

  const vd = Vdsat(d, Vgs);
  if (Vds > vd && lam) I *= (1 + lam * (Vds - vd));   // channel-length modulation
  return Math.max(I, 0);
}

/**
 * Terminal operating point. R_s and R_d steal part of the applied bias, which
 * makes the problem implicit: the current depends on the internal bias, which
 * depends on the current.
 *
 * residual(I) = Iint(Vgs − I·Rs, Vds − I·R) − I
 *
 * falls monotonically in I, so bisection on [0, I_no-drop] always converges.
 * (A damped fixed-point iteration does NOT converge here — loop gain g0·R can
 * exceed 8 for typical parameters.)
 *
 * @returns {{I:number, vgi:number, vdi:number}} terminal current and the
 *          internal gate–source / drain–source voltages the channel sees.
 */
export function op(d, Vgs, Vds, lam) {
  const R = d.Rs + d.Rd;
  const I0 = Iint(d, Vgs, Vds, lam);     // drop-free current bounds the solution above
  if (R <= 0 || I0 <= 0) return { I: I0, vgi: Vgs, vdi: Vds };

  const residual = (I) =>
    Iint(d, Vgs - I * d.Rs, Math.max(Vds - I * R, 0), lam) - I;

  let lo = 0, hi = I0;
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    if (residual(m) > 0) lo = m; else hi = m;
  }
  const I = (lo + hi) / 2;
  return { I, vgi: Vgs - I * d.Rs, vdi: Math.max(Vds - I * R, 0) };
}

/** Terminal drain current. */
export const Id = (d, Vgs, Vds, lam) => op(d, Vgs, Vds, lam).I;

/**
 * Transconductance, by central difference on the terminal current.
 * Taken numerically so that it stays correct automatically when the model is
 * switched or R_s is changed — the 1/(1 + g_m·R_s) degradation falls out for
 * free instead of being hand-coded.
 */
export const gm = (d, Vgs, Vds, lam) => {
  const h = 2e-3;
  return (Id(d, Vgs + h, Vds, lam) - Id(d, Vgs - h, Vds, lam)) / (2 * h);
};

/** Output conductance, by central difference on V_DS. */
export const gd = (d, Vgs, Vds, lam) => {
  const h = 2e-3;
  return (Id(d, Vgs, Vds + h, lam) - Id(d, Vgs, Math.max(Vds - h, 0), lam)) / (2 * h);
};

/** Gate–source capacitance, parallel-plate across the source-end depletion width. */
export function Cgs(d, Vgs) {
  const W = Math.max(depletionWidth(d, d.Phi - Vgs), 1e-9);
  return (d.es * d.Z * d.L) / Math.min(W, d.a);
}

/**
 * Unity-current-gain cutoff frequency, g_m / 2πC_gs, evaluated at the internal
 * gate bias. Under velocity saturation the geometry cancels and this tends to
 * the transit-time ceiling v_sat / 2πL.
 */
export function fT(d, Vgs, Vds, lam) {
  const c = Cgs(d, op(d, Vgs, Vds, lam).vgi);
  return c > 0 ? gm(d, Vgs, Vds, lam) / (2 * PI * c) : 0;
}
