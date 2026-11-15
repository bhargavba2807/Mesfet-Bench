/**
 * Unit tests for the device model. Run with:  npm test   (needs Node 18+)
 *
 * These import the same physics module the browser uses, so a regression in
 * the model is caught here rather than by squinting at a chart.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  Q, EPS0, derive, depletionWidth, Igcm, Ivel, Vdsat, Iint, op, Id, gm, gd, Cgs, fT,
} from "../js/physics.js";
import { DEFAULTS } from "../js/config.js";

const PS57 = { ...DEFAULTS, model: "vel" };
const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ± ${tol}`);

/* ------------------------------------------------------------------ */

test("PS-57 pinch-off and threshold voltage", () => {
  const d = derive(PS57);
  // Vp = q·N_D·a² / 2ε_s, computed independently:
  const expected = (Q * 1e23 * (0.2e-6) ** 2) / (2 * 12.9 * EPS0);
  close(d.Vp, expected, 1e-9, "Vp matches the closed form");
  close(d.Vp, 2.805, 5e-3, "Vp ≈ 2.805 V");
  close(d.VT, 0.8 - d.Vp, 1e-12, "VT = Phi_b − Vp");
  assert.ok(d.VT < 0, "PS-57 is depletion mode (normally on)");
});

test("depletion width obeys W = a·sqrt(V / Vp)", () => {
  const d = derive(PS57);
  for (const V of [0.2, 0.8, 1.5, d.Vp]) {
    close(depletionWidth(d, V), d.a * Math.sqrt(V / d.Vp), 1e-12, `W(${V})`);
  }
  close(depletionWidth(d, d.Vp), d.a, 1e-12, "W = a exactly at pinch-off");
  assert.equal(depletionWidth(d, -1), 0, "negative bias clamps to zero width");
});

test("device is off below threshold and on above it", () => {
  const d = derive(PS57);
  assert.equal(Id(d, d.VT - 0.1, 3, 0), 0, "no current below VT");
  assert.equal(Igcm(d, d.VT - 0.1, 3), 0, "gradual-channel term is zero too");
  assert.equal(Ivel(d, d.VT - 0.1), 0, "velocity ceiling is zero too");
  assert.ok(Id(d, 0, 3, 0) > 0, "current flows at VGS = 0");
});

test("drain current rises monotonically with VDS and never goes negative", () => {
  const d = derive(PS57);
  for (const vgs of [0, -0.5, -1, -1.5, -2]) {
    let prev = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const I = Id(d, vgs, (10 * i) / 400, 0);
      assert.ok(Number.isFinite(I), `finite at VGS=${vgs}`);
      assert.ok(I >= 0, `non-negative at VGS=${vgs}`);
      assert.ok(I >= prev - 1e-12, `monotonic at VGS=${vgs}`);
      prev = I;
    }
  }
});

test("series-resistance solver reaches a self-consistent operating point", () => {
  const d = derive(PS57);
  assert.ok(d.Rs > 0, "the default device has parasitics");
  for (const vds of [0.1, 0.5, 1, 3, 6, 10]) {
    const o = op(d, 0, vds, DEFAULTS.lam);
    const residual = Iint(d, o.vgi, o.vdi, DEFAULTS.lam) - o.I;
    close(residual, 0, 1e-9, `residual at VDS=${vds}`);
    close(o.vgi, -o.I * d.Rs, 1e-12, "internal VGS is pulled down by I·Rs");
    close(o.vdi, Math.max(vds - o.I * (d.Rs + d.Rd), 0), 1e-12, "internal VDS loses I·(Rs+Rd)");
  }
});

test("Rs degrades transconductance by 1/(1 + gm·Rs)", () => {
  const withR = derive(PS57);
  const noR = derive({ ...PS57, Rs: 0, Rd: 0 });
  const g = gm(withR, 0, 3, 0);
  const gIntrinsic = gm(noR, 0, 3, 0);
  assert.ok(g < gIntrinsic, "terminal gm is lower than intrinsic gm");
  // gm_terminal ≈ gm_i / (1 + gm_i·Rs)
  close(g, gIntrinsic / (1 + gIntrinsic * withR.Rs), 0.1 * g, "matches the degeneration formula");
});

test("velocity saturation pins fT to the transit-time ceiling", () => {
  const d = derive({ ...PS57, Rs: 0, Rd: 0 });
  close(d.fTtransit / 1e9, 31.83, 0.05, "v_sat/2πL ≈ 31.8 GHz for L = 0.5 µm");
  // Across bias, fT should sit at the ceiling rather than varying with VGS.
  for (const vgs of [0, -0.5, -1, -1.5]) {
    const ratio = fT(d, vgs, 3, 0) / d.fTtransit;
    close(ratio, 1, 0.02, `fT/ceiling at VGS=${vgs}`);
  }
});

test("the long-channel model is wildly optimistic at 0.5 µm", () => {
  const vel = derive(PS57);
  const gcm = derive({ ...PS57, model: "gcm" });
  const iVel = Id(vel, 0, 3, 0);
  const iGcm = Id(gcm, 0, 3, 0);
  assert.ok(iGcm > 3 * iVel, "gradual channel overpredicts current several-fold");
  assert.ok(fT(gcm, 0, 3, 0) > 5 * fT(vel, 0, 3, 0), "and overpredicts fT even more");
});

test("the intrinsic knee is set by the channel, not by the parasitics", () => {
  const bare = derive({ ...PS57, Rs: 0, Rd: 0 });
  const knee = Vdsat(bare, 0);
  assert.ok(knee > 0 && knee < 0.5, `intrinsic knee is small (got ${knee.toFixed(3)} V)`);

  // Adding parasitics must push the terminal knee out, never pull it in.
  const withR = derive(PS57);
  const kneeTerminal = Vdsat(withR, 0) + Iint(withR, 0, Vdsat(withR, 0), 0) * (withR.Rs + withR.Rd);
  assert.ok(kneeTerminal > knee, "parasitics move the observed knee outward");
});

test("gradual-channel model saturates exactly at Vp − (Phi − VGS)", () => {
  const d = derive({ ...PS57, model: "gcm" });
  for (const vgs of [0, -1, -2]) {
    close(Vdsat(d, vgs), d.Vp - (d.Phi - vgs), 1e-12, `Vdsat at VGS=${vgs}`);
  }
});

test("capacitance falls as the gate depletes further", () => {
  const d = derive(PS57);
  const c0 = Cgs(d, 0);
  const c1 = Cgs(d, -1.5);
  assert.ok(c1 < c0, "more reverse bias widens W and lowers Cgs");
  close(c0, (d.es * d.Z * d.L) / depletionWidth(d, d.Phi), 1e-18, "matches eps·Z·L/W");
});

test("no NaN anywhere on a full bias grid, for either model", () => {
  for (const model of ["vel", "gcm"]) {
    const d = derive({ ...PS57, model });
    for (let i = 0; i <= 120; i++) {
      const vgs = -6 + (6.5 * i) / 120;
      for (const vds of [0, 0.05, 0.3, 1, 3, 6, 10]) {
        for (const [name, val] of [
          ["Id", Id(d, vgs, vds, DEFAULTS.lam)],
          ["gm", gm(d, vgs, vds, DEFAULTS.lam)],
          ["gd", gd(d, vgs, vds, DEFAULTS.lam)],
          ["fT", fT(d, vgs, vds, DEFAULTS.lam)],
        ]) {
          assert.ok(Number.isFinite(val), `${name} finite at ${model} VGS=${vgs.toFixed(2)} VDS=${vds}`);
        }
      }
    }
  }
});

test("every preset produces a usable device", async (t) => {
  const { PRESETS } = await import("../js/config.js");
  for (const p of PRESETS) {
    const d = derive({ ...DEFAULTS, ...p.v, model: "vel" });
    assert.ok(Number.isFinite(d.Vp) && d.Vp > 0, `${p.n}: Vp is positive and finite`);
    assert.ok(Number.isFinite(Id(d, d.VT / 2, 3, 0)), `${p.n}: current is finite at mid-bias`);
    assert.ok(Number.isFinite(fT(d, d.VT / 2, 3, 0)), `${p.n}: fT is finite at mid-bias`);
  }
});
