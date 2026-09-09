import { Landing, type CountryHeadline } from "@/components/landing";
import { COUNTRIES, COUNTRY_CODES } from "@/lib/climate/countries";
import { deriveProjected } from "@/lib/climate/derive";
import { getPlace } from "@/lib/climate/places";
import { resolvePoint } from "@/lib/climate/store";

export const metadata = {
  title: "Climate Intelligence Platform",
  description:
    "How the climate of Pakistan, Uzbekistan, Australia and New Zealand could change under CMIP6 emissions pathways.",
};

// The four headline numbers are the same fixed question for every country:
// projected annual-mean warming at the capital under SSP2-4.5 by 2040–2059.
const HEADLINE = { scenario: "ssp245", period: "2040-2059", indicator: "tas" } as const;

async function headlineFor(code: (typeof COUNTRY_CODES)[number]): Promise<CountryHeadline> {
  const config = COUNTRIES[code];
  const capital = getPlace(config.defaultCityId);
  const base: CountryHeadline = {
    code,
    name: config.name,
    flag: config.flag,
    capital: capital?.name ?? config.defaultCityId,
    delta: null,
  };
  if (!capital) return base;
  try {
    const anomaly = await resolvePoint({
      lat: capital.lat,
      lon: capital.lon,
      indicator: HEADLINE.indicator,
      scenario: HEADLINE.scenario,
      period: HEADLINE.period,
      product: "anomaly",
    });
    const baseline = await resolvePoint({
      lat: capital.lat,
      lon: capital.lon,
      indicator: HEADLINE.indicator,
      scenario: "historical",
      period: "1995-2014",
      product: "climatology",
    });
    return {
      ...base,
      delta: anomaly.value,
      projected: deriveProjected(baseline.value, anomaly.value),
    };
  } catch {
    return base;
  }
}

export default async function HomePage() {
  const headlines = await Promise.all(COUNTRY_CODES.map(headlineFor));
  return <Landing headlines={headlines} headlineContext={HEADLINE} />;
}
