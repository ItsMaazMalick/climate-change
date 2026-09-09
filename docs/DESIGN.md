# Visual system

Single source of truth: [`src/styles/tokens.css`](../src/styles/tokens.css),
wired into the Tailwind theme in [`src/app/globals.css`](../src/app/globals.css).
No component introduces a raw hex value, an ad-hoc pixel size, or a one-off
shadow — if a value is needed and not in `tokens.css`, add it there first.

## Type

| Role | Family | Notes |
|---|---|---|
| UI + headings | **DM Sans** (`--font-ui`) — the ESS brand face | tight tracking on headings |
| All numerals, coords, model IDs, scenario codes | JetBrains Mono (`--font-code`) | `.tnum` / `[data-numeric]` → tabular-nums |

Scale (`--fs-*`, also `text-2xs … text-3xl`): **12 / 13 / 14 / 16 / 20 / 28 / 40 / 56**. Nothing between.

## Colour — the official ESS brand

Lifted from the ESS Elementor global kit at escan-systems.com and mirrored in `tokens.css`:

| Token | Hex | Role |
|---|---|---|
| `--ess-primary` / `--forest-600` | `#334B35` | deep forest green — primary buttons, headings ink, map chrome |
| `--ess-accent` / `--leaf-500` | `#8DC63F` | leaf green — highlights, active states, glow, `.btn-leaf` |
| `--ess-secondary` / `--earth-500` | `#8B5E3C` | earth brown — used sparingly |
| `--ess-text` / `--n-500` | `#687469` | sage grey-green — muted text |
| `--ess-cream` / `--n-50` | `#F6F4EC` | recessed surfaces |
| `--ess-beige` / `--n-100` | `#ECEAE0` | active surfaces |
| `--ess-sage` / `--n-300` | `#B3C5B5` | strong borders |

Two ramps derive from these: `--forest-900…400` (dark end, used for `.section-deep` heroes) and `--leaf-50…700` (bright end). The neutral ramp is warm sage, not cool grey, so white panels read against a brand-tinted ground.

**Scenario colours stay IPCC AR6** — `--ssp-119 … --ssp-585` — read only through `scenarioColorVar()`. Map ramps stay ColorBrewer diverging for anomalies; the sequential ramp is brand green.

## Elevation — three tiers, light from top-left

| Token / class | Use |
|---|---|
| `--elevation-recessed` / `.tier-recessed` | inset wells, data wells, inputs |
| `--elevation-flat` / `.tier-flat` | the default — a 1px hairline, no shadow |
| `--elevation-raised` / `.tier-raised` | cards that must lift; five-stop forest-tinted shadow + 1px top highlight + `--raise-sheen` gradient |
| `.tier-raised-seam` | raised + a scenario/status accent seam and a light-catching gradient border; blooms on hover |
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

`src/components/ui/` — `MetricCard`, `ScenarioSelector`, `UncertaintyStrip`, `PathwayBars`, `PageHeader`,
`DataProvenanceFooter` (+ `toCsv`), `EmptyState` / `ErrorState` /
`SkeletonLoader` / `SkeletonBlock`. Navigation: `src/components/nav/` —
`CountrySelect`, `ProgressRail`, `NextStepCard`.

## Buttons

`.btn` + one of `.btn-primary` (forest gradient, leaf glow), `.btn-leaf` (bright leaf, dark ink), `.btn-dark`, `.btn-secondary`.

## Enforcement

Zero hardcoded Tailwind palette classes (`slate-*`, `emerald-*`, `rose-*`, …) remain in `src/`. Verify with:

```sh
grep -rnE '\b(text|bg|border|ring|divide|from|to|via)-(slate|gray|zinc|neutral|stone|emerald|green|teal|cyan|sky|blue|indigo|violet|purple|pink|rose|red|orange|amber|yellow|lime)-[0-9]' src --include=*.tsx --include=*.ts
```
