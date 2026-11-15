/**
 * device.js — the live SVG cross-section.
 *
 * The drawing is generated from the physics, not from a fixed picture:
 * pixels-per-micron is shared between L and a, so changing the gate length
 * really does change the aspect ratio of the device. The depletion boundary
 * comes from inverting the gradual-channel x(V) relation on a 56-point grid,
 * which gives the correct asymmetric taper from source to drain.
 */

import { depletionWidth, Vdsat, op } from "./physics.js";
import { f, sci } from "./format.js";
import { cssVar } from "./theme.js";

export function drawDevice(svg, S, d) {
  const VW = 680, VH = 330, top = 104;

  const o = op(d, S.Vgs, S.Vds, S.lam);
  const Vgs = o.vgi, Vds = o.vdi;          // the channel sees bias minus parasitic drops
  const V0 = d.Phi - Vgs;
  const cut = V0 >= d.Vp;

  // honest scale: one px-per-micron factor shared by both dimensions
  const s = Math.max(Math.min(250 / S.L, 104 / S.a), 40);
  const gLpx = Math.max(s * S.L, 22);
  const aPx = Math.max(s * S.a, 10);
  const xg0 = (VW - gLpx) / 2, xg1 = xg0 + gLpx;
  const xL = 46, xR = VW - 46, bot = top + aPx, subBot = VH - 56;

  // channel potential profile along the gate
  const vd = Vdsat(d, Vgs);
  const Vch = Math.min(Vds, vd);
  const N = 56, pts = [];
  const F = (v) => v - ((2 / 3) / Math.sqrt(d.Vp)) * (Math.pow(v + V0, 1.5) - Math.pow(V0, 1.5));
  const Ftot = F(Vch) || 1e-12;
  for (let i = 0; i <= N; i++) {
    const v = (Vch * i) / N;
    const xf = Vch > 1e-9 ? Math.min(Math.max(F(v) / Ftot, 0), 1) : i / N;
    const W = Math.min((depletionWidth(d, V0 + v) / (S.a * 1e-6)) * aPx, aPx);
    pts.push([xg0 + xf * gLpx, top + W]);
  }
  pts.sort((p, q) => p[0] - q[0]);

  const Ws = depletionWidth(d, V0);
  const Wdr = depletionWidth(d, V0 + Vch);
  const pinched = Ws >= d.a || Wdr >= d.a - 1e-12;

  const poly = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
  const dep = "M" + xg0 + "," + top + " L" + poly + " L" + xg1 + "," + top + " Z";

  const T = (x, y, t, attrs) => '<text x="' + x + '" y="' + y + '" ' + (attrs || "") + ">" + t + "</text>";
  const metal = cssVar("--metal"), fgc = cssVar("--fg"), mut = cssVar("--muted"),
        faint = cssVar("--faint"), acc = cssVar("--accent-ink");

  const metal2 = cssVar("--metal-2"), sub2 = cssVar("--substrate-2"), nlay2 = cssVar("--nlayer-2");
  const depl = cssVar("--depl");

  let h = "";
  h += "<defs>" +
       // layer gradients give the stack physical depth
       '<linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + sub2 + '"/><stop offset="100%" stop-color="' + cssVar("--substrate") + '"/></linearGradient>' +
       '<linearGradient id="gCh" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + nlay2 + '"/><stop offset="100%" stop-color="' + cssVar("--nlayer") + '"/></linearGradient>' +
       '<linearGradient id="gMet" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + metal2 + '"/><stop offset="100%" stop-color="' + metal + '"/></linearGradient>' +
       '<linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + depl + '" stop-opacity="0.55"/>' +
         '<stop offset="100%" stop-color="' + depl + '" stop-opacity="0.28"/></linearGradient>' +
       '<pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
         '<rect width="7" height="7" fill="url(#gDep)"/>' +
         '<line x1="0" y1="0" x2="0" y2="7" stroke="' + fgc + '" stroke-width="1.3" opacity="0.3"/></pattern>' +
       '<marker id="ar" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">' +
         '<path d="M0,0 L7,3.5 L0,7 Z" fill="' + mut + '"/></marker>' +
       '<filter id="soft" x="-20%" y="-30%" width="140%" height="190%">' +
         '<feDropShadow dx="0" dy="1.4" stdDeviation="1.6" flood-color="#000" flood-opacity="0.3"/></filter>' +
       "</defs>";
  h += '<g font-family="' + cssVar("--mono").replace(/"/g, "&quot;") + '" font-size="11">';

  // substrate and channel
  h += '<rect x="' + xL + '" y="' + bot + '" width="' + (xR - xL) + '" height="' + (subBot - bot) + '" fill="url(#gSub)" rx="2"/>';
  h += '<rect x="' + xL + '" y="' + top + '" width="' + (xR - xL) + '" height="' + aPx + '" fill="url(#gCh)"/>';
  // metallurgical junction line between channel and substrate
  h += '<line x1="' + xL + '" y1="' + bot + '" x2="' + xR + '" y2="' + bot + '" stroke="' + fgc + '" stroke-width="0.6" opacity="0.22"/>';

  // depletion region: a solid tint so it reads as a distinct layer, then the hatch
  h += '<path d="' + dep + '" fill="' + depl + '" opacity="0.45"/>';
  h += '<path d="' + dep + '" fill="url(#hatch)"/>';
  h += '<path d="M' + poly + '" fill="none" stroke="' + depl + '" stroke-width="2.2" stroke-linejoin="round"/>';

  // contacts
  const ct = top - 18;
  h += '<g filter="url(#soft)">';
  h += '<rect x="' + xL + '" y="' + ct + '" width="78" height="' + (18 + aPx * 0.45) + '" rx="2.5" fill="url(#gMet)"/>';
  h += '<rect x="' + (xR - 78) + '" y="' + ct + '" width="78" height="' + (18 + aPx * 0.45) + '" rx="2.5" fill="url(#gMet)"/>';
  h += '<rect x="' + xg0 + '" y="' + (top - 15) + '" width="' + gLpx + '" height="15" rx="2" fill="url(#gMet)"/>';
  h += "</g>";
  h += '<rect x="' + xg0 + '" y="' + (top - 15) + '" width="' + gLpx + '" height="15" rx="2" fill="none" stroke="' + acc + '" stroke-width="1.6"/>';

  // terminal labels
  h += T(xL + 39, ct - 9, "SOURCE", 'text-anchor="middle" fill="' + mut + '" font-size="9.5" letter-spacing="1.4"');
  h += T(xR - 39, ct - 9, "DRAIN", 'text-anchor="middle" fill="' + mut + '" font-size="9.5" letter-spacing="1.4"');
  h += T(xg0 + gLpx / 2, top - 22, "SCHOTTKY GATE", 'text-anchor="middle" fill="' + acc + '" font-size="9.5" letter-spacing="1.4"');

  // bias callouts
  h += T(xL + 39, ct - 26, "0 V", 'text-anchor="middle" fill="' + faint + '" font-size="10"');
  h += T(xR - 39, ct - 26, "V_DS = " + f(S.Vds, 2) + " V", 'text-anchor="middle" fill="' + faint + '" font-size="10"');
  h += T(xg0 + gLpx / 2, top - 36, "V_GS = " + (S.Vgs >= 0 ? "+" : "") + f(S.Vgs, 2) + " V", 'text-anchor="middle" fill="' + faint + '" font-size="10"');
  if (d.Rs + d.Rd > 0) {
    h += T(VW / 2, top - 50, "channel sees " + f(Vgs, 2) + " / " + f(Vds, 2) + " V after R_s, R_d drops",
      'text-anchor="middle" fill="' + faint + '" font-size="9.5" opacity="0.9"');
  }

  // layer labels
  h += T(xL + 8, subBot - 10, "semi-insulating GaAs substrate", 'fill="' + mut + '" font-size="10" opacity="0.85"');
  if (aPx > 22) h += T(xL + 8, bot - 5, "n-GaAs   N_D = " + sci(S.ND, 1) + " cm⁻³", 'fill="' + fgc + '" font-size="10" opacity="0.8"');

  // dimensions
  h += '<line x1="' + (xL - 12) + '" y1="' + top + '" x2="' + (xL - 12) + '" y2="' + bot + '" stroke="' + mut + '" stroke-width="1" marker-start="url(#ar)" marker-end="url(#ar)"/>';
  // rotated like an engineering drawing, so a long label cannot run off the viewBox
  const aMidY = (top + bot) / 2;
  h += T(xL - 20, aMidY, "a = " + f(S.a, 2) + " µm",
    'text-anchor="middle" fill="' + mut + '" font-size="10" transform="rotate(-90 ' + (xL - 20) + ' ' + aMidY + ')"');
  h += '<line x1="' + xg0 + '" y1="' + (subBot + 16) + '" x2="' + xg1 + '" y2="' + (subBot + 16) + '" stroke="' + mut + '" stroke-width="1" marker-start="url(#ar)" marker-end="url(#ar)"/>';
  h += T((xg0 + xg1) / 2, subBot + 31, "L = " + f(S.L, 2) + " µm", 'text-anchor="middle" fill="' + mut + '" font-size="10.5"');

  // depletion widths at each end
  const wsPx = Math.min((Ws / (S.a * 1e-6)) * aPx, aPx);
  const wdPx = Math.min((Wdr / (S.a * 1e-6)) * aPx, aPx);
  h += '<line x1="' + (xg0 + 6) + '" y1="' + top + '" x2="' + (xg0 + 6) + '" y2="' + (top + wsPx) + '" stroke="' + fgc + '" stroke-width="1" opacity="0.6"/>';
  h += T(xg0 - 6, top + wsPx / 2 + 4, "W_s", 'text-anchor="end" fill="' + fgc + '" font-size="10" opacity="0.8"');
  h += T(xg1 + 6, top + wdPx / 2 + 4, "W_d", 'fill="' + fgc + '" font-size="10" opacity="0.8"');

  // channel state
  const open = Math.max(aPx - wdPx, 0);
  if (cut) {
    h += '<rect x="' + xg0 + '" y="' + top + '" width="' + gLpx + '" height="' + aPx + '" fill="url(#hatch)"/>';
    h += T(VW / 2, bot + 28, "CHANNEL FULLY DEPLETED — DEVICE OFF",
      'text-anchor="middle" fill="' + cssVar("--crit") + '" font-size="10.5" letter-spacing="1.2"');
  } else if (pinched) {
    h += T(xg1 + 10, top + aPx + 20, "pinch-off at drain end", 'fill="' + cssVar("--warn") + '" font-size="10"');
    h += '<circle cx="' + xg1 + '" cy="' + bot + '" r="4" fill="' + cssVar("--warn") + '"/>';
  }
  if (!cut) {
    h += '<line x1="' + (xL + 88) + '" y1="' + (bot - open / 2) + '" x2="' + (xg0 - 10) + '" y2="' + (bot - open / 2) + '" stroke="' + acc + '" stroke-width="1.6" opacity="0.7" marker-end="url(#ar)"/>';
    h += '<line x1="' + (xg1 + 34) + '" y1="' + (bot - open / 2) + '" x2="' + (xR - 88) + '" y2="' + (bot - open / 2) + '" stroke="' + acc + '" stroke-width="1.6" opacity="0.7" marker-end="url(#ar)"/>';
    h += T(VW / 2, subBot - 32, "electron drift  ⟶", 'text-anchor="middle" fill="' + acc + '" font-size="10" opacity="0.85"');
  }

  h += "</g>";
  svg.innerHTML = h;
}
