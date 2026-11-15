# MESFET Bench

An interactive GaAs MESFET simulator that runs entirely in the browser. Move a slider and the depletion region, the I–V family, the transconductance and the cutoff frequency all re-solve together.

No build step, no framework, no dependencies — plain ES modules, SVG and Canvas. Drop it on GitHub Pages and it works.

**Live demo:** `https://YOUR-USERNAME.github.io/mesfet-bench/`

---

## What it shows

| Panel | What it does |
|---|---|
| **Cross-section** | A scale drawing of the device at the current bias. Pixels-per-micron is shared between `L` and `a`, so changing the gate length really does change the shape. The depletion boundary is computed, not drawn — it tapers correctly from source to drain. |
| **Computed quantities** | 14 live readouts: pinch-off, threshold, drain current, g<sub>m</sub>, f<sub>T</sub>, C<sub>gs</sub>, transit time, intrinsic gain, and how much the parasitics are costing you. |
| **Output characteristics** | The I<sub>DS</sub>–V<sub>DS</sub> family stepped over V<sub>GS</sub>, with the saturation locus and a dashed "ghost" of the model you are *not* using. |
| **Transfer / g<sub>m</sub> / f<sub>T</sub>** | A sweep over V<sub>GS</sub>. The f<sub>T</sub> view also draws the transit-time ceiling v<sub>sat</sub>/2πL. |
| **Derivation** | Seven steps of algebra with your current numbers substituted in. |

### The point of the thing

Textbooks give you the Shockley gradual-channel solution. At L = 0.5 µm it is wrong by roughly 8×.

The long-channel model holds mobility constant, so drift velocity rises without limit as the field grows. Real GaAs electrons stop accelerating at about 10⁷ cm/s, and the current becomes charge × velocity × open cross-section:

```
I_sat = q · N_D · v_sat · Z · (a − W_s)
```

Differentiate that and the geometry cancels:

```
f_T = v_sat / 2πL
```

**The cutoff frequency depends only on how long the electrons take to cross the gate.** Switch to the f<sub>T</sub> view and sweep V<sub>GS</sub>: the velocity-saturated curve is flat at 31.8 GHz while the gradual-channel ghost climbs past 400. That flatness is the physics.

---

## Quick start

ES modules are blocked over `file://`, so you need a local server — any one will do:

```bash
git clone https://github.com/YOUR-USERNAME/mesfet-bench.git
cd mesfet-bench

python3 -m http.server 8000      # or: npx serve .
#                                  or: php -S localhost:8000
```

Then open <http://localhost:8000>.

**Want a file you can just double-click?** `npm run build` writes `dist/mesfet-bench.html` — the whole app inlined into one self-contained file that opens with no server at all. Handy for emailing to someone or putting on a USB stick.

---

## Deploying to GitHub Pages

The site is already static, so there is nothing to compile.

**Option A — the included workflow (recommended).** `.github/workflows/pages.yml` runs the tests and publishes on every push to `main`.

1. Push the repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. The Actions tab shows the deploy; the URL appears when it finishes.

**Option B — no Actions.** **Settings → Pages → Source: Deploy from a branch**, pick `main` and `/ (root)`. Pages serves `index.html` directly.

Either way, update two things afterwards:

- the **Live demo** URL at the top of this README
- the **Source on GitHub** link at the bottom of `index.html`

> `.nojekyll` is included so GitHub Pages serves every file as-is instead of running Jekyll over it.

---

## Project structure

```
mesfet-bench/
├── index.html              page shell — markup only, no logic
├── favicon.svg
├── css/
│   └── styles.css          design tokens + layout, light and dark
├── js/
│   ├── physics.js          ← the device model. Pure functions, no DOM.
│   ├── config.js           defaults, slider definitions, presets
│   ├── format.js           number formatting helpers
│   ├── theme.js            CSS-variable reads, light/dark toggle
│   ├── plot.js             generic canvas plotter
│   ├── device.js           SVG cross-section
│   ├── charts.js           the two characteristic plots
│   ├── readouts.js         live tiles + substituted derivation
│   └── main.js             state, controls, render loop
├── test/
│   └── physics.test.js     13 tests against the model
├── tools/
│   └── build-standalone.mjs  bundles everything into one HTML file
└── .github/workflows/      CI + Pages deploy
```

### How it fits together

**`js/physics.js` has no DOM access at all.** That is the important boundary: it means Node can import the exact module the browser runs and test it directly, instead of you squinting at a chart to see whether a change broke something.

`main.js` owns one `state` object as the single source of truth. Every control writes into it and calls `render()`, which is throttled to one animation frame. Nothing else stores state.

---

## Testing

```bash
npm test          # or simply: node --test
```

Needs Node 18 or newer; no packages to install. The suite covers:

- pinch-off and threshold against the closed-form expressions
- `W = a·√(V/V_p)`, exact at pinch-off
- cut-off below threshold, conduction above it
- monotonic, finite, non-negative current across the full bias grid for both models
- **the series-resistance solver**, checked for self-consistency at every bias
- g<sub>m</sub> degradation matching `1/(1 + g_m·R_s)`
- f<sub>T</sub> pinned to `v_sat/2πL` independently of bias
- the long-channel model overpredicting, as it should
- every preset producing a finite, usable device

---

## Customising it

**Sliders and presets** live in `js/config.js`. Add an entry to `SPECS` and the control builds itself — no other file needs to change:

```js
{ g: "mat", k: "Tnom", lab: "Temperature", sym: "T", min: 200, max: 500, step: 5,
  fmt: (v) => f(v, 0) + " K" }
```

`g` is the control group (`geo`, `mat` or `bias`), `k` is the state key, and `fmt` prints the live value.

**Colours** are CSS custom properties at the top of `css/styles.css`. Every token is defined three times — on bare `:root`, under `prefers-color-scheme: dark`, and under `[data-theme="dark"]` — so the toggle wins in both directions.

### Two things to know before you change the model

`op()` solves the series-resistance problem by **bisection on a monotone residual**. Damped fixed-point iteration does *not* converge here — the loop gain `g0·R` runs to about 8.6 for typical parameters. If you change the current model, that monotonicity is the property that must hold or the solver silently returns garbage.

`gm` and `gd` are **central differences**, not analytic derivatives. That is deliberate: they stay correct automatically when you switch models or add parasitics, and the source-degeneration factor falls out for free.

---

## What the model leaves out

Gate forward conduction above roughly +0.6 V, substrate leakage, impact ionisation, and the velocity overshoot peculiar to GaAs. Set `R_s` and `R_d` to zero and the knee collapses to about `E_c·L ≈ 0.1 V` — the intrinsic channel really does saturate that fast, and almost all of a measured knee voltage is parasitic.

---

## Licence

MIT — see [LICENSE](LICENSE).
