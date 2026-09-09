# Phase 0 — Data-Integrity Audit

Status key: **fixed** · **partial** (fix landed, follow-up noted) · **open**

The shared derivation layer added for this phase is
[`src/lib/climate/derive.ts`](../src/lib/climate/derive.ts). Every delta,
absolute-from-anomaly, percentile band and display-rounding decision now goes
through it, so D1–D3 cannot recur by the same mechanism (one quantity computed
two ways in two places).

---

## D1 — Projected equals baseline · **fixed**

**Reproduction:** Explore → Uzbekistan → Tashkent → SSP2-4.5 → 2040–2059 showed
`BASELINE 10.4 °C`, `PROJECTED 10.4 °C`, `CHANGE +1.8 °C`.

**Root cause:** the synthetic field generators
([`uzb-grid.ts`](../src/lib/climate/uzb-grid.ts),
[`aus-grid.ts`](../src/lib/climate/aus-grid.ts),
[`nzl-grid.ts`](../src/lib/climate/nzl-grid.ts)) computed the absolute
*climatology* branch as `baseVal + latFactor + lapse` — **with no scenario or
period term**. A "future climatology" was therefore byte-identical to the
baseline. The change signal came from a separate `anomaly` branch that *did*
vary with scenario and period, so `CHANGE` moved while `PROJECTED` did not.
[`point/route.ts`](../src/app/api/climate/point/route.ts) then reported the two
side by side.

**Fix:**
1. Generators split into `…BaselineClimatology(cell)` and
   `…AnomalyMedian(cell)` helpers. A future absolute is now
   `climBaseline + deltaAtPercentile(anomMedian, …)` — composed, never
   generated independently.
2. `point/route.ts` and `scenarios/route.ts` derive the projected absolute via
   `deriveProjected(baseline, delta)` and use the separately-resolved
   climatology only as a fallback when baseline or delta is missing. This
   fixes D1 for the real rasterised Pakistan grid too, not just the synthetic
   countries.
3. **Dev-mode invariant:** `assertProjectionInvariant()` throws when
   `|projected − (baseline + delta)| > 0.05` or when a non-trivial delta is
   reported against an unchanged absolute (the exact D1 signature). Wired into
   the point and scenarios handlers; silent in production so a data hiccup
   degrades rather than 500s.

**Guard/tests:** `tests/synthetic-grid.test.ts` asserts cell-wise
`projected = baseline + delta` within 0.05 for all three synthetic countries;
`tests/derive.test.ts` covers the invariant including the D1 signature.

---

## D2 — Same defect in Compare · **fixed**

**Reproduction:** Compare → Tashkent → 2080–2099 showed `VALUE 10.4 °C` for all
five SSPs while `CHANGE` ranged +2.1 → +4.8.

**Root cause:** [`scenarios/route.ts`](../src/app/api/climate/scenarios/route.ts)
set `value: climatology?.value` — the same independently-generated future
climatology as D1, identical across pathways.

**Fix:** the route now resolves **one** baseline (historical climatology,
1995–2014) for the location and computes each pathway's absolute as
`deriveProjected(baseline, pathwayDelta)`. Five pathways → five distinct
absolutes, each consistent with its own change. Same `assertProjectionInvariant`
guard per pathway.

**Guard/tests:** `tests/synthetic-grid.test.ts` → "five pathways do not share
one absolute".

---

## D3 — Collapsed model spread · **fixed**

**Reproduction:** uncertainty strip read "80% of models between +3.4 °C and
+3.4 °C" while the individual-model list spanned +1.8 → +4.3.

**Root cause:** the generators **ignored the `percentile` argument** when
computing values (and hardcoded `significance = 1`), so `p10 == median == p90`.
The individual-model list is fetched from a different path
(`fetchCckp` per model) which does vary — hence the contradiction on one
screen.

**Fix:**
1. `percentileSpread(medianDelta, indicator)` in `derive.ts` produces a
   deterministic, non-degenerate 10th/90th band from the median using a
   per-family spread model (fraction of signal + absolute floor), so a
   generator asked for `p10` vs `p90` returns coherent, distinct values.
2. Generators apply `deltaAtPercentile()` to the requested percentile and set
   per-cell `significance` to 2 (models disagree on sign) where the band
   straddles zero.
3. **D3 guard:** `isDegenerateSpread(p10, p90)` — if `|p90 − p10| < 0.05`,
   [`models/route.ts`](../src/app/api/climate/models/route.ts) nulls the band,
   sets `spreadAvailable: false`, and `describeSpread` renders *"Model spread
   unavailable at this aggregation."* — never a fake-precise identical range.

**Guard/tests:** `tests/derive.test.ts` (`percentileSpread`,
`isDegenerateSpread`, `deltaAtPercentile` ordering);
`tests/synthetic-grid.test.ts` ("p10 < median < p90 for the anomaly field").

---

## D4 — Wrong country in copy · **partial**

**Root cause:** country names hardcoded in rendered strings and one API path.

**Fixed:**
| Location | Was | Now |
|---|---|---|
| [`models/route.ts`](../src/app/api/climate/models/route.ts) | `geography: "PAK"` for the individual-model list regardless of active country | `query.country ?? detectCountryFromCoords(lat, lon)` |
| [`trajectory/route.ts`](../src/app/api/climate/trajectory/route.ts) | `query.geography === "UZB" ? "Uzbekistan" : "Pakistan"` | `getCountry(query.geography).name` |
| [`compare-panel.tsx`](../src/components/compare-panel.tsx) | "these values describe **Pakistan** as a whole" | `{config.name}` |
| [`climate-story.tsx`](../src/components/climate-story.tsx) | "**Pakistan**-wide rather than local" | `${countryName}` from `place.country` |
| [`interpret.ts`](../src/lib/climate/interpret.ts) `buildNarrative` | "least informative precipitation statistic for **Pakistan**" | `NarrativeInput.countryName`, passed from `story/route.ts` |

**Open (follow-up):** a full `grep` for the four country names across
`.ts`/`.tsx` outside `config/countries.ts` still returns matches in
region-specific *mechanism* prose (`interpret.ts` `MECHANISMS` — e.g. "upper
Indus basin", "lower Indus valley"), `methodology/page.tsx`, `user-guide/`,
`places.ts` place notes, and source-code comments. Some of these are
legitimately region-specific physical content; the rest need a copy sweep
(Phase 4/6). Acceptance criterion 4 is **not yet green**.

---

## D5 — Default coordinate outside the country · **partial**

**Root cause:** [`explorer.tsx`](../src/components/explorer.tsx) never reset the
target coordinate on a country switch and never validated an incoming
coordinate (from URL/localStorage) against the active country's bounding box, so
a coordinate from a previous country — or a stale link — was passed to the point
API as though it were local.

**Fix:** the explorer now, during render (matching the existing compare-panel
idiom):
- resets `lat`/`lon` to the active country's capital on every country switch;
- resets to the capital when an incoming coordinate falls outside
  `isInsideCountryBounds(lat, lon, country)`.

**Open (follow-up):** a coordinate inside a *different* supported country still
resolves there rather than showing an explicit "outside coverage area" state;
the point API only errors when a coordinate is outside *all* four extents. The
dedicated out-of-coverage UI state is Phase 1/3 work.

---

## D6 — Duplicate scenario labels · **fixed**

**Root cause:** [`taxonomy.ts`](../src/lib/climate/taxonomy.ts) `SCENARIOS` gave
`ssp119` and `ssp126` the identical `narrative: "Sustainability — taking the
green road"`, and the UI rendered only `narrative`.

**Fix:** added two fields to every scenario:
- `family` — e.g. `"SSP1 · Sustainability"` (correctly shared by both SSP1
  pathways; never rendered alone);
- `forcingDescriptor` — `"very low forcing · 1.9 W/m²"` vs
  `"low forcing · 2.6 W/m²"` — the distinguishing line to render alongside
  `label`.

**Open (follow-up):** components still need to be switched from `narrative` to
`label` + `forcingDescriptor` (Phase 2 `ScenarioSelector`). SSP swatch colours
also still need to move to the locked perceptual `--ssp-*` ramp (Phase 4).

---

## D7 — Rounding policy · **fixed** (derivation layer); **partial** (render layer)

**Root cause:** the generators rounded **stored** values
(`Number(cellValue.toFixed(precision))`) and `stats.mean` to 2 dp, so different
call sites could disagree by a tenth depending on which stored value they read.

**Fix:**
- Generators no longer round any stored value or stat — full precision is kept
  through the field, the API payload and into the component.
- One render-time policy: `roundForDisplay(value, precision)` in `derive.ts`,
  alongside the existing `formatValue()` in `taxonomy.ts` (which already rounds
  only at format time).

**Open (follow-up):** audit every component that calls `.toFixed()` directly on
a climate value and route it through `formatValue` / `roundForDisplay` so the
policy is genuinely single-source (Phase 2).

---

## D8 — Invented magnitudes in generated fields · **fixed** (found after the original brief)

**Root cause:** Pakistan is served from 1,512 locally rasterised CMIP6 fields —
real data. Uzbekistan, Australia and New Zealand had no raster, so their fields
came from generators carrying **hand-written constants**. Uzbekistan's happened
to be calibrated to the archive; the other two were not:

| | generator | CCKP published | |
|---|---|---|---|
| UZB tas SSP2-4.5 2040–2059 | 1.76 | 1.76 | ✅ |
| AUS tas SSP2-4.5 2040–2059 | 1.48 | **1.27** | ❌ |
| NZL tas SSP2-4.5 2040–2059 | 1.24 | **0.91** | ❌ |

**Fix:**
1. `scripts/fetch-national-anchors.ts` (`pnpm anchors:fetch`) pulls the real
   published values from the CCKP aggregate API — **1,344 / 1,344 resolved**
   across 4 countries × 16 indicators × 5 pathways × 4 horizons, plus the
   1995–2014 baseline climatology — into `data/cckp-national.json`.
2. [`national-anchors.ts`](../src/lib/climate/national-anchors.ts) +
   [`synthetic-field.ts`](../src/lib/climate/synthetic-field.ts): generators now
   supply only a **spatial pattern**. `composeAnchoredField()` shifts or scales
   that pattern so its area mean equals the published national value. Every
   quoted magnitude therefore traces to the archive; only the within-country
   variation is modelled.
3. Point values for those three countries report `spatialScope:
   "interpolated"` with a note, and the readout shows a **ScopeBadge**
   ("Grid cell · 0.25°" vs "Interpolated from national value").
   `/methodology` states it up front and points at `pnpm grid:extract` to
   replace the interpolation with real rasters.

**Guard/tests:** `tests/synthetic-grid.test.ts` asserts each generated field's
area mean equals the published anchor, and that a future absolute's mean equals
`baseline anchor + anomaly anchor`. D1–D3 invariants still hold after anchoring.

---

## D9 — Displayed numbers did not add up · **fixed**

**Reproduction:** the Explore readout showed `+1.5 °C`, baseline `24.5 °C`,
projected `25.9 °C` — visibly inconsistent.

**Root cause:** the true values were 24.45 / 1.46 / 25.91. Each was rounded to
one decimal *independently*, which is individually correct and collectively
wrong on screen. This is the render half of D7.

**Fix:** `coherentDisplay()` in the derivation layer rounds the baseline and the
change from source and derives the **displayed** projected as their sum, so the
panel is always self-consistent. `MetricCard` uses it.

**Guard/tests:** `tests/derive.test.ts` → `coherentDisplay`, including the exact
24.45 / 1.46 case and integer-precision indicators.

---

## Test / check status

| Check | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm build` | succeeds |
| `pnpm test` | 133 passed (10 files) — +44 (`derive`, `synthetic-grid`) |
| `pnpm test:e2e` | spec written (`tests/e2e/demo-path.spec.ts`); browser not installed in this environment |
| `pnpm lint` | 26 problems (9 errors, 17 warnings) — baseline was 27/10; pre-existing `react-hooks` debt in `hooks.ts`, no new errors introduced |

## Live verification (Tashkent, the D1/D2/D3 reproduction)

| | Before | After |
|---|---|---|
| Explore · SSP2-4.5 · 2040–2059 | baseline 10.4, projected **10.4**, change +1.8 | baseline 10.36, projected **12.18**, change +1.82 (10.36 + 1.82 = 12.18 ✓) |
| Compare · 2080–2099 · VALUE across 5 SSPs | **10.4 for all five** | 12.49 / 13.09 / 13.73 / 14.52 / 15.20 |
| Model spread · SSP5-8.5 · 2080–2099 | "+3.4 to +3.4" | p10 +3.5, p90 +6.2 |
