import { z } from "zod";

import { getCountry } from "@/lib/climate/countries";
import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { rankAreas, type AreaRanking } from "@/lib/climate/db-store";
import { aggregateCells, loadCellsFile, loadField } from "@/lib/climate/grid";
import { INDICATORS, type ProductId, type ScenarioId } from "@/lib/climate/taxonomy";
import { hasDatabase } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import {
  indicatorSchema,
  parseSearchParams,
  periodSchema,
  scenarioSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

const querySchema = z.object({
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  product: z.enum(["anomaly", "climatology"]).default("anomaly"),
  level: z.coerce.number().int().min(0).max(2).default(2),
  direction: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(126).default(15),
  country: z.enum(["PAK", "UZB", "AUS", "NZL", "all"]).default("PAK"),
});

const AREA_NAMES: Record<string, { name: string; level: number; country: string; centroid: [number, number] }> = {
  // Pakistan
  "punjab": { name: "Punjab", level: 1, country: "PAK", centroid: [72.13, 30.82] },
  "sindh": { name: "Sindh", level: 1, country: "PAK", centroid: [68.78, 25.95] },
  "khyber-pakhtunkhwa": { name: "Khyber Pakhtunkhwa", level: 1, country: "PAK", centroid: [71.63, 34.11] },
  "balochistan": { name: "Balochistan", level: 1, country: "PAK", centroid: [65.88, 28.30] },
  "gilgit-baltistan": { name: "Gilgit-Baltistan", level: 1, country: "PAK", centroid: [75.00, 35.79] },
  "azad-jammu-kashmir": { name: "Azad Kashmir", level: 1, country: "PAK", centroid: [74.00, 34.06] },
  "islamabad": { name: "Islamabad", level: 1, country: "PAK", centroid: [73.06, 33.67] },
  // Uzbekistan
  "tashkent-city": { name: "Tashkent City", level: 1, country: "UZB", centroid: [69.24, 41.30] },
  "tashkent-region": { name: "Tashkent Region", level: 1, country: "UZB", centroid: [69.75, 41.20] },
  "samarkand": { name: "Samarkand Region", level: 1, country: "UZB", centroid: [66.60, 39.70] },
  "bukhara": { name: "Bukhara Region", level: 1, country: "UZB", centroid: [64.00, 40.00] },
  "karakalpakstan": { name: "Republic of Karakalpakstan", level: 1, country: "UZB", centroid: [58.50, 43.50] },
  "andijan": { name: "Andijan Region", level: 1, country: "UZB", centroid: [72.35, 40.75] },
  "fergana": { name: "Fergana Region", level: 1, country: "UZB", centroid: [71.50, 40.40] },
  "namangan": { name: "Namangan Region", level: 1, country: "UZB", centroid: [71.40, 41.10] },
  "qashqadaryo": { name: "Qashqadaryo Region", level: 1, country: "UZB", centroid: [66.00, 38.85] },
  "surxondaryo": { name: "Surxondaryo Region", level: 1, country: "UZB", centroid: [67.50, 38.00] },
  "khorezm": { name: "Khorezm Region", level: 1, country: "UZB", centroid: [60.60, 41.50] },
  "navoiy": { name: "Navoiy Region", level: 1, country: "UZB", centroid: [64.50, 42.20] },
  "jizzakh": { name: "Jizzakh Region", level: 1, country: "UZB", centroid: [67.80, 40.30] },
  "sirdaryo": { name: "Sirdaryo Region", level: 1, country: "UZB", centroid: [68.75, 40.50] },
  // Uzbekistan Districts
  "d-yunusabad": { name: "Yunusabad (Tashkent)", level: 2, country: "UZB", centroid: [69.28, 41.36] },
  "d-chilangzor": { name: "Chilangzor (Tashkent)", level: 2, country: "UZB", centroid: [69.20, 41.27] },
  "d-samarkand-city": { name: "Samarkand City", level: 2, country: "UZB", centroid: [66.96, 39.65] },
  "d-pastdargom": { name: "Pastdargom District", level: 2, country: "UZB", centroid: [66.70, 39.60] },
  "d-bukhara-city": { name: "Bukhara City", level: 2, country: "UZB", centroid: [64.43, 39.77] },
  "d-gijduvon": { name: "Gijduvon District", level: 2, country: "UZB", centroid: [64.67, 40.10] },
  "d-nukus-city": { name: "Nukus City", level: 2, country: "UZB", centroid: [59.61, 42.46] },
  "d-muynak": { name: "Muynak (Aral Sea Port)", level: 2, country: "UZB", centroid: [59.03, 43.76] },
  "d-andijan-city": { name: "Andijan City", level: 2, country: "UZB", centroid: [72.34, 40.78] },
  "d-asaka": { name: "Asaka District", level: 2, country: "UZB", centroid: [72.24, 40.64] },
  "d-fergana-city": { name: "Fergana City", level: 2, country: "UZB", centroid: [71.78, 40.38] },
  "d-kokand": { name: "Kokand City", level: 2, country: "UZB", centroid: [70.94, 40.53] },
  "d-namangan-city": { name: "Namangan City", level: 2, country: "UZB", centroid: [71.67, 41.00] },
  "d-chust": { name: "Chust District", level: 2, country: "UZB", centroid: [71.23, 41.01] },
  "d-qarshi-city": { name: "Qarshi City", level: 2, country: "UZB", centroid: [65.79, 38.86] },
  "d-shahrisabz": { name: "Shahrisabz District", level: 2, country: "UZB", centroid: [66.83, 39.05] },
  "d-termez-city": { name: "Termez City", level: 2, country: "UZB", centroid: [67.28, 37.22] },
  "d-denov": { name: "Denov District", level: 2, country: "UZB", centroid: [67.90, 38.27] },
  "d-urgench-city": { name: "Urgench City", level: 2, country: "UZB", centroid: [60.63, 41.55] },
  "d-khiva": { name: "Khiva District", level: 2, country: "UZB", centroid: [60.36, 41.38] },
  "d-navoiy-city": { name: "Navoiy City", level: 2, country: "UZB", centroid: [65.38, 40.08] },
  "d-zarafshan": { name: "Zarafshan Desert District", level: 2, country: "UZB", centroid: [64.20, 41.57] },
  "d-jizzakh-city": { name: "Jizzakh City", level: 2, country: "UZB", centroid: [67.84, 40.12] },
  "d-zaamin": { name: "Zaamin Mountain District", level: 2, country: "UZB", centroid: [68.32, 39.96] },
  "d-guliston-city": { name: "Guliston City", level: 2, country: "UZB", centroid: [68.78, 40.49] },
  "d-yangiyer": { name: "Yangiyer District", level: 2, country: "UZB", centroid: [68.83, 40.27] },
};

export const GET = handler(async (request) => {
  const query = parseSearchParams(querySchema, searchParams(request));
  const indicator = INDICATORS[query.indicator]!;

  // 1. Try DB first if configured
  let top: AreaRanking[] = [];
  let bottom: AreaRanking[] = [];

  if (hasDatabase) {
    try {
      [top, bottom] = await Promise.all([
        rankAreas({ ...query, direction: query.direction, country: query.country }),
        rankAreas({ ...query, direction: query.direction === "desc" ? "asc" : "desc", limit: 5, country: query.country }),
      ]);
    } catch {
      // Fall through to grid ranking
    }
  }

  // 2. Fall back to local grid ranking
  if (top.length === 0) {
    const field = await loadField({
      variable: query.indicator,
      product: query.product as ProductId,
      aggregation: "annual",
      scenario: query.scenario as ScenarioId,
      model: "ensemble-all",
      percentile: "median",
      period: query.period,
    });

    if (field) {
      let fileName = "";
      if (query.country === "PAK") fileName = query.level === 1 ? "provinces-cells.json" : "districts-cells.json";
      else if (query.country === "UZB") fileName = query.level === 1 ? "uzb-regions-cells.json" : "uzb-districts-cells.json";
      else if (query.country === "AUS") fileName = query.level === 1 ? "aus-states-cells.json" : "aus-lgas-cells.json";
      else if (query.country === "NZL") fileName = query.level === 1 ? "nzl-regions-cells.json" : "nzl-districts-cells.json";

      const list: AreaRanking[] = [];

      if (fileName) {
        const areaCells = await loadCellsFile(fileName);

        for (const [areaId, cells] of Object.entries(areaCells)) {
          const meta = AREA_NAMES[areaId];
          const areaLevel = query.level;

        const stats = aggregateCells(field, cells);
        if (stats.mean !== null) {
          list.push({
            areaId,
            name: meta?.name ?? areaId.replace("d-", "").replace(/-/g, " "),
            level: areaLevel,
            value: stats.mean,
            unit: indicator.unit,
            agreement: stats.agreement,
            centroid: { lat: meta?.centroid[1] ?? 0, lon: meta?.centroid[0] ?? 0 },
          });
        }
      }
      }

      list.sort((a, b) => (query.direction === "desc" ? b.value - a.value : a.value - b.value));
      top = list.slice(0, query.limit);
      const oppList = [...list].sort((a, b) =>
        query.direction === "desc" ? a.value - b.value : b.value - a.value,
      );
      bottom = oppList.slice(0, 5);
    }
  }

  if (top.length === 0) {
    throw ApiError.unsupported(
      `No projections available to rank for ${query.indicator} / ${query.scenario} / ${query.period}.`,
      "Select a different indicator or time horizon.",
    );
  }

  return {
    data: {
      indicator,
      scenario: query.scenario,
      period: query.period,
      product: query.product,
      level: query.level,
      levelLabel:
        query.level === 2
          ? query.country === "UZB" ? "district (tuman)" : "district"
          : query.level === 1
            ? query.country === "UZB" ? "region (viloyat)" : "province"
            : "country",
      ranked: top,
      opposite: bottom,
      unit: top[0]?.unit ?? indicator.unit,
      note: `Ranked on the ensemble median across the grid cells inside each administrative unit in ${
        getCountry(query.country).name
      }.`,
    },
    meta: { source: top[0] ? "grid" : "database", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
