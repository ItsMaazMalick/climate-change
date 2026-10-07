import { CCKP_CITATION, handler } from "@/lib/api";
import { getIofsRanking } from "@/lib/iofs/ranking";

export const runtime = "nodejs";

/** All 43 IOFS members' projected warming — for the overview map and ranking table. */
export const GET = handler(async () => {
  const ranking = await getIofsRanking();
  return {
    data: ranking,
    meta: { source: "upstream", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
