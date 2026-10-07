import { z } from "zod";
import { handler } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { iofsLanguage } from "@/lib/iofs/languages";
import { translateBatch } from "@/lib/iofs/translate";

export const runtime = "nodejs";

const bodySchema = z.object({
  texts: z.array(z.string().max(2000)).min(1).max(60),
  target: z.string().min(2).max(5),
});

/**
 * `POST /api/iofs/translate` `{ texts: string[], target: "ar" | "fr" | ... }`
 * → `{ translations: string[] }`, same order as `texts`.
 *
 * A POST rather than GET because a page's worth of UI copy — a glossary
 * dialog especially — can exceed a URL's practical length. See
 * `lib/iofs/translate.ts` for the provider and caching.
 */
export const GET = handler(async () => {
  throw ApiError.badRequest("Use POST with a JSON body: { texts: string[], target: string }.");
});

export const POST = handler(async (request) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw ApiError.badRequest("Request body must be JSON.");
  }

  const parsed = bodySchema.parse(payload);
  if (parsed.target !== "en" && !iofsLanguage(parsed.target)) {
    throw ApiError.badRequest(`'${parsed.target}' is not one of the IOFS page's supported languages.`);
  }

  const translations = await translateBatch(parsed.texts, parsed.target);

  return {
    data: { translations },
    meta: { source: "upstream", dataset: "Google Translate (translate_a/single)" },
  };
});
