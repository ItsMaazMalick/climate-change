import { z } from "zod";

import {
  ENSEMBLE_ID,
  INDICATOR_IDS,
  MODEL_IDS,
  type ModelId,
} from "./climate/taxonomy";

/**
 * Request schemas for the public API.
 *
 * Everything is validated against the taxonomy rather than against loose
 * strings, so an invalid scenario is a 400 with the legal values listed
 * rather than an empty result the caller has to interpret.
 *
 * The scenario and period enums are spelled out literally rather than derived
 * from the taxonomy arrays, because `z.enum` needs a non-empty tuple of
 * literals to infer a union — passing a widened `string[]` compiles but
 * quietly erases the type all the way down into the store.
 */

export const indicatorSchema = z
  .enum(INDICATOR_IDS as [string, ...string[]])
  .describe("Climate indicator code");

export const scenarioSchema = z.enum([
  "historical",
  "ssp119",
  "ssp126",
  "ssp245",
  "ssp370",
  "ssp585",
]);

export const periodSchema = z.enum([
  "1995-2014",
  "2020-2039",
  "2040-2059",
  "2060-2079",
  "2080-2099",
]);

export const modelSchema = z
  .enum(MODEL_IDS as [ModelId, ...ModelId[]])
  .default(ENSEMBLE_ID);

export const percentileSchema = z.enum(["mean", "median", "p10", "p90"]);

export const productSchema = z.enum(["climatology", "anomaly", "timeseries"]);

export const aggregationSchema = z.enum(["annual", "seasonal", "monthly"]);

export const latSchema = z.coerce.number().min(-90).max(90);
export const lonSchema = z.coerce.number().min(-180).max(180);

/**
 * Point and area queries take no `product`: both handlers return the
 * baseline, the projection and the change together, because any one of them
 * alone invites a misreading. Accepting the parameter would mean silently
 * discarding it.
 */
export const pointQuerySchema = z.object({
  lat: latSchema,
  lon: lonSchema,
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  model: modelSchema,
  percentile: percentileSchema.optional(),
  aggregation: aggregationSchema.default("annual"),
});

export const areaQuerySchema = z.object({
  areaId: z.string().min(1).max(64),
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  model: modelSchema,
  percentile: percentileSchema.optional(),
  aggregation: aggregationSchema.default("annual"),
});

export const fieldQuerySchema = z.object({
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  model: modelSchema,
  percentile: percentileSchema.optional(),
  product: productSchema.default("anomaly"),
  aggregation: aggregationSchema.default("annual"),
  /** Clip the returned field to one admin unit. */
  area: z.string().min(1).max(64).optional(),
  country: z.enum(["PAK", "UZB", "AUS", "NZL"]).default("PAK"),
});

export const seriesQuerySchema = z.object({
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  model: modelSchema,
  percentile: percentileSchema.optional(),
  geography: z.string().min(2).max(16).default("PAK"),
  /** Apply a centred moving average, in years, to damp interannual noise. */
  smooth: z.coerce.number().int().min(0).max(41).default(0),
});

export const compareQuerySchema = z.object({
  lat: latSchema.optional(),
  lon: lonSchema.optional(),
  areaId: z.string().min(1).max(64).optional(),
  indicator: indicatorSchema.default("tas"),
  period: periodSchema.default("2040-2059"),
  scenarios: z
    .string()
    .optional()
    .transform((raw) =>
      raw
        ? raw.split(",").map((s) => s.trim()).filter(Boolean)
        : ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"],
    ),
});

export const spreadQuerySchema = z.object({
  lat: latSchema.optional(),
  lon: lonSchema.optional(),
  areaId: z.string().min(1).max(64).optional(),
  /** Active country — drives which national aggregate the individual-model
   *  list is fetched for. Falls back to detection from lat/lon (D4). */
  country: z.enum(["PAK", "UZB", "AUS", "NZL"]).optional(),
  indicator: indicatorSchema.default("tas"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
  /**
   * Include every individual model, not just the percentile envelope.
   *
   * `z.stringbool` rather than `z.coerce.boolean`: coercion runs the value
   * through JavaScript truthiness, so the string "false" would arrive as
   * `true` — which is exactly the value a client is most likely to send.
   */
  models: z.stringbool().default(false),
});

export const storyQuerySchema = z.object({
  lat: latSchema.optional(),
  lon: lonSchema.optional(),
  place: z.string().min(1).max(64).optional(),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
});

export const weatherQuerySchema = z.object({
  lat: latSchema,
  lon: lonSchema,
  days: z.coerce.number().int().min(1).max(16).default(7),
});

/** Parse `URLSearchParams` against a schema, flattening errors for the client. */
export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  params: URLSearchParams,
): z.infer<T> {
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) raw[key] = value;
  return schema.parse(raw);
}
