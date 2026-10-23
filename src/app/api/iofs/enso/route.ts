import { handler } from "@/lib/api";
import { getEnsoSnapshot } from "@/lib/iofs/enso";
import { getEnsoOutlook } from "@/lib/iofs/enso-outlook";

export const runtime = "nodejs";

/**
 * Live ENSO status, history, NOAA's own written discussion (lib/iofs/enso.ts)
 * and NOAA CPC's official 9-season outlook tables (lib/iofs/enso-outlook.ts).
 * `outlook` is `null` when the CPC tables are missing, can't be parsed, or are from a different
 * month than the bulletin — the UI says so rather than guessing.
 */
export const GET = handler(async () => {
  const [snapshot, outlook] = await Promise.all([getEnsoSnapshot(), getEnsoOutlook()]);
  return {
    data: { ...snapshot, outlook },
    meta: {
      source: "upstream",
      dataset: "NOAA CPC — RONI, Niño 3.4, ENSO diagnostic discussion; official outlook tables (probabilities, strengths, RONI forecast)",
      citation: "NOAA Climate Prediction Center, cpc.ncep.noaa.gov.",
    },
  };
});
