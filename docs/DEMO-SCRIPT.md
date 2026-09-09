# Demo Script — 7 minutes

**Audience:** PhD climate researchers from Pakistan, Uzbekistan, Australia and
New Zealand. **Presenter:** did not build this and does not need to.

**Rule for the presenter:** you can run the entire demo by clicking only the
**"Next →"** card at the foot of each screen. Everything else below is optional
colour.

Open with `?present=1` appended to the URL (projector mode: larger type,
thicker strokes, a step footer). Start at `/`.

---

## 0 · Landing (`/`) — 30 s

> "This is a climate **projection** platform, not a forecast. Four countries,
> one data source — the World Bank's CMIP6 downscaled archive at 25 km. Every
> number on screen traces to a published value or a documented derivation from
> one."

Point at the four country cards. Each shows the projected warming at that
country's capital under SSP2-4.5 by 2040–2059.

Click **Start exploring** (or pick a country card).

---

## 1 · Explore (`/explore`) — 2 min · *"What happens to this place?"*

The screen has three columns: controls, map, readout.

1. **Country** (top-left, one selector). Switch it to **Uzbekistan**. Note the
   map re-frames and the target jumps to **Tashkent** — the capital. The old
   build defaulted to a point in Ladakh, 1,200 km outside the country.
2. **Where** → confirm Tashkent. **Which future** → **SSP2-4.5**, **2040–2059**.
3. Read the **plain sentence** at the top of the readout aloud:
   > "Under SSP2-4.5, Tashkent's average temperature is projected to rise
   > ~1.8 °C by 2040–2059 relative to 1995–2014."
4. The **MetricCard** below it: baseline ~13 °C, projected ~15 °C, change
   +1.8 °C. **Projected is baseline plus change** — computed once, in
   `lib/climate/derive.ts`, with a dev-mode assertion that throws if the three
   numbers ever disagree. (This is defect **D1** in `AUDIT.md`, now fixed.)
5. The **model spread** strip: the 10th–90th percentile of the 30-model
   ensemble, with a tick per model. If the band ever collapses onto the median
   it says *"model spread unavailable at this aggregation"* rather than
   printing an identical range (defect **D3**).

Click **Next →**.

---

## 2 · Compare (`/compare`) — 1 min 30 s · *"How much is uncertain, and why?"*

Same place, carried forward in the URL.

- **Section 1 — pathways.** The five SSPs, same place and horizon. The range
  plot beside the table shows the spread. Each pathway now has a **distinct
  absolute value** — five forcing pathways cannot share one number (defect
  **D2**). The labels distinguish SSP1-1.9 from SSP1-2.6 by forcing descriptor,
  not an identical narrative (defect **D6**).
- **Section 2 — models.** Toggle *Sort by ECS*. n = 30. CanESM5 (ECS 5.6) sits
  at the top of the range; INM-CM4-8 (ECS 1.8) at the bottom — the inline ECS
  bar makes the outliers obvious. These are **national aggregates**, and the
  panel says so.
- **Section 3 — horizon.** The four future windows for the chosen pathway.

Click **Next →**.

---

## 3 · Hotspots (`/hotspots`) — 1 min · *"Where is change most extreme?"*

- A ranked table of every admin-1 region plus small-multiple maps.
- The **ranking criterion** is stated in the header and switchable: absolute
  change, change relative to baseline variability, or exposure.
- Every row links to that region's place profile.

Click a top-ranked row (or **Next →**).

---

## 4 · Place profile (`/places/[id]`) — 1 min 30 s · *"Give me the full dossier."*

- Header: place, admin unit, mono coordinates, elevation, and the live nowcast
  badged **Observed, not projected** — visually separated from all projection
  content.
- **Indicator matrix**: indicators (tas, tasmax, hd35, hd40, pr, rx1day,
  rx5day, cdd, cdd65) × epochs, cells on the diverging ramp. This is the view
  to screenshot.
- **"From climate signal to consequence"**: the mechanism chains — physical
  pathways from a modelled variable toward an impact, without asserting the
  impact's magnitude. The *"what this platform does not attempt"* caveat is a
  distinct callout.
- **Download CSV** for the whole place, all indicators, pathways and epochs.

---

## The four questions a climate scientist will ask

**Q. What downscaling method?**
The World Bank CCKP publishes CMIP6 projections bias-corrected and statistically
downscaled to 0.25° (~25 km) — the NEX-GDDP-CMIP6 lineage (quantile
delta mapping against a GMFD/ERA5 reference). We consume that product as-is; we
do not run our own downscaling. See `/methodology`.

**Q. Why national aggregates for individual models?**
The archive publishes the full 30-member ensemble only as national spatial
aggregates. Gridded fields are published for the ensemble percentiles
(median, 10th, 90th), not per model. So the model-spread *envelope* is local;
the per-model *list* is national. The UI labels which is which. Our synthetic
grids for Uzbekistan, Australia and New Zealand derive per-cell percentile
bands from the ensemble-median field plus a per-family spread model — this is
disclosed as synthetic in `/methodology`.

**Q. How are the models weighted?**
They are not. The ensemble median and percentiles are unweighted across the
CMIP6 members the archive includes. We do not apply model democracy vs.
performance weighting; ECS is shown in the model table so a reviewer can see
where each member sits.

**Q. What bias correction is applied?**
Whatever the CCKP product carries — trend-preserving quantile mapping against
the reference observational dataset, applied upstream by the World Bank. We add
none. Absolutes are therefore bias-corrected model output, not station data;
the baseline period is 1995–2014.

---

## Pre-demo checklist

Run through this within the hour before the meeting:

- [ ] `pnpm build` completes with no errors
- [ ] `pnpm test` — all green (includes the projected = baseline + delta and
      degenerate-spread guards)
- [ ] `pnpm exec playwright test` — the four-country smoke path passes
- [ ] Open `/` — all four country cards show a number, none show "—"
- [ ] `/explore` for each of the four countries: no `NaN`, no `undefined`, the
      default coordinate is inside the country
- [ ] Switch country on `/explore` — target resets to the capital
- [ ] `?tour=1` runs start to finish; then clear it:
      `localStorage.removeItem('climate_tour_done')` is offered under the "⋯"
      header menu → "Restart guided tour"
- [ ] `?present=1` — larger type, step footer visible
- [ ] Network throttled to Fast 3G — panels degrade to skeletons/among cached
      values, never blank
