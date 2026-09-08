import {
  INDICATORS,
  PERIODS,
  SCENARIOS,
  formatValue,
  type PeriodId,
  type ScenarioId,
} from "./taxonomy";

/**
 * Turning numbers into language, carefully.
 *
 * There is a hard line running through this module. A climate model produces
 * *climate variables*: temperature, precipitation, threshold exceedances.
 * It does not produce flood damages, crop failures or mortality. Those
 * require impact models with their own hydrology, exposure and vulnerability
 * assumptions, and this platform does not have them.
 *
 * So every statement here is one of two kinds:
 *
 *   - a **projection**, which restates a modelled variable, or
 *   - a **mechanism**, which names the physical pathway from that variable
 *     towards an impact without asserting the impact's magnitude.
 *
 * The UI renders the two differently, and the distinction is carried in the
 * type rather than left to prose discipline.
 */

export type StatementKind = "projection" | "mechanism";

export interface Statement {
  kind: StatementKind;
  text: string;
}

// ---------------------------------------------------------------------------
// Uncertainty language
// ---------------------------------------------------------------------------

export interface Spread {
  median: number | null;
  p10: number | null;
  p90: number | null;
}

/**
 * IPCC AR6 uses calibrated language for confidence. We do not have the
 * evidence base to assign those terms, so we describe the *model spread*
 * literally instead — which is what we actually measured.
 */
export function describeSpread(spread: Spread, indicatorId: string): string {
  const { median, p10, p90 } = spread;
  if (median === null) return "No projection available.";
  if (p10 === null || p90 === null) {
    return `Central estimate ${formatValue(median, indicatorId, "anomaly")}. Model spread not available for this combination.`;
  }

  const width = p90 - p10;
  const magnitude = Math.abs(median);
  const relative = magnitude > 0 ? width / magnitude : Number.POSITIVE_INFINITY;

  const agreementPhrase =
    relative < 0.5
      ? "Models agree closely"
      : relative < 1.2
        ? "Models broadly agree"
        : "Models differ substantially";

  const signAgreement =
    p10 > 0 || p90 < 0
      ? "and all agree on the direction of change"
      : "and disagree even on whether the change is positive or negative";

  return `${agreementPhrase} ${signAgreement}. Central estimate ${formatValue(
    median,
    indicatorId,
    "anomaly",
  )}, with 80% of models between ${formatValue(p10, indicatorId, "anomaly")} and ${formatValue(
    p90,
    indicatorId,
    "anomaly",
  )}.`;
}

/**
 * How wide the model spread is relative to the signal — used to decide
 * whether the UI should lead with the number or with the uncertainty.
 */
export function signalToNoise(spread: Spread): "strong" | "moderate" | "weak" {
  const { median, p10, p90 } = spread;
  if (median === null || p10 === null || p90 === null) return "weak";
  if (p10 > 0 || p90 < 0) {
    const ratio = Math.abs(median) / Math.max(p90 - p10, 1e-9);
    return ratio > 1 ? "strong" : "moderate";
  }
  return "weak";
}

// ---------------------------------------------------------------------------
// Impact mechanisms
// ---------------------------------------------------------------------------

export interface MechanismChain {
  id: string;
  /** The modelled variable that starts the chain. */
  driver: string;
  title: string;
  /** Ordered physical steps from climate signal towards consequence. */
  steps: string[];
  /** What would be needed to actually quantify the endpoint. */
  requires: string;
  /** Indicators whose projected change activates this chain. */
  triggers: string[];
}

export const MECHANISMS: MechanismChain[] = [
  {
    id: "heat-stress",
    driver: "tas",
    title: "Heat and human tolerance",
    steps: [
      "Mean and maximum temperature rise",
      "More days cross physiological thresholds (35 °C, 40 °C)",
      "Overnight minima stay high, so the body cannot shed accumulated heat",
      "Heat stress concentrates in outdoor workers, infants and the elderly",
    ],
    requires:
      "An exposure and vulnerability model — who is outdoors, who has cooling, who has power — to translate this into health outcomes.",
    triggers: ["tas", "tasmax", "hd35", "hd40", "tr23", "hi35", "wbt31"],
  },
  {
    id: "humid-heat",
    driver: "hi35",
    title: "Humid heat and the survivability limit",
    steps: [
      "Warming over a warm, moist surface raises wet-bulb temperature",
      "Above roughly 31 °C wet-bulb, sweating stops cooling the body effectively",
      "Above 35 °C wet-bulb, healthy people cannot survive extended exposure even at rest in shade",
      "The lower Indus valley is one of the few regions worldwide already near these values",
    ],
    requires:
      "Station-level humidity validation; gridded wet-bulb estimates carry larger errors than dry-bulb temperature.",
    triggers: ["hi35", "wbt31", "tr23"],
  },
  {
    id: "extreme-rainfall",
    driver: "rx5day",
    title: "Rainfall intensity and flood hazard",
    steps: [
      "Warmer air holds roughly 7% more moisture per degree of warming",
      "When it rains, more water is available to fall in a short window",
      "One-day and five-day maxima increase faster than annual totals",
      "Drainage and river systems designed for historical intensities are exceeded more often",
    ],
    requires:
      "A hydrological model with catchment routing, plus channel capacity and land-use data, to turn rainfall into flood extent or depth.",
    triggers: ["rx1day", "rx5day", "r95ptot"],
  },
  {
    id: "monsoon-variability",
    driver: "pr",
    title: "A more erratic monsoon",
    steps: [
      "Total monsoon rainfall changes only modestly in most models",
      "But it arrives in fewer, heavier bursts separated by longer dry spells",
      "Both flood and drought exposure can rise at the same time",
      "Annual rainfall totals hide this entirely",
    ],
    requires:
      "Sub-daily and event-scale analysis; the 20-year climatologies here average over exactly the variability that matters.",
    triggers: ["pr", "cdd", "rx5day", "sdii"],
  },
  {
    id: "cryosphere",
    driver: "fd",
    title: "Snow, glaciers and the timing of Indus flow",
    steps: [
      "Warming raises the snow line and shortens the accumulation season",
      "More winter precipitation falls as rain rather than snow",
      "Melt arrives earlier and faster, shifting peak river flow away from the irrigation season",
      "The Karakoram's historically stable glaciers are not expected to remain an exception",
    ],
    requires:
      "A glacio-hydrological model of the upper Indus basin. The archive publishes no snow-water-equivalent field for this collection, so this chain is driven by frost and ice days plus temperature — it constrains the *direction* of change, not its magnitude.",
    triggers: ["fd", "id", "tnn", "tas"],
  },
  {
    id: "water-balance",
    driver: "cdd",
    title: "Water stress",
    steps: [
      "Higher temperature raises evaporative demand from soil and crops",
      "Longer dry spells reduce soil moisture recharge between rain events",
      "Irrigation demand rises exactly when surface water availability is least reliable",
      "Groundwater absorbs the shortfall, where it still can",
    ],
    requires:
      "A water-balance model with abstraction, aquifer and canal-allocation data.",
    triggers: ["cdd", "spei12", "tas", "cdd65"],
  },
  {
    id: "agriculture",
    driver: "tasmax",
    title: "Heat and crop yield",
    steps: [
      "Wheat and rice yields fall sharply when heat arrives during grain filling",
      "Warmer winters shorten the wheat growing season in Punjab and Sindh",
      "Higher night-time temperatures increase respiration losses in rice",
      "The growing season shifts, but planting calendars and varieties do not shift automatically",
    ],
    requires:
      "A crop model calibrated to local varieties and management, with CO₂ fertilisation treated explicitly.",
    triggers: ["tasmax", "hd35", "gsl", "tr23"],
  },
  {
    id: "energy",
    driver: "cdd65",
    title: "Cooling demand and the grid",
    steps: [
      "Cooling degree days rise roughly linearly with mean temperature",
      "Peak electricity demand grows fastest on exactly the hottest days",
      "Generation and transmission efficiency both fall as ambient temperature rises",
      "Supply is least reliable when the health consequences of losing it are greatest",
    ],
    requires:
      "A demand model with appliance ownership and grid capacity; degree days are a proxy, not a load forecast.",
    triggers: ["cdd65", "tas", "hd35"],
  },
  {
    id: "aral-sea-desiccation",
    driver: "tas",
    title: "Aral Sea desiccation and toxic salt-dust transport",
    steps: [
      "Higher evaporative demand and upstream water abstraction desiccate terminal lake beds",
      "Exposed seabed of the Aralkum desert accumulates toxic salts and agricultural residues",
      "Convective summer dust storms transport saline particles over hundreds of kilometres",
      "Salt deposition accelerates glacier melt in the Tien Shan and degrades downstream arable soils",
    ],
    requires:
      "An atmospheric aerosol transport and land degradation model combining wind shear with soil chemistry.",
    triggers: ["tas", "cdd", "spei12", "sfcwind", "sfcwindx"],
  },
  {
    id: "central-asia-glacier-melt",
    driver: "fd",
    title: "Tien Shan and Pamir glacial runoff and river discharge",
    steps: [
      "Rising freezing levels reduce winter snow accumulation in high-altitude headwaters",
      "Accelerated glacier ablation produces transient increases in spring runoff ('peak water')",
      "Long-term post-peak discharge decline threatens transboundary flows of the Amu Darya and Syr Darya",
      "Shift in peak river volume timing creates severe mismatch with peak summer crop irrigation",
    ],
    requires:
      "A transboundary glacio-hydrological catchment model accounting for glacial thickness and debris cover.",
    triggers: ["fd", "id", "tas", "tasmax", "sd"],
  },
  {
    id: "continental-heat",
    driver: "hd40",
    title: "Continental heatwaves and urban oasis heat islands",
    steps: [
      "Continental air masses trap intense solar radiation over the Kyzylkum and Karakum deserts",
      "Oasis cities (Tashkent, Samarkand, Bukhara, Fergana) experience amplified heat island effects",
      "Extreme heat exceeding 40 °C to 45 °C suppresses daytime economic and agricultural activity",
      "Water requirements for livestock and human survival spike non-linearly",
    ],
    requires:
      "Urban canopy and boundary layer thermal models with cooling infrastructure telemetry.",
    triggers: ["hd40", "hd42", "hd45", "hd50", "tasmax"],
  },
];

export function mechanismsFor(indicatorId: string): MechanismChain[] {
  return MECHANISMS.filter((chain) => chain.triggers.includes(indicatorId));
}

// ---------------------------------------------------------------------------
// Narrative assembly
// ---------------------------------------------------------------------------

export interface NarrativeInput {
  placeName: string;
  scenario: ScenarioId;
  period: PeriodId;
  baseline: Record<string, number | null>;
  projected: Record<string, number | null>;
  anomaly: Record<string, number | null>;
}

/**
 * Compose the "climate story" for a place: what is true now, what changes,
 * and by how much — as separate, individually attributable statements rather
 * than a paragraph the reader has to disentangle.
 */
export function buildNarrative(input: NarrativeInput): Statement[] {
  const { placeName, scenario, period, baseline, projected, anomaly } = input;
  const statements: Statement[] = [];
  const scenarioMeta = SCENARIOS[scenario];
  const periodMeta = PERIODS[period];

  const baseTemp = baseline.tas;
  const deltaTemp = anomaly.tas;

  if (baseTemp !== null && baseTemp !== undefined) {
    statements.push({
      kind: "projection",
      text: `Over 1995–2014, ${placeName} averaged ${formatValue(baseTemp, "tas")} across the year.`,
    });
  }

  if (deltaTemp !== null && deltaTemp !== undefined) {
    const projectedTemp = projected.tas;
    statements.push({
      kind: "projection",
      text: `Under ${scenarioMeta.label}, the ensemble median warms ${placeName} by ${formatValue(
        deltaTemp,
        "tas",
        "anomaly",
      )} by ${periodMeta.shortLabel}${
        projectedTemp !== null && projectedTemp !== undefined
          ? `, to ${formatValue(projectedTemp, "tas")}`
          : ""
      }.`,
    });
  }

  const deltaHotDays = anomaly.hd35;
  const baseHotDays = baseline.hd35;
  if (
    deltaHotDays !== null &&
    deltaHotDays !== undefined &&
    Math.abs(deltaHotDays) >= 1
  ) {
    statements.push({
      kind: "projection",
      text: `Days above 35 °C change by ${formatValue(deltaHotDays, "hd35", "anomaly")} per year${
        baseHotDays !== null && baseHotDays !== undefined
          ? ` — from about ${Math.round(baseHotDays)} to about ${Math.round(baseHotDays + deltaHotDays)}`
          : ""
      }.`,
    });
    statements.push({
      kind: "mechanism",
      text: "Threshold days matter more than averages for health and outdoor work, because harm is concentrated in the tail of the distribution rather than spread across it.",
    });
  }

  const deltaPrecip = anomaly.pr;
  if (deltaPrecip !== null && deltaPrecip !== undefined) {
    const direction = deltaPrecip > 0 ? "wetter" : "drier";
    statements.push({
      kind: "projection",
      text: `Annual precipitation shifts ${formatValue(deltaPrecip, "pr", "anomaly")} — ${direction} on the annual mean.`,
    });
    statements.push({
      kind: "mechanism",
      text: "Annual totals are the least informative precipitation statistic for Pakistan. The same total delivered in fewer, heavier events raises flood and drought exposure simultaneously.",
    });
  }

  const deltaRx5 = anomaly.rx5day;
  if (deltaRx5 !== null && deltaRx5 !== undefined && Math.abs(deltaRx5) >= 1) {
    statements.push({
      kind: "projection",
      text: `The wettest five-day stretch of a typical year changes by ${formatValue(deltaRx5, "rx5day", "anomaly")}.`,
    });
    statements.push({
      kind: "mechanism",
      text: "Five-day rainfall maxima are a standard proxy for riverine flood hazard, but hazard is not risk: turning this into flood extent needs catchment hydrology, channel capacity and land use.",
    });
  }

  const deltaDry = anomaly.cdd;
  if (deltaDry !== null && deltaDry !== undefined && Math.abs(deltaDry) >= 1) {
    statements.push({
      kind: "projection",
      text: `The longest dry spell of a typical year changes by ${formatValue(deltaDry, "cdd", "anomaly")}.`,
    });
  }

  const deltaSummerDays = anomaly.sd;
  const baseSummerDays = baseline.sd;
  if (
    deltaSummerDays !== null &&
    deltaSummerDays !== undefined &&
    Math.abs(deltaSummerDays) >= 1
  ) {
    statements.push({
      kind: "projection",
      text: `Days above 25 °C change by ${formatValue(deltaSummerDays, "sd", "anomaly")}${
        baseSummerDays !== null && baseSummerDays !== undefined
          ? ` — from about ${Math.round(baseSummerDays)} to about ${Math.round(baseSummerDays + deltaSummerDays)} a year`
          : ""
      }.`,
    });
    if (baseSummerDays !== null && baseSummerDays !== undefined && baseSummerDays < 240) {
      statements.push({
        kind: "mechanism",
        text: "At altitude this index is a proxy for how much of the year sits above freezing-adjacent conditions. More warm days shifts winter precipitation from snow to rain, which changes when Indus water arrives rather than how much of it there is.",
      });
    }
  }

  statements.push({
    kind: "mechanism",
    text: `${scenarioMeta.label} is one pathway, not a forecast. It assumes ${scenarioMeta.narrative.toLowerCase()}; global warming under it reaches roughly ${
      scenarioMeta.globalWarming2100 ?? "an unspecified range"
    } by 2081–2100 relative to pre-industrial.`,
  });

  return statements;
}

// ---------------------------------------------------------------------------
// Comparative framing
// ---------------------------------------------------------------------------

/**
 * Express a projected change against something the reader already has a feel
 * for: the difference between two places today, or a shift in latitude.
 *
 * Only offered for temperature, where the analogy is physically defensible.
 */
export function analogueFor(
  deltaCelsius: number | null,
): { text: string } | null {
  if (deltaCelsius === null || !Number.isFinite(deltaCelsius)) return null;
  const d = Math.abs(deltaCelsius);
  if (d < 0.4) return null;
  // Mean lapse of temperature with latitude over the subcontinent is roughly
  // 0.7 °C per degree of latitude in the annual mean.
  const latitudeShift = d / 0.7;
  const kmSouth = Math.round(latitudeShift * 111);
  return {
    text: `A ${d.toFixed(1)} °C rise in the annual mean is broadly what you would find today by moving about ${kmSouth} km south — roughly ${latitudeShift.toFixed(1)}° of latitude — holding elevation constant.`,
  };
}

export function scenarioDivergence(
  values: Partial<Record<ScenarioId, number | null>>,
  indicatorId: string,
): string | null {
  const low = values.ssp126;
  const high = values.ssp585;
  if (low === null || low === undefined || high === null || high === undefined) {
    return null;
  }
  const gap = high - low;
  const indicator = INDICATORS[indicatorId];
  if (!indicator) return null;
  if (Math.abs(gap) < 0.05) {
    return "The pathways have barely diverged at this horizon — near-term change is largely locked in by past emissions.";
  }
  return `The gap between the low and very high pathways is ${formatValue(
    Math.abs(gap),
    indicatorId,
    "anomaly",
    { signed: false },
  )}. That gap is the part of the outcome still determined by choices rather than by physics already set in motion.`;
}
