import { z } from "zod";

/**
 * Server-side configuration, validated once at module load.
 *
 * Nothing here is exposed to the browser: the app talks to upstream climate
 * providers only from route handlers, so credentials and provider URLs stay
 * on the server and every outbound call goes through our cache and rate
 * limiter.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.url().optional(),
  DIRECT_DATABASE_URL: z.url().optional(),

  CCKP_API_BASE: z.url().default("https://cckpapi.worldbank.org/cckp/v1"),
  CCKP_S3_BASE: z.url().default("https://wbg-cckp.s3.amazonaws.com"),
  OPEN_METEO_BASE: z.url().default("https://api.open-meteo.com/v1"),

  /**
   * `grid`     — serve only from the pre-rasterised local grid.
   * `upstream` — always call the CCKP aggregate API.
   * `db`       — require PostGIS.
   * `auto`     — grid first, then database, then upstream. The default.
   */
  CLIMATE_STORE_MODE: z.enum(["auto", "grid", "db", "upstream"]).default("auto"),

  CLIMATE_CACHE_DIR: z.string().default(".cache/climate"),
  CLIMATE_UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  CLIMATE_UPSTREAM_CONCURRENCY: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(240),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;

export const hasDatabase = Boolean(env.DATABASE_URL);

export const isProduction = env.NODE_ENV === "production";
