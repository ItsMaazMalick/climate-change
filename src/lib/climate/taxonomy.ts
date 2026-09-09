/**
 * The vocabulary of the platform.
 *
 * Every query in the system is a point in the same eight-dimensional space:
 *
 *   location → dataset → model → scenario → period → variable → statistic → value
 *
 * This module defines the legal values on each axis and the human-facing
 * language wrapped around them. It is the single source of truth shared by the
 * API layer, the store implementations, and the UI.
 */

import type { CountryCode } from "./countries";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

/**
 * A dataset is a distinct scientific product. They are deliberately kept
 * apart: a weather forecast, an observational reanalysis, and a climate
 * projection answer different questions and must never be averaged together
 * or presented as one "forecast" number.
 */
export type DatasetKind = "projection" | "observation" | "forecast";

export interface Dataset {
  id: string;
  kind: DatasetKind;
  label: string;
  /** What question this dataset can legitimately answer. */
  answers: string;
  provider: string;
  resolution: string;
  temporalRange: string;
  citation: string;
  url: string;
}

export const DATASETS = {
  "cmip6-x0.25": {
    id: "cmip6-x0.25",
    kind: "projection",
    label: "CMIP6 (downscaled, 0.25°)",
    answers:
      "How could the climate of a place change over multi-decade windows under a given emissions pathway?",
    provider: "World Bank Climate Change Knowledge Portal",
    resolution: "0.25° × 0.25° (~25 km)",
    temporalRange: "1950–2100",
    citation:
      "World Bank Group, Climate Change Knowledge Portal — CMIP6 bias-corrected downscaled projections (0.25°).",
    url: "https://climateknowledgeportal.worldbank.org/",
  },
  "era5-x0.25": {
    id: "era5-x0.25",
    kind: "observation",
    label: "ERA5 reanalysis (0.25°)",
    answers: "What has the climate of a place actually been?",
    provider: "ECMWF, via World Bank CCKP",
    resolution: "0.25° × 0.25°",
    temporalRange: "1950–present",
    citation: "Hersbach et al. (2020), ERA5 global reanalysis, ECMWF.",
    url: "https://climateknowledgeportal.worldbank.org/",
  },
  "open-meteo": {
    id: "open-meteo",
    kind: "forecast",
    label: "Open-Meteo forecast",
    answers: "What will the weather do over the next few days?",
    provider: "Open-Meteo",
    resolution: "~1–11 km, model dependent",
    temporalRange: "now + 16 days",
    citation: "Open-Meteo.com weather API.",
    url: "https://open-meteo.com/",
  },
} as const satisfies Record<string, Dataset>;

export type DatasetId = keyof typeof DATASETS;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export type ScenarioId =
  | "historical"
  | "ssp119"
  | "ssp126"
  | "ssp245"
  | "ssp370"
  | "ssp585";

export interface Scenario {
  id: ScenarioId;
  /** Display form, e.g. "SSP2-4.5". */
  label: string;
  shortLabel: string;
  /** Radiative forcing in W/m² at 2100; null for the historical run. */
  forcing: number | null;
  /** The shared socio-economic narrative behind the pathway. */
  narrative: string;
  /**
   * SSP family label, e.g. "SSP1 · Sustainability". Shared by the two SSP1
   * pathways — which is correct; they are the same storyline at two forcing
   * levels — so it is never rendered alone (D6).
   */
  family: string;
  /**
   * The forcing level in words plus W/m². This is what distinguishes
   * SSP1-1.9 from SSP1-2.6 on screen; render it alongside `label`, never the
   * bare `narrative` (D6).
   */
  forcingDescriptor: string;
  summary: string;
  /** Likely global warming range at 2081–2100 vs 1850–1900, per IPCC AR6 WG1. */
  globalWarming2100: string | null;
  /** Ordering weight, low to high forcing. */
  rank: number;
  color: string;
}

export const SCENARIOS = {
  historical: {
    id: "historical",
    label: "Historical",
    shortLabel: "Historical",
    forcing: null,
    narrative: "Observed forcing",
    family: "Historical",
    forcingDescriptor: "observed forcing",
    summary:
      "Models driven by observed greenhouse gases, aerosols, land use and solar/volcanic forcing. This is the reference the projections are measured against, not a prediction.",
    globalWarming2100: null,
    rank: 0,
    color: "#6b7280",
  },
  ssp119: {
    id: "ssp119",
    label: "SSP1-1.9",
    shortLabel: "Very low",
    forcing: 1.9,
    narrative: "Sustainability — taking the green road",
    family: "SSP1 · Sustainability",
    forcingDescriptor: "very low forcing · 1.9 W/m²",
    summary:
      "The most ambitious pathway in CMIP6. Net-zero CO₂ around 2050, deep and immediate cuts across all sectors. Roughly consistent with holding warming near 1.5 °C.",
    globalWarming2100: "1.0–1.8 °C",
    rank: 1,
    color: "#0e7490",
  },
  ssp126: {
    id: "ssp126",
    label: "SSP1-2.6",
    shortLabel: "Low",
    forcing: 2.6,
    narrative: "Sustainability — taking the green road",
    family: "SSP1 · Sustainability",
    forcingDescriptor: "low forcing · 2.6 W/m²",
    summary:
      "Strong, sustained mitigation with net-zero CO₂ in the second half of the century. Broadly the successor to RCP2.6 and roughly aligned with the upper end of the Paris goals.",
    globalWarming2100: "1.3–2.4 °C",
    rank: 2,
    color: "#15803d",
  },
  ssp245: {
    id: "ssp245",
    label: "SSP2-4.5",
    shortLabel: "Intermediate",
    forcing: 4.5,
    narrative: "Middle of the road",
    family: "SSP2 · Middle of the road",
    forcingDescriptor: "intermediate forcing · 4.5 W/m²",
    summary:
      "Development follows historical patterns; emissions stay near current levels to mid-century then decline. Often treated as the closest analogue to stated national policies.",
    globalWarming2100: "2.1–3.5 °C",
    rank: 3,
    color: "#b45309",
  },
  ssp370: {
    id: "ssp370",
    label: "SSP3-7.0",
    shortLabel: "High",
    forcing: 7.0,
    narrative: "Regional rivalry — a rocky road",
    family: "SSP3 · Regional rivalry",
    forcingDescriptor: "high forcing · 7.0 W/m²",
    summary:
      "Resurgent nationalism, weak international cooperation and slow technological change. Emissions roughly double by 2100. High aerosol and land-use forcing.",
    globalWarming2100: "2.8–4.6 °C",
    rank: 4,
    color: "#c2410c",
  },
  ssp585: {
    id: "ssp585",
    label: "SSP5-8.5",
    shortLabel: "Very high",
    forcing: 8.5,
    narrative: "Fossil-fuelled development — taking the highway",
    family: "SSP5 · Fossil-fuelled development",
    forcingDescriptor: "very high forcing · 8.5 W/m²",
    summary:
      "Rapid, energy-intensive growth built on abundant fossil fuels. The high end of the CMIP6 range; now widely regarded as a low-likelihood upper bound rather than business as usual.",
    globalWarming2100: "3.3–5.7 °C",
    rank: 5,
    color: "#991b1b",
  },
} as const satisfies Record<ScenarioId, Scenario>;

/** SSPs, ordered by forcing. The historical run is excluded. */
export const SSP_IDS = [
  "ssp119",
  "ssp126",
  "ssp245",
  "ssp370",
  "ssp585",
] as const satisfies readonly ScenarioId[];

/**
 * The four scenarios shown by default. SSP1-1.9 is published for a narrower
 * set of indicators upstream, so it is opt-in rather than a default column.
 */
export const HEADLINE_SCENARIO_IDS = [
  "ssp126",
  "ssp245",
  "ssp370",
  "ssp585",
] as const satisfies readonly ScenarioId[];

// ---------------------------------------------------------------------------
// CMIP5 / RCP — retained for the education layer and cross-generation compares
// ---------------------------------------------------------------------------

export interface LegacyScenario {
  id: string;
  label: string;
  forcing: number;
  summary: string;
  /** Nearest SSP counterpart by end-of-century forcing. */
  ssp: ScenarioId | null;
}

export const RCP_SCENARIOS: LegacyScenario[] = [
  {
    id: "rcp26",
    label: "RCP2.6",
    forcing: 2.6,
    summary: "Peak-and-decline pathway with substantial negative emissions.",
    ssp: "ssp126",
  },
  {
    id: "rcp45",
    label: "RCP4.5",
    forcing: 4.5,
    summary: "Stabilisation without overshoot by 2100.",
    ssp: "ssp245",
  },
  {
    id: "rcp60",
    label: "RCP6.0",
    forcing: 6.0,
    summary: "Stabilisation reached after 2100.",
    ssp: null,
  },
  {
    id: "rcp85",
    label: "RCP8.5",
    forcing: 8.5,
    summary: "Rising radiative forcing throughout the century.",
    ssp: "ssp585",
  },
];

/**
 * RCPs and SSPs are *not* interchangeable. An RCP is a forcing trajectory
 * alone; an SSP pairs that trajectory with a socio-economic storyline that
 * also determines aerosols and land use. Matching forcing levels can still
 * produce different regional climates.
 */
export const SCENARIO_GENERATIONS = {
  cmip5: {
    id: "cmip5",
    label: "CMIP5",
    era: "2010–2014",
    scenarioFamily: "RCP",
    scenarios: RCP_SCENARIOS.map((s) => s.label),
    ipccReport: "IPCC AR5 (2013/14)",
    note: "Forcing pathways only — no socio-economic narrative attached.",
  },
  cmip6: {
    id: "cmip6",
    label: "CMIP6",
    era: "2016–2021",
    scenarioFamily: "SSP",
    scenarios: SSP_IDS.map((id) => SCENARIOS[id].label),
    ipccReport: "IPCC AR6 (2021/22)",
    note: "Forcing pathway combined with a socio-economic storyline that also sets aerosol and land-use forcing.",
  },
} as const;

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export type PeriodId =
  | "1995-2014"
  | "2020-2039"
  | "2040-2059"
  | "2060-2079"
  | "2080-2099";

export interface Period {
  id: PeriodId;
  label: string;
  shortLabel: string;
  startYear: number;
  endYear: number;
  midpoint: number;
  isBaseline: boolean;
}

const period = (id: PeriodId, label: string, shortLabel: string): Period => {
  const [start, end] = id.split("-").map(Number) as [number, number];
  return {
    id,
    label,
    shortLabel,
    startYear: start,
    endYear: end,
    midpoint: Math.round((start + end) / 2),
    isBaseline: id === "1995-2014",
  };
};

export const PERIODS = {
  "1995-2014": period("1995-2014", "Historical baseline", "1995–2014"),
  "2020-2039": period("2020-2039", "Near future", "2020–2039"),
  "2040-2059": period("2040-2059", "Mid century", "2040–2059"),
  "2060-2079": period("2060-2079", "Late century", "2060–2079"),
  "2080-2099": period("2080-2099", "End of century", "2080–2099"),
} as const satisfies Record<PeriodId, Period>;

export const BASELINE_PERIOD: PeriodId = "1995-2014";

export const FUTURE_PERIOD_IDS = [
  "2020-2039",
  "2040-2059",
  "2060-2079",
  "2080-2099",
] as const satisfies readonly PeriodId[];

export const PERIOD_IDS = [
  BASELINE_PERIOD,
  ...FUTURE_PERIOD_IDS,
] as const satisfies readonly PeriodId[];

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const ENSEMBLE_ID = "ensemble-all";

export interface ClimateModel {
  id: string;
  label: string;
  institution: string;
  country: string;
  /** Equilibrium climate sensitivity, °C per doubling of CO₂ (CMIP6 values). */
  ecs: number | null;
  isEnsemble: boolean;
}

/**
 * The 30 GCM realisations the World Bank downscales, plus the ensemble.
 * ECS values are from Meehl et al. (2020) and the IPCC AR6 WG1 Chapter 7
 * assessment tables; a few models are not covered there and carry `null`.
 */
export const MODELS = {
  "ensemble-all": {
    id: "ensemble-all",
    label: "Multi-model ensemble",
    institution: "All 30 downscaled realisations",
    country: "—",
    ecs: null,
    isEnsemble: true,
  },
  "access-cm2-r1i1p1f1": { id: "access-cm2-r1i1p1f1", label: "ACCESS-CM2", institution: "CSIRO-ARCCSS", country: "Australia", ecs: 4.7, isEnsemble: false },
  "access-esm1-5-r1i1p1f1": { id: "access-esm1-5-r1i1p1f1", label: "ACCESS-ESM1-5", institution: "CSIRO", country: "Australia", ecs: 3.9, isEnsemble: false },
  "bcc-csm2-mr-r1i1p1f1": { id: "bcc-csm2-mr-r1i1p1f1", label: "BCC-CSM2-MR", institution: "Beijing Climate Center", country: "China", ecs: 3.0, isEnsemble: false },
  "canesm5-r1i1p1f1": { id: "canesm5-r1i1p1f1", label: "CanESM5", institution: "CCCma", country: "Canada", ecs: 5.6, isEnsemble: false },
  "cmcc-esm2-r1i1p1f1": { id: "cmcc-esm2-r1i1p1f1", label: "CMCC-ESM2", institution: "CMCC", country: "Italy", ecs: 3.6, isEnsemble: false },
  "cnrm-cm6-1-r1i1p1f2": { id: "cnrm-cm6-1-r1i1p1f2", label: "CNRM-CM6-1", institution: "CNRM-CERFACS", country: "France", ecs: 4.9, isEnsemble: false },
  "cnrm-esm2-1-r1i1p1f2": { id: "cnrm-esm2-1-r1i1p1f2", label: "CNRM-ESM2-1", institution: "CNRM-CERFACS", country: "France", ecs: 4.8, isEnsemble: false },
  "ec-earth3-r1i1p1f1": { id: "ec-earth3-r1i1p1f1", label: "EC-Earth3", institution: "EC-Earth Consortium", country: "Europe", ecs: 4.3, isEnsemble: false },
  "ec-earth3-veg-lr-r1i1p1f1": { id: "ec-earth3-veg-lr-r1i1p1f1", label: "EC-Earth3-Veg-LR", institution: "EC-Earth Consortium", country: "Europe", ecs: 4.3, isEnsemble: false },
  "fgoals-g3-r3i1p1f1": { id: "fgoals-g3-r3i1p1f1", label: "FGOALS-g3", institution: "CAS", country: "China", ecs: 2.9, isEnsemble: false },
  "gfdl-cm4-r1i1p1f1": { id: "gfdl-cm4-r1i1p1f1", label: "GFDL-CM4", institution: "NOAA GFDL", country: "United States", ecs: 3.9, isEnsemble: false },
  "gfdl-esm4-r1i1p1f1": { id: "gfdl-esm4-r1i1p1f1", label: "GFDL-ESM4", institution: "NOAA GFDL", country: "United States", ecs: 2.6, isEnsemble: false },
  "giss-e2-1-g-r1i1p1f2": { id: "giss-e2-1-g-r1i1p1f2", label: "GISS-E2-1-G", institution: "NASA GISS", country: "United States", ecs: 2.7, isEnsemble: false },
  "hadgem3-gc31-ll-r1i1p1f3": { id: "hadgem3-gc31-ll-r1i1p1f3", label: "HadGEM3-GC31-LL", institution: "Met Office Hadley Centre", country: "United Kingdom", ecs: 5.6, isEnsemble: false },
  "hadgem3-gc31-mm-r1i1p1f3": { id: "hadgem3-gc31-mm-r1i1p1f3", label: "HadGEM3-GC31-MM", institution: "Met Office Hadley Centre", country: "United Kingdom", ecs: 5.4, isEnsemble: false },
  "inm-cm4-8-r1i1p1f1": { id: "inm-cm4-8-r1i1p1f1", label: "INM-CM4-8", institution: "INM RAS", country: "Russia", ecs: 1.8, isEnsemble: false },
  "inm-cm5-0-r1i1p1f1": { id: "inm-cm5-0-r1i1p1f1", label: "INM-CM5-0", institution: "INM RAS", country: "Russia", ecs: 1.9, isEnsemble: false },
  "ipsl-cm6a-lr-r1i1p1f1": { id: "ipsl-cm6a-lr-r1i1p1f1", label: "IPSL-CM6A-LR", institution: "IPSL", country: "France", ecs: 4.6, isEnsemble: false },
  "kace-1-0-g-r1i1p1f1": { id: "kace-1-0-g-r1i1p1f1", label: "KACE-1-0-G", institution: "NIMS-KMA", country: "South Korea", ecs: 4.5, isEnsemble: false },
  "kiost-esm-r1i1p1f1": { id: "kiost-esm-r1i1p1f1", label: "KIOST-ESM", institution: "KIOST", country: "South Korea", ecs: 3.4, isEnsemble: false },
  "miroc6-r1i1p1f1": { id: "miroc6-r1i1p1f1", label: "MIROC6", institution: "MIROC Consortium", country: "Japan", ecs: 2.6, isEnsemble: false },
  "miroc-es2l-r1i1p1f2": { id: "miroc-es2l-r1i1p1f2", label: "MIROC-ES2L", institution: "MIROC Consortium", country: "Japan", ecs: 2.7, isEnsemble: false },
  "mpi-esm1-2-hr-r1i1p1f1": { id: "mpi-esm1-2-hr-r1i1p1f1", label: "MPI-ESM1-2-HR", institution: "MPI-M / DWD / DKRZ", country: "Germany", ecs: 3.0, isEnsemble: false },
  "mpi-esm1-2-lr-r1i1p1f1": { id: "mpi-esm1-2-lr-r1i1p1f1", label: "MPI-ESM1-2-LR", institution: "MPI-M", country: "Germany", ecs: 3.0, isEnsemble: false },
  "mri-esm2-0-r1i1p1f1": { id: "mri-esm2-0-r1i1p1f1", label: "MRI-ESM2-0", institution: "MRI", country: "Japan", ecs: 3.2, isEnsemble: false },
  "nesm3-r1i1p1f1": { id: "nesm3-r1i1p1f1", label: "NESM3", institution: "NUIST", country: "China", ecs: 4.7, isEnsemble: false },
  "noresm2-lm-r1i1p1f1": { id: "noresm2-lm-r1i1p1f1", label: "NorESM2-LM", institution: "NCC", country: "Norway", ecs: 2.5, isEnsemble: false },
  "noresm2-mm-r1i1p1f1": { id: "noresm2-mm-r1i1p1f1", label: "NorESM2-MM", institution: "NCC", country: "Norway", ecs: 2.5, isEnsemble: false },
  "taiesm1-r1i1p1f1": { id: "taiesm1-r1i1p1f1", label: "TaiESM1", institution: "AS-RCEC", country: "Taiwan", ecs: 4.3, isEnsemble: false },
  "ukesm1-0-ll-r1i1p1f2": { id: "ukesm1-0-ll-r1i1p1f2", label: "UKESM1-0-LL", institution: "MOHC / NERC", country: "United Kingdom", ecs: 5.3, isEnsemble: false },
} as const satisfies Record<string, ClimateModel>;

export type ModelId = keyof typeof MODELS;

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export const INDIVIDUAL_MODEL_IDS = MODEL_IDS.filter((id) => id !== ENSEMBLE_ID);

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * For the ensemble these are percentiles *across models*; `median` is the
 * central estimate and `p10`/`p90` bound the model spread. An individual
 * model carries only `mean`, because a cross-model percentile of one model
 * is not a meaningful quantity.
 */
export type PercentileId = "mean" | "median" | "p10" | "p90";

export const PERCENTILES: Record<PercentileId, { id: PercentileId; label: string; description: string }> = {
  mean: { id: "mean", label: "Mean", description: "Arithmetic mean over the period." },
  median: { id: "median", label: "Median", description: "50th percentile across models — the central estimate." },
  p10: { id: "p10", label: "10th percentile", description: "Only 10% of models project a value this low or lower." },
  p90: { id: "p90", label: "90th percentile", description: "Only 10% of models project a value this high or higher." },
};

export const ENSEMBLE_PERCENTILES: PercentileId[] = ["median", "p10", "p90"];

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * `climatology` is the absolute value over a period. `anomaly` is that value
 * minus the 1995–2014 baseline — the *change signal*, which is the quantity
 * models agree on far better than absolutes. `timeseries` is a year-by-year
 * trace.
 */
export type ProductId = "climatology" | "anomaly" | "timeseries";

export type AggregationId = "annual" | "seasonal" | "monthly";

export const SEASONS = [
  { id: "DJF", label: "Winter (Dec–Feb)", month: 1 },
  { id: "MAM", label: "Spring (Mar–May)", month: 4 },
  { id: "JJA", label: "Monsoon (Jun–Aug)", month: 7 },
  { id: "SON", label: "Autumn (Sep–Nov)", month: 10 },
] as const;

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// ---------------------------------------------------------------------------
// Variables and indicators
// ---------------------------------------------------------------------------

export type IndicatorFamily =
  | "temperature"
  | "heat"
  | "precipitation"
  | "flood"
  | "drought"
  | "cryosphere"
  | "agriculture"
  | "energy"
  | "humidity"
  | "wind";

export interface IndicatorFamilyMeta {
  id: IndicatorFamily;
  label: string;
  description: string;
  color: string;
}

export const INDICATOR_FAMILIES: Record<IndicatorFamily, IndicatorFamilyMeta> = {
  temperature: { id: "temperature", label: "Temperature", description: "Mean and extreme air temperature.", color: "#c2410c" },
  heat: { id: "heat", label: "Heat & heat stress", description: "Threshold exceedances, warm spells and humid-heat stress.", color: "#c2410c" },
  precipitation: { id: "precipitation", label: "Precipitation", description: "How much rain falls, and when.", color: "#1d4ed8" },
  flood: { id: "flood", label: "Heavy rainfall", description: "Rainfall intensity and extremes — inputs to flood hazard, not flood risk itself.", color: "#4338ca" },
  drought: { id: "drought", label: "Dryness & drought", description: "Dry-spell length and moisture balance.", color: "#854d0e" },
  cryosphere: { id: "cryosphere", label: "Snow & cold", description: "Snowpack, frost and ice — the Indus headwaters story.", color: "#0e7490" },
  agriculture: { id: "agriculture", label: "Agriculture", description: "Growing season and evaporative demand.", color: "#15803d" },
  energy: { id: "energy", label: "Energy demand", description: "Degree-day proxies for cooling and heating load.", color: "#6d28d9" },
  humidity: { id: "humidity", label: "Humidity", description: "Moisture in the near-surface air.", color: "#0f766e" },
  wind: { id: "wind", label: "Wind", description: "Near-surface wind speed.", color: "#475569" },
};

export interface Indicator {
  id: string;
  label: string;
  shortLabel: string;
  unit: string;
  /** Unit for the anomaly product, when it differs (rates use percent). */
  anomalyUnit?: string;
  family: IndicatorFamily;
  description: string;
  /** Direction of concern: does a rising value indicate worsening conditions? */
  higherIsWorse: boolean;
  /** Decimal places for display. */
  precision: number;
  /** Whether the platform ships a pre-rasterised grid for this indicator. */
  gridded: boolean;
  /**
   * Whether summing the twelve monthly values is meaningful.
   *
   * Rainfall totals, day counts and degree-days accumulate — the year is the
   * sum of its months, and a seasonal *share* is a real quantity. Temperature
   * does not: adding January to July produces a number with no referent, and
   * "31% of the annual temperature falls in the monsoon" is not a fact about
   * anything. Only accumulating indicators get a share readout.
   */
  accumulates: boolean;
  /** Relevance notes specific to countries. */
  countryNotes?: Partial<Record<CountryCode, string>>;
}

/**
 * Indicator constructor. `accumulates` defaults to false because the
 * temperature family is the larger half of the catalogue and getting this
 * wrong in that direction only suppresses a readout, whereas getting it wrong
 * the other way prints a meaningless statistic.
 */
const ind = (i: Omit<Indicator, "accumulates"> & { accumulates?: boolean }): Indicator => ({
  accumulates: false,
  ...i,
});

export const INDICATORS: Record<string, Indicator> = Object.fromEntries(
  [
    // --- temperature -------------------------------------------------------
    ind({ id: "tas", label: "Average temperature", shortLabel: "Avg temp", unit: "°C", family: "temperature", precision: 1, higherIsWorse: true, gridded: true,
      description: "Mean near-surface air temperature — the headline climate variable.",
      countryNotes: { 
        PAK: "Pakistan has warmed faster than the global land average since 1960.",
        UZB: "Uzbekistan is warming significantly faster than the global average, driving glacial retreat in the Pamir-Alay and Tien Shan.",
        AUS: "Australia's climate has warmed on average by 1.5°C since national records began in 1910.",
        NZL: "New Zealand's average temperature has increased by over 1.1°C since 1909, with the most rapid warming in recent decades."
      } }),
    ind({ id: "tasmax", label: "Maximum temperature", shortLabel: "Max temp", unit: "°C", family: "temperature", precision: 1, higherIsWorse: true, gridded: true,
      description: "Average of daily maximum temperature." }),
    ind({ id: "tasmin", label: "Minimum temperature", shortLabel: "Min temp", unit: "°C", family: "temperature", precision: 1, higherIsWorse: true, gridded: true,
      description: "Average of daily minimum temperature. Rising minima suppress overnight recovery from heat." }),
    ind({ id: "txx", label: "Hottest day of the year", shortLabel: "TXx", unit: "°C", family: "temperature", precision: 1, higherIsWorse: true, gridded: true,
      description: "Annual maximum of daily maximum temperature.",
      countryNotes: { PAK: "Jacobabad and Sibi routinely record among the highest reliably measured temperatures on Earth." } }),
    ind({ id: "tnn", label: "Coldest night of the year", shortLabel: "TNn", unit: "°C", family: "temperature", precision: 1, higherIsWorse: false, gridded: true,
      description: "Annual minimum of daily minimum temperature." }),

    // --- heat --------------------------------------------------------------
    ind({ id: "hd35", accumulates: true, label: "Hot days above 35 °C", shortLabel: "Days >35 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: true,
      description: "Number of days per year with maximum temperature above 35 °C.",
      countryNotes: { PAK: "Above roughly 35 °C, outdoor labour productivity in agriculture and construction falls sharply." } }),
    ind({ id: "hd40", accumulates: true, label: "Very hot days above 40 °C", shortLabel: "Days >40 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: true,
      description: "Number of days per year with maximum temperature above 40 °C." }),
    ind({ id: "hd45", accumulates: true, label: "Extreme heat days above 45 °C", shortLabel: "Days >45 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: false,
      description: "Number of days per year with maximum temperature above 45 °C." }),
    ind({ id: "hd50", accumulates: true, label: "Days above 50 °C", shortLabel: "Days >50 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: false,
      description: "Days exceeding 50 °C — currently near-unheard-of outside a handful of Sindh and southern Punjab stations." }),
    ind({ id: "tr23", accumulates: true, label: "Warm nights above 23 °C", shortLabel: "Nights >23 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: true,
      description: "Nights when the minimum stays above 23 °C.",
      countryNotes: { PAK: "Consecutive warm nights are the strongest predictor of heatwave mortality — the body cannot shed accumulated heat." } }),
    ind({ id: "hi35", accumulates: true, label: "Heat-index days above 35 °C", shortLabel: "Heat index >35 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: true,
      description: "Days on which the heat index — temperature combined with humidity — exceeds 35 °C." }),
    ind({ id: "wbt31", accumulates: true, label: "Wet-bulb days above 31 °C", shortLabel: "Wet-bulb >31 °C", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: false,
      description: "Days above the wet-bulb temperature at which even healthy, resting people in the shade cannot cool by sweating.",
      countryNotes: { PAK: "The lower Indus valley is one of a small number of places worldwide already approaching this threshold." } }),
    ind({ id: "wsdi", accumulates: true, label: "Warm spell duration", shortLabel: "Warm spells", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: false,
      description: "Days in spells of at least six consecutive days above the 90th percentile of the baseline." }),

    // --- precipitation -----------------------------------------------------
    // No `anomalyUnit`: CCKP publishes the precipitation anomaly in mm. The
    // percent form is a separate variable (`prpercnt`) and conflating them
    // would misreport every rainfall change by two orders of magnitude.
    ind({ id: "pr", accumulates: true, label: "Precipitation", shortLabel: "Rainfall", unit: "mm", family: "precipitation", precision: 0, higherIsWorse: false, gridded: true,
      description: "Total precipitation over the period.",
      countryNotes: { PAK: "Roughly 60% of Pakistan's rain falls in the July–September monsoon; annual totals hide most of the story." } }),
    ind({ id: "r95ptot", accumulates: true, label: "Share of rain from very wet days", shortLabel: "Very wet day share", unit: "%", family: "flood", precision: 1, higherIsWorse: true, gridded: true,
      description: "Share of wet-day precipitation falling on days above the 95th percentile of the baseline distribution. A rising share means the same rainfall arriving in fewer, heavier events — which is the change that matters for drainage even when annual totals hold steady.",
      countryNotes: { PAK: "Around a fifth of Pakistan's rain already falls on its very wettest days." } }),

    // --- heavy rainfall ----------------------------------------------------
    ind({ id: "rx1day", accumulates: true, label: "Wettest day of the year", shortLabel: "Max 1-day rain", unit: "mm", family: "flood", precision: 0, higherIsWorse: true, gridded: true,
      description: "Largest single-day precipitation total — the urban-flooding proxy.",
      countryNotes: { PAK: "Karachi's drainage is overwhelmed well below the 1-day totals now recorded in the city." } }),
    ind({ id: "rx5day", accumulates: true, label: "Wettest 5 days of the year", shortLabel: "Max 5-day rain", unit: "mm", family: "flood", precision: 0, higherIsWorse: true, gridded: true,
      description: "Largest five-consecutive-day total — the standard riverine-flood hazard proxy.",
      countryNotes: { PAK: "The 2022 floods followed sustained multi-day monsoon rainfall over Sindh and Balochistan." } }),

    // --- drought -----------------------------------------------------------
    ind({ id: "cdd", accumulates: true, label: "Consecutive dry days", shortLabel: "Dry spell", unit: "days", family: "drought", precision: 0, higherIsWorse: true, gridded: true,
      description: "Longest run of consecutive days receiving less than 1 mm of rain.",
      countryNotes: { PAK: "Balochistan's rain-fed agriculture is governed by dry-spell length more than by annual totals." } }),
    ind({ id: "spei12", label: "Drought index (SPEI-12)", shortLabel: "SPEI-12", unit: "index", family: "drought", precision: 2, higherIsWorse: false, gridded: false,
      description: "12-month Standardised Precipitation-Evapotranspiration Index; negative means drier than baseline." }),

    // --- cryosphere --------------------------------------------------------
    ind({ id: "sd", accumulates: true, label: "Summer days (above 25 °C)", shortLabel: "Summer days", unit: "days", family: "heat", precision: 0, higherIsWorse: true, gridded: true,
      description: "Days per year with maximum temperature above 25 °C — the ETCCDI \"summer days\" index. Despite the code, this is not a snow variable.",
      countryNotes: { PAK: "Already near 360 across lower Sindh and near zero in the high Karakoram; the gradient between them is where warming shows up first." } }),
    ind({ id: "fd", accumulates: true, label: "Frost days", shortLabel: "Frost days", unit: "days", family: "cryosphere", precision: 0, higherIsWorse: false, gridded: false,
      description: "Days with minimum temperature below 0 °C. Retreating frost is the clearest cryosphere signal the archive publishes for Pakistan.",
      countryNotes: { PAK: "Losing frost days at altitude shifts precipitation from snow to rain, which changes when Indus water arrives rather than how much." } }),
    ind({ id: "id", accumulates: true, label: "Ice days", shortLabel: "Ice days", unit: "days", family: "cryosphere", precision: 0, higherIsWorse: false, gridded: false,
      description: "Days that stay below 0 °C all day — the accumulation season in the high mountains." }),

    // --- agriculture / energy ---------------------------------------------
    ind({ id: "gsl", accumulates: true, label: "Growing season length", shortLabel: "Growing season", unit: "days", family: "agriculture", precision: 0, higherIsWorse: false, gridded: false,
      description: "Length of the thermally suitable growing period." }),
    ind({ id: "cdd65", accumulates: true, label: "Cooling degree days", shortLabel: "Cooling demand", unit: "°F-days", family: "energy", precision: 0, higherIsWorse: true, gridded: true,
      description: "Accumulated warmth above 65 °F (18.3 °C), published in Fahrenheit degree-days — a direct proxy for air-conditioning electricity demand.",
      countryNotes: { PAK: "Rising cooling demand collides with a grid that already struggles with summer peak load." } }),
  ].map((i) => [i.id, i]),
);

export const INDICATOR_IDS = Object.keys(INDICATORS);

export const GRIDDED_INDICATOR_IDS = INDICATOR_IDS.filter(
  (id) => INDICATORS[id]!.gridded,
);

export const DEFAULT_INDICATOR = "tas";

export function indicatorsByFamily(): Array<{
  family: IndicatorFamilyMeta;
  indicators: Indicator[];
}> {
  const order = Object.keys(INDICATOR_FAMILIES) as IndicatorFamily[];
  return order
    .map((family) => ({
      family: INDICATOR_FAMILIES[family],
      indicators: INDICATOR_IDS.map((id) => INDICATORS[id]!).filter(
        (i) => i.family === family,
      ),
    }))
    .filter((group) => group.indicators.length > 0);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Normalise the unit strings the NetCDF files carry.
 *
 * CF conventions give temperature as `degC` and precipitation as `mm/period`;
 * those are correct metadata and wrong on a legend. The catalogue's own unit
 * is authoritative, and this maps whatever the archive supplied onto it.
 */
export function displayUnit(rawUnit: string, indicatorId: string, product: ProductId): string {
  const canonical = unitFor(indicatorId, product);
  if (canonical) return canonical;
  const cleaned = rawUnit.trim();
  const aliases: Record<string, string> = {
    degC: "°C",
    celsius: "°C",
    K: "K",
    "mm/period": "mm",
    "mm/day": "mm/day",
    days: "days",
    percent: "%",
  };
  return aliases[cleaned] ?? cleaned;
}

export function unitFor(indicatorId: string, product: ProductId): string {
  const indicator = INDICATORS[indicatorId];
  if (!indicator) return "";
  if (product === "anomaly" && indicator.anomalyUnit) return indicator.anomalyUnit;
  return indicator.unit;
}

export function formatValue(
  value: number | null | undefined,
  indicatorId: string,
  product: ProductId = "climatology",
  options: { signed?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const indicator = INDICATORS[indicatorId];
  const precision = indicator?.precision ?? 1;
  const unit = unitFor(indicatorId, product);
  const signed = options.signed ?? product === "anomaly";
  const body = Math.abs(value).toFixed(precision);
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : "";
  const spacer = unit === "%" || unit === "°C" || unit === "°C-days" ? "" : " ";
  return `${sign}${body}${spacer}${unit}`;
}

export function isValidScenario(id: string): id is ScenarioId {
  return id in SCENARIOS;
}

export function isValidPeriod(id: string): id is PeriodId {
  return id in PERIODS;
}

export function isValidModel(id: string): id is ModelId {
  return id in MODELS;
}

export function isValidIndicator(id: string): boolean {
  return id in INDICATORS;
}
