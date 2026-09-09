# Visual system

Single source of truth: [`src/styles/tokens.css`](../src/styles/tokens.css),
wired into the Tailwind theme in [`src/app/globals.css`](../src/app/globals.css).
No component introduces a raw hex value, an ad-hoc pixel size, or a one-off
shadow — if a value is needed and not in `tokens.css`, add it there first.

## Type

| Role | Family | Notes |
|---|---|---|
| UI + headings | Inter Tight (`--font-ui`) | tight tracking on headings |
| All numerals, coords, model IDs, scenario codes | JetBrains Mono (`--font-code`) | `.tnum` / `[data-numeric]` → tabular-nums |

Scale (`--fs-*`, also `text-2xs … text-3xl`): **12 / 13 / 14 / 16 / 20 / 28 / 40 / 56**. Nothing between.

## Colour

- Ten-step cool neutral ramp `--n-0 … --n-900`.
- **One** institutional accent, `--accent-500/600/700` (deep blue). Green-as-everything is retired.
- **Scenario colours are data** — the IPCC AR6 WG1 official SSP palette, published as `--ssp-119 … --ssp-585`. Read them through `scenarioColorVar()` ([`lib/climate/scenario-style.ts`](../src/lib/climate/scenario-style.ts)); never override locally.
- Map ramps: `--ramp-div-*` (diverging blue↔red about zero) for anomalies; `--ramp-seq-*` (sequential) for absolutes.

## Elevation — three tiers, light from top-left

| Token / class | Use |
|---|---|
| `--elevation-recessed` / `.tier-recessed` | inset wells, data wells, inputs |
| `--elevation-flat` / `.tier-flat` | the default — a 1px hairline, no shadow |
| `--elevation-raised` / `.tier-raised` | cards that must lift (the MetricCard); two-stop shadow + 1px top highlight |
| `--elevation-overlay` / `.tier-overlay` | menus, popovers, coach-marks, map HUD |

**Forbidden:** WebGL globes, rotating/3D charts, extruded bars, isometric
illustration, skeuomorphic bevels, glassmorphism blur stacks. Depth serves
hierarchy — the eye lands on the number first, the chart second, chrome last.

## Radius / spacing / motion

- Radius: `--radius-control` 4px, `--radius-container` 8px, `--radius-overlay` 12px. Pills only for genuine tags.
- Spacing: 4px lattice (`--space-*`).
- Motion: `--dur-state` 120ms, `--dur-panel` 200ms, one curve `--ease`. Pair with `.motion-state` / `.motion-panel`. `prefers-reduced-motion` honoured.

## The eight properties (Section 4.1) — where each is enforced

1. **User-friendly** — Explore shows ≤6 controls; Display mode + GCM model behind an Advanced disclosure. Landing → readout in 3 clicks.
2. **Professional** — no decorative illustration, no emoji in chrome, one accent.
3. **Dimensional** — the three-tier elevation model above; basemap desaturated so the data ramp is the only saturated layer.
4. **Attractive** — one focal point per screen: the primary metric, large, mono.
5. **Modern** — hairline borders, tabular mono numerals, sub-200ms motion.
6. **Elegant** — strict type scale, 4px lattice, two font families.
7. **Consistent** — the token layer; scenario colour/label/forcing from one config.
8. **Simple** — every panel answers "what am I looking at?" under its title; depth on demand via disclosures.

## Component library

`src/components/ui/` — `MetricCard`, `ScenarioSelector`, `UncertaintyStrip`,
`DataProvenanceFooter` (+ `toCsv`), `EmptyState` / `ErrorState` /
`SkeletonLoader` / `SkeletonBlock`. Navigation: `src/components/nav/` —
`CountrySelect`, `ProgressRail`, `NextStepCard`.
