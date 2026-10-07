import { handler } from "@/lib/api";
import { getEnsoSnapshot } from "@/lib/iofs/enso";
import { getEnsoOutlook } from "@/lib/iofs/enso-outlook";

export const runtime = "nodejs";

/**
 * Live ENSO status, history, NOAA's own written discussion (lib/iofs/enso.ts)
 * and the IRI/CPC 9-season probability outlook (lib/iofs/enso-outlook.ts).
 * `outlook` is `null` when that page's wording can't be reliably parsed this
 * month — the UI shows that honestly rather than guessing.
 */
export const GET = handler(async () => {
  const [snapshot, outlook] = await Promise.all([getEnsoSnapshot(), getEnsoOutlook()]);
  return {
    data: { ...snapshot, outlook },
    meta: {
      source: "upstream",
      dataset: "NOAA CPC — RONI, Niño 3.4, ENSO diagnostic discussion; IRI/CPC probability outlook",
      citation: "NOAA Climate Prediction Center, cpc.ncep.noaa.gov; IRI, iri.columbia.edu.",
    },
  };
});
