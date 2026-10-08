/**
 * Every static (i.e. not derived from live NOAA data) piece of English UI
 * copy on the `/iofs` page, gathered in one place so `scripts/warm-iofs-
 * translations.ts` can translate all of it into every supported language
 * ahead of time, instead of each string being discovered — and translated
 * live, one request at a time — only when a real visitor's browser happens
 * to render it.
 *
 * This is a manifest, not a source of truth the UI reads from directly: the
 * components still carry the real English copy inline (via `<T>`), and nothing
 * here is imported at render time. Keep it in sync by hand when adding new
 * static copy to a component — anything missed simply falls through to the
 * page's existing live-translation path (see `translation-context.tsx`)
 * instead of breaking.
 */
export const STATIC_STRINGS: readonly string[] = [
  // Page header
  "El Niño, Super El Niño & Climate Change Across IOFS Member States",
  "Explore today's live ENSO conditions, compare them with past Super El Niño events, and discover each IOFS Member State's CMIP6 climate projections from 1950 to 2099",

  // Section titles/subtitles
  "Current ENSO Status",
  "Live from NOAA's Climate Prediction Center",
  "How exceptional is the current event?",
  "Compared with the strongest El Niño episodes since 1950, aligned by RONI",
  "Projected warming across the IOFS",
  "All four emissions pathways, 1995–2014 baseline through 2080–2099 — ensemble median, World Bank CCKP",
  "Climate Trajectory of Each IOFS Member State, 1950–2099",
  "Pick any IOFS member state and emissions pathway",

  // Section 1 — "Super El Niño" disclaimer
  "“Super El Niño” is an informal term for exceptionally strong El Niño events. NOAA CPC’s own formal name for this highest category is “very strong.”",

  // Scenario cards
  "Change relative to",

  // Country trajectory — confidence note + updated CMIP6/national-aggregate citation
  "Confidence varies by variable and region: temperature projections are generally more robust than regional precipitation projections, especially for monsoon-affected areas.",
  "World Bank Climate Change Knowledge Portal — national aggregate from the CMIP6 (0.25°) archive, ensemble median. The shared line before 2015 is the observed/reanalysis historical run; each pathway diverges from it after that, exactly as published by the archive — nothing here is interpolated between the two.",

  // Error/empty states
  "Couldn't load the member ranking",
  "Couldn't load this country's projection",
  "No ENSO history available.",

  // Section 1 — live ENSO status
  "Click a country on the map or in the table to open its full trajectory below.",
  "Live ENSO status · Niño 3.4 region",
  "Super El Niño",
  "Strong El Niño",
  "Weak El Niño",
  "Moderate El Niño",
  "Super La Niña",
  "Strong La Niña",
  "Weak La Niña",
  "Moderate La Niña",
  "No reading",
  "ENSO-neutral",
  "As of",
  "Niño 3.4 anomaly",
  "observed",
  "CPC alert",
  "source",
  "Near-real-time sea-surface temperature, NASA GIBS (GHRSST L4 MUR). The dashed box marks the Niño 3.4 region — the primary ENSO monitoring zone the RONI index above is computed from.",
  "Relative Oceanic Niño Index, 1950 → present",
  "Source",
  "RONI ≥ +0.5 °C marks an El Niño season, ≤ −0.5 °C a La Niña season. RONI adjusts the classic Niño 3.4 anomaly for the global warming trend, so a season is compared against the climate of its own time rather than a fixed 1991–2020 baseline.",
  "Where is El Niño heading? 9-season probability outlook",
  "The written forecast still has it — see the",
  "IRI/CPC outlook page",
  "directly rather than a guessed number here.",

  // ENSO history chart
  "5 Years",
  "20 Years",
  "Full Record",
  "RONI (relative ENSO index)",
  "Niño 3.4 SST anomaly",
  "RONI",
  "Current",

  // ENSO outlook chart
  "El Niño probability",
  "As stated by the source for that season",
  "Remainder",
  "Neutral / La Niña — not separately broken out in the source text",

  // Episode comparator
  "Current episode vs. a past one, aligned by month since onset",
  "peak",
  "El Niño onset",
  "months →",
  "Month",
  "ongoing, still being measured",
  "historical, peaked at",
  "Each line is RONI (El Niño strength) by month since that episode's own onset — the real series, just re-anchored to a shared starting point instead of the calendar, so two events of different vintage (one from the past, one happening now) line up for comparison.",
  "This line stops where the real data stops so far — it is not yet known whether the current event will keep climbing, flatten, or fall like the comparison episode did.",

  // Episode ranking
  "Strongest El Niño episodes on record, by peak RONI",
  "now",
  "Weak",
  "Moderate",
  "Strong",
  "Super",
  "Computed from the RONI series itself: each row is the peak value of a run of consecutive seasons past the ±0.5 °C threshold, not a hand-typed table.",

  // Ranking table / map
  "Country",
  "Warming trajectory",
  "today",
  "warming",
  "Baseline",

  // Pacific SST map
  "SST Anomaly",
  "Sea Surface Temp",
  "SST Anomaly (°C)",
  "Sea Surface Temp (°C)",
  "NASA GIBS imagery is slow to respond right now — the basemap is still live, only the temperature overlay is affected.",
  "Niño 3.4 region",
  "primary ENSO monitoring zone",

  // Country trajectory
  "Climate change, 1950 → 2099",
  "Indicator",
  "Horizon for the cards below",
  "Annual trajectory under each pathway",

  // Member select
  "IOFS member country",

  // Info dialog
  "Takeaway",

  // Headline scenario summaries (SCENARIOS in lib/climate/taxonomy.ts), shown
  // in each trajectory card's expanded info panel.
  "Strong, sustained mitigation with net-zero CO₂ in the second half of the century. Broadly the successor to RCP2.6 and roughly aligned with the upper end of the Paris goals.",
  "Development follows historical patterns; emissions stay near current levels to mid-century then decline. Often treated as the closest analogue to stated national policies.",
  "Resurgent nationalism, weak international cooperation and slow technological change. Emissions roughly double by 2100. High aerosol and land-use forcing.",
  "Rapid, energy-intensive growth built on abundant fossil fuels. The high end of the CMIP6 range; now widely regarded as a low-likelihood upper bound rather than business as usual.",

  // IOFS regions (lib/iofs/members.ts' IofsRegion), used as <optgroup> labels
  // and on the member map/legend.
  "Central & South Asia",
  "Middle East & Gulf",
  "North Africa",
  "Sub-Saharan Africa",
  "Americas",
];
