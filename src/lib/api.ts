import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { env } from "./env";
import { ApiError, toApiError } from "./errors";

/**
 * Shared plumbing for route handlers: consistent envelopes, cache headers
 * tuned to the fact that climate projections never change, and a small
 * in-memory rate limiter.
 */

export interface ApiMeta {
  /** Wall-clock milliseconds spent in the handler. */
  durationMs: number;
  /** Which store answered, when the handler knows. */
  source?: string;
  /** Provenance for anything derived from a published dataset. */
  dataset?: string;
  citation?: string;
}

export function ok<T>(data: T, meta: Partial<ApiMeta> = {}, init: ResponseInit = {}) {
  const response = NextResponse.json({ data, meta }, init);
  // Projections are immutable products of a fixed model archive. A long
  // shared cache with a much longer stale window costs nothing in accuracy
  // and removes the upstream API from the critical path entirely.
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate=604800",
  );
  return response;
}

export function fail(error: unknown) {
  const apiError = toApiError(error);
  if (apiError.status >= 500 && env.NODE_ENV !== "test") {
    console.error(`[api] ${apiError.code}: ${apiError.message}`, apiError.cause ?? "");
  }
  return NextResponse.json(apiError.toJSON(), {
    status: apiError.status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Wrap a handler so validation errors, upstream failures and unexpected
 * throws all leave through the same door with the same shape.
 */
export function handler<T>(
  fn: (request: Request) => Promise<{ data: T; meta?: Partial<ApiMeta> }>,
) {
  return async (request: Request) => {
    const startedAt = performance.now();
    try {
      if (!allow(request)) {
        throw new ApiError("rate_limited", "Too many requests.", {
          hint: "This endpoint is limited per client. Slow down and retry shortly.",
        });
      }
      const { data, meta } = await fn(request);
      return ok(data, { ...meta, durationMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(
          ApiError.badRequest(
            "Invalid query parameters.",
            error.issues.map((issue) => ({
              field: issue.path.join(".") || "(root)",
              message: issue.message,
            })),
          ),
        );
      }
      return fail(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Fixed-window counter, per client, in process memory.
 *
 * This is deliberately simple. It protects the upstream provider from a
 * runaway client on a single instance; a multi-instance deployment should
 * put a shared limiter at the edge rather than make this stateful.
 */
const windows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "anonymous";
}

function allow(request: Request): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const window = windows.get(key);

  if (!window || window.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map cannot grow without bound.
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt < now) windows.delete(k);
    }
    return true;
  }

  window.count += 1;
  return window.count <= env.RATE_LIMIT_PER_MINUTE;
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export const CCKP_CITATION =
  "World Bank Group, Climate Change Knowledge Portal — CMIP6 downscaled projections (0.25°), accessed via cckpapi.worldbank.org.";
