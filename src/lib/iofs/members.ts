/**
 * The Islamic Organization for Food Security (IOFS) member states.
 *
 * IOFS is the OIC's dedicated food-security body. Its 43 members span Central
 * and South Asia, the Gulf, North and Sub-Saharan Africa and one South
 * American state (Suriname) — exactly the geography where an El Niño-driven
 * monsoon failure, Sahelian drought or Gulf heat extreme becomes a food-
 * security event rather than just a weather anomaly.
 *
 * `iso3` is the code the World Bank Climate Change Knowledge Portal keys its
 * CMIP6 national aggregates by (`fetchTimeseries`, `fetchCckp` in
 * `lib/climate/cckp.ts`) — every one of the 43 below was confirmed live
 * against the archive before this list was written. `centroid` is the
 * country's geographic centre (not a capital city), used only to place a
 * marker on the overview map.
 */

export type IofsRegion =
  | "Central & South Asia"
  | "Middle East & Gulf"
  | "North Africa"
  | "Sub-Saharan Africa"
  | "Americas";

export interface IofsMember {
  iso3: string;
  iso2: string;
  name: string;
  flag: string;
  region: IofsRegion;
  /** [lat, lon] geographic centroid. */
  centroid: [number, number];
}

export const IOFS_MEMBERS: IofsMember[] = [
  { iso3: "AFG", iso2: "AF", name: "Afghanistan", flag: "🇦🇫", region: "Central & South Asia", centroid: [33.9, 67.7] },
  { iso3: "AZE", iso2: "AZ", name: "Azerbaijan", flag: "🇦🇿", region: "Central & South Asia", centroid: [40.1, 47.6] },
  { iso3: "BGD", iso2: "BD", name: "Bangladesh", flag: "🇧🇩", region: "Central & South Asia", centroid: [23.7, 90.4] },
  { iso3: "KAZ", iso2: "KZ", name: "Kazakhstan", flag: "🇰🇿", region: "Central & South Asia", centroid: [48.0, 67.0] },
  { iso3: "PAK", iso2: "PK", name: "Pakistan", flag: "🇵🇰", region: "Central & South Asia", centroid: [30.4, 69.3] },
  { iso3: "TJK", iso2: "TJ", name: "Tajikistan", flag: "🇹🇯", region: "Central & South Asia", centroid: [38.9, 71.3] },
  { iso3: "UZB", iso2: "UZ", name: "Uzbekistan", flag: "🇺🇿", region: "Central & South Asia", centroid: [41.4, 64.6] },

  { iso3: "ARE", iso2: "AE", name: "United Arab Emirates", flag: "🇦🇪", region: "Middle East & Gulf", centroid: [23.4, 53.8] },
  { iso3: "IRN", iso2: "IR", name: "Iran", flag: "🇮🇷", region: "Middle East & Gulf", centroid: [32.4, 53.7] },
  { iso3: "IRQ", iso2: "IQ", name: "Iraq", flag: "🇮🇶", region: "Middle East & Gulf", centroid: [33.2, 43.7] },
  { iso3: "JOR", iso2: "JO", name: "Jordan", flag: "🇯🇴", region: "Middle East & Gulf", centroid: [30.6, 36.2] },
  { iso3: "KWT", iso2: "KW", name: "Kuwait", flag: "🇰🇼", region: "Middle East & Gulf", centroid: [29.3, 47.5] },
  { iso3: "PSE", iso2: "PS", name: "Palestine", flag: "🇵🇸", region: "Middle East & Gulf", centroid: [31.9, 35.2] },
  { iso3: "QAT", iso2: "QA", name: "Qatar", flag: "🇶🇦", region: "Middle East & Gulf", centroid: [25.3, 51.2] },
  { iso3: "SAU", iso2: "SA", name: "Saudi Arabia", flag: "🇸🇦", region: "Middle East & Gulf", centroid: [23.9, 45.1] },
  { iso3: "TUR", iso2: "TR", name: "Türkiye", flag: "🇹🇷", region: "Middle East & Gulf", centroid: [38.9, 35.2] },
  { iso3: "YEM", iso2: "YE", name: "Yemen", flag: "🇾🇪", region: "Middle East & Gulf", centroid: [15.6, 48.0] },

  { iso3: "EGY", iso2: "EG", name: "Egypt", flag: "🇪🇬", region: "North Africa", centroid: [26.8, 30.8] },
  { iso3: "LBY", iso2: "LY", name: "Libya", flag: "🇱🇾", region: "North Africa", centroid: [26.3, 17.2] },
  { iso3: "MAR", iso2: "MA", name: "Morocco", flag: "🇲🇦", region: "North Africa", centroid: [31.8, -7.1] },
  { iso3: "SDN", iso2: "SD", name: "Sudan", flag: "🇸🇩", region: "North Africa", centroid: [15.5, 30.2] },
  { iso3: "TUN", iso2: "TN", name: "Tunisia", flag: "🇹🇳", region: "North Africa", centroid: [33.9, 9.5] },

  { iso3: "BEN", iso2: "BJ", name: "Benin", flag: "🇧🇯", region: "Sub-Saharan Africa", centroid: [9.3, 2.3] },
  { iso3: "BFA", iso2: "BF", name: "Burkina Faso", flag: "🇧🇫", region: "Sub-Saharan Africa", centroid: [12.2, -1.6] },
  { iso3: "CMR", iso2: "CM", name: "Cameroon", flag: "🇨🇲", region: "Sub-Saharan Africa", centroid: [5.7, 12.7] },
  { iso3: "CIV", iso2: "CI", name: "Côte d’Ivoire", flag: "🇨🇮", region: "Sub-Saharan Africa", centroid: [7.5, -5.5] },
  { iso3: "COM", iso2: "KM", name: "Comoros", flag: "🇰🇲", region: "Sub-Saharan Africa", centroid: [-11.9, 43.3] },
  { iso3: "TCD", iso2: "TD", name: "Chad", flag: "🇹🇩", region: "Sub-Saharan Africa", centroid: [15.5, 18.7] },
  { iso3: "DJI", iso2: "DJ", name: "Djibouti", flag: "🇩🇯", region: "Sub-Saharan Africa", centroid: [11.8, 42.6] },
  { iso3: "GAB", iso2: "GA", name: "Gabon", flag: "🇬🇦", region: "Sub-Saharan Africa", centroid: [-0.6, 11.6] },
  { iso3: "GMB", iso2: "GM", name: "The Gambia", flag: "🇬🇲", region: "Sub-Saharan Africa", centroid: [13.4, -15.3] },
  { iso3: "GIN", iso2: "GN", name: "Guinea", flag: "🇬🇳", region: "Sub-Saharan Africa", centroid: [9.9, -9.7] },
  { iso3: "GNB", iso2: "GW", name: "Guinea-Bissau", flag: "🇬🇼", region: "Sub-Saharan Africa", centroid: [11.8, -15.2] },
  { iso3: "MLI", iso2: "ML", name: "Mali", flag: "🇲🇱", region: "Sub-Saharan Africa", centroid: [17.6, -4.0] },
  { iso3: "MRT", iso2: "MR", name: "Mauritania", flag: "🇲🇷", region: "Sub-Saharan Africa", centroid: [20.3, -10.3] },
  { iso3: "MOZ", iso2: "MZ", name: "Mozambique", flag: "🇲🇿", region: "Sub-Saharan Africa", centroid: [-18.7, 35.5] },
  { iso3: "NER", iso2: "NE", name: "Niger", flag: "🇳🇪", region: "Sub-Saharan Africa", centroid: [17.6, 8.1] },
  { iso3: "NGA", iso2: "NG", name: "Nigeria", flag: "🇳🇬", region: "Sub-Saharan Africa", centroid: [9.1, 8.7] },
  { iso3: "SEN", iso2: "SN", name: "Senegal", flag: "🇸🇳", region: "Sub-Saharan Africa", centroid: [14.5, -14.5] },
  { iso3: "SLE", iso2: "SL", name: "Sierra Leone", flag: "🇸🇱", region: "Sub-Saharan Africa", centroid: [8.5, -11.8] },
  { iso3: "SOM", iso2: "SO", name: "Somalia", flag: "🇸🇴", region: "Sub-Saharan Africa", centroid: [5.2, 46.2] },
  { iso3: "UGA", iso2: "UG", name: "Uganda", flag: "🇺🇬", region: "Sub-Saharan Africa", centroid: [1.4, 32.3] },

  { iso3: "SUR", iso2: "SR", name: "Suriname", flag: "🇸🇷", region: "Americas", centroid: [4.0, -56.0] },
];

export const IOFS_REGIONS: IofsRegion[] = [
  "Central & South Asia",
  "Middle East & Gulf",
  "North Africa",
  "Sub-Saharan Africa",
  "Americas",
];

const BY_ISO3 = new Map(IOFS_MEMBERS.map((m) => [m.iso3, m]));

export function iofsMember(iso3: string): IofsMember | undefined {
  return BY_ISO3.get(iso3.toUpperCase());
}

export function isIofsMember(iso3: string): boolean {
  return BY_ISO3.has(iso3.toUpperCase());
}

export const DEFAULT_IOFS_MEMBER = "PAK";

export function membersByRegion(): Array<{ region: IofsRegion; members: IofsMember[] }> {
  return IOFS_REGIONS.map((region) => ({
    region,
    members: IOFS_MEMBERS.filter((m) => m.region === region).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}
