import { handler, searchParams } from "@/lib/api";
import { cached } from "@/lib/cache";
import { nearestPlace } from "@/lib/climate/places";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { parseSearchParams, weatherQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Short-range weather — a deliberately separate layer.
 *
 * This exists so the platform can answer "what is it doing now" without ever
 * blending that answer into a climate projection. A forecast and a
 * projection are different objects: one is an initial-value problem good for
 * days, the other a boundary-value problem good for decades. Averaging them,
 * or presenting them in the same number, would be a category error — so they
 * do not share a store, a cache TTL, or a response shape.
 */

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  current?: Record<string, number | string>;
  daily?: Record<string, Array<number | string>>;
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

export const GET = handler(async (request) => {
  const query = parseSearchParams(weatherQuerySchema, searchParams(request));

  const url = new URL(`${env.OPEN_METEO_BASE}/forecast`);
  url.searchParams.set("latitude", String(query.lat));
  url.searchParams.set("longitude", String(query.lon));
  url.searchParams.set("forecast_days", String(query.days));
  url.searchParams.set("timezone", "Asia/Karachi");
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  );

  // Short TTL: this is the one dataset in the platform that actually changes.
  const payload = await cached(
    `weather:${query.lat.toFixed(2)}:${query.lon.toFixed(2)}:${query.days}`,
    async () => {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(env.CLIMATE_UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new ApiError(
          "upstream_unavailable",
          `Weather provider returned ${response.status}.`,
        );
      }
      return (await response.json()) as OpenMeteoResponse;
    },
    { ttlMs: 15 * 60_000, memoryOnly: true },
  );

  const daily = payload.daily ?? {};
  const days = (daily.time ?? []).map((date, index) => ({
    date: String(date),
    code: Number(daily.weather_code?.[index] ?? -1),
    condition: WEATHER_CODES[Number(daily.weather_code?.[index])] ?? "Unknown",
    tempMax: numberAt(daily.temperature_2m_max, index),
    tempMin: numberAt(daily.temperature_2m_min, index),
    feelsLikeMax: numberAt(daily.apparent_temperature_max, index),
    precipitation: numberAt(daily.precipitation_sum, index),
    precipitationProbability: numberAt(daily.precipitation_probability_max, index),
    windMax: numberAt(daily.wind_speed_10m_max, index),
  }));

  const nearest = nearestPlace({ lat: query.lat, lon: query.lon });

  return {
    data: {
      location: {
        lat: payload.latitude,
        lon: payload.longitude,
        elevation: payload.elevation,
        timezone: payload.timezone,
        nearestPlace: nearest?.place.name ?? null,
      },
      current: payload.current
        ? {
            temperature: Number(payload.current.temperature_2m),
            feelsLike: Number(payload.current.apparent_temperature),
            humidity: Number(payload.current.relative_humidity_2m),
            precipitation: Number(payload.current.precipitation),
            windSpeed: Number(payload.current.wind_speed_10m),
            condition: WEATHER_CODES[Number(payload.current.weather_code)] ?? "Unknown",
          }
        : null,
      days,
      disclaimer:
        "Short-range weather forecast. This is a different kind of prediction from the climate projections elsewhere on this platform and the two must not be compared directly.",
    },
    meta: { source: "open-meteo", dataset: "open-meteo", citation: "Open-Meteo.com" },
  };
});

function numberAt(list: Array<number | string> | undefined, index: number): number | null {
  const raw = list?.[index];
  return raw === undefined || raw === null ? null : Number(raw);
}
