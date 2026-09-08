/**
 * A single error vocabulary shared by the store layer and the API routes, so
 * that "this combination was never published upstream" reads differently from
 * "the upstream provider is down" — a distinction that matters a great deal
 * in a climate archive full of legitimately sparse cross-products.
 */

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "unsupported_combination"
  | "upstream_unavailable"
  | "upstream_timeout"
  | "rate_limited"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  unsupported_combination: 422,
  upstream_unavailable: 502,
  upstream_timeout: 504,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Advice the UI can show the user, phrased for a non-specialist. */
  readonly hint?: string;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { details?: unknown; hint?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details;
    this.hint = options.hint;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError("bad_request", message, { details });
  }

  static notFound(message: string) {
    return new ApiError("not_found", message);
  }

  /**
   * The request was well-formed but the archive does not publish that
   * combination — e.g. a percentile for a single model, or SSP1-1.9 for an
   * indicator only released on the four headline pathways.
   */
  static unsupported(message: string, hint?: string) {
    return new ApiError("unsupported_combination", message, { hint });
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.hint ? { hint: this.hint } : {}),
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout/i.test(error.message)) {
      return new ApiError("upstream_timeout", "The climate data provider did not respond in time.", {
        cause: error,
        hint: "This is usually transient. Try again in a moment.",
      });
    }
    return new ApiError("internal", error.message, { cause: error });
  }
  return new ApiError("internal", "Unexpected error");
}
