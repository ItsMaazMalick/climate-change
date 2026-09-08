import {
  CountryCode,
  COUNTRIES,
  DEFAULT_COUNTRY,
  isInsideCountryBounds,
} from "./countries";

/**
 * Named places used for search, quick navigation and the climate story pages.
 *
 * Coordinates are city centres; population figures are 2023/2024 census /
 * official statistical agency estimates, used only for ordering search
 * results and for framing exposure ("how many people live where this
 * happens"), never as an input to a climate calculation.
 */

export interface Place {
  id: string;
  name: string;
  province: string;
  country: CountryCode;
  lat: number;
  lon: number;
  population: number;
  /** Metres above sea level. */
  elevation: number;
  /** Broad climate setting, used to frame the narrative. */
  setting:
    | "coastal"
    | "arid-lowland"
    | "irrigated-plain"
    | "foothill"
    | "mountain"
    | "plateau";
  note?: string;
}

export const PLACES: Place[] = [
  // =========================================================================
  // Pakistan Places
  // =========================================================================
  { id: "karachi", name: "Karachi", province: "Sindh", country: "PAK", lat: 24.8607, lon: 67.0011, population: 20_400_000, elevation: 8, setting: "coastal",
    note: "Coastal megacity where humid heat, sea-level rise and urban drainage failure compound." },
  { id: "lahore", name: "Lahore", province: "Punjab", country: "PAK", lat: 31.5204, lon: 74.3587, population: 13_100_000, elevation: 217, setting: "irrigated-plain",
    note: "Dense inland plain city with severe winter air quality and rising summer extremes." },
  { id: "faisalabad", name: "Faisalabad", province: "Punjab", country: "PAK", lat: 31.4180, lon: 73.0790, population: 3_700_000, elevation: 186, setting: "irrigated-plain",
    note: "Industrial and cotton-belt centre in the heart of the irrigated Punjab." },
  { id: "rawalpindi", name: "Rawalpindi", province: "Punjab", country: "PAK", lat: 33.5651, lon: 73.0169, population: 2_300_000, elevation: 508, setting: "foothill" },
  { id: "islamabad", name: "Islamabad", province: "Islamabad Capital Territory", country: "PAK", lat: 33.6844, lon: 73.0479, population: 1_200_000, elevation: 540, setting: "foothill",
    note: "Sits against the Margalla foothills; wetter and milder than the plains to its south." },
  { id: "gujranwala", name: "Gujranwala", province: "Punjab", country: "PAK", lat: 32.1877, lon: 74.1945, population: 2_200_000, elevation: 226, setting: "irrigated-plain" },
  { id: "peshawar", name: "Peshawar", province: "Khyber Pakhtunkhwa", country: "PAK", lat: 34.0151, lon: 71.5249, population: 2_300_000, elevation: 331, setting: "plateau" },
  { id: "multan", name: "Multan", province: "Punjab", country: "PAK", lat: 30.1575, lon: 71.5249, population: 2_100_000, elevation: 122, setting: "arid-lowland",
    note: "Southern Punjab heat centre; among the hottest large cities in the country." },
  { id: "hyderabad", name: "Hyderabad", province: "Sindh", country: "PAK", lat: 25.3960, lon: 68.3578, population: 1_800_000, elevation: 13, setting: "arid-lowland" },
  { id: "quetta", name: "Quetta", province: "Balochistan", country: "PAK", lat: 30.1798, lon: 66.9750, population: 1_100_000, elevation: 1_680, setting: "plateau",
    note: "High, dry and cold in winter; groundwater depletion is already acute." },
  { id: "sialkot", name: "Sialkot", province: "Punjab", country: "PAK", lat: 32.4945, lon: 74.5229, population: 900_000, elevation: 256, setting: "irrigated-plain" },
  { id: "bahawalpur", name: "Bahawalpur", province: "Punjab", country: "PAK", lat: 29.3956, lon: 71.6836, population: 800_000, elevation: 116, setting: "arid-lowland" },
  { id: "sargodha", name: "Sargodha", province: "Punjab", country: "PAK", lat: 32.0836, lon: 72.6711, population: 700_000, elevation: 193, setting: "irrigated-plain" },
  { id: "sukkur", name: "Sukkur", province: "Sindh", country: "PAK", lat: 27.7052, lon: 68.8574, population: 600_000, elevation: 67, setting: "arid-lowland",
    note: "On the Indus at the Sukkur Barrage — the control point for Sindh's entire irrigation system." },
  { id: "larkana", name: "Larkana", province: "Sindh", country: "PAK", lat: 27.5590, lon: 68.2120, population: 500_000, elevation: 45, setting: "arid-lowland" },
  { id: "jacobabad", name: "Jacobabad", province: "Sindh", country: "PAK", lat: 28.2769, lon: 68.4514, population: 200_000, elevation: 56, setting: "arid-lowland",
    note: "One of a handful of places on Earth to have crossed the 35 °C wet-bulb survivability threshold." },
  { id: "mardan", name: "Mardan", province: "Khyber Pakhtunkhwa", country: "PAK", lat: 34.1989, lon: 72.0231, population: 500_000, elevation: 283, setting: "plateau" },
  { id: "abbottabad", name: "Abbottabad", province: "Khyber Pakhtunkhwa", country: "PAK", lat: 34.1688, lon: 73.2215, population: 250_000, elevation: 1_256, setting: "mountain" },
  { id: "gilgit", name: "Gilgit", province: "Gilgit-Baltistan", country: "PAK", lat: 35.9208, lon: 74.3080, population: 200_000, elevation: 1_500, setting: "mountain",
    note: "Gateway to the Karakoram; downstream of glaciers that feed the Indus." },
  { id: "skardu", name: "Skardu", province: "Gilgit-Baltistan", country: "PAK", lat: 35.2971, lon: 75.6333, population: 100_000, elevation: 2_230, setting: "mountain",
    note: "Surrounded by the largest concentration of glaciers outside the poles." },
  { id: "muzaffarabad", name: "Muzaffarabad", province: "Azad Kashmir", country: "PAK", lat: 34.3700, lon: 73.4711, population: 150_000, elevation: 737, setting: "mountain" },
  { id: "gwadar", name: "Gwadar", province: "Balochistan", country: "PAK", lat: 25.1264, lon: 62.3225, population: 100_000, elevation: 12, setting: "coastal",
    note: "Arid Makran coast; water scarcity is the binding constraint, not rainfall variability." },
  { id: "turbat", name: "Turbat", province: "Balochistan", country: "PAK", lat: 26.0031, lon: 63.0544, population: 200_000, elevation: 137, setting: "arid-lowland" },
  { id: "chitral", name: "Chitral", province: "Khyber Pakhtunkhwa", country: "PAK", lat: 35.8518, lon: 71.7864, population: 50_000, elevation: 1_500, setting: "mountain" },
  { id: "dera-ghazi-khan", name: "Dera Ghazi Khan", province: "Punjab", country: "PAK", lat: 30.0489, lon: 70.6403, population: 400_000, elevation: 122, setting: "arid-lowland" },
  { id: "nawabshah", name: "Nawabshah", province: "Sindh", country: "PAK", lat: 26.2442, lon: 68.4100, population: 300_000, elevation: 29, setting: "arid-lowland",
    note: "Recorded 52.2 °C in 2018, among the highest reliably measured April temperatures anywhere." },
  { id: "sibi", name: "Sibi", province: "Balochistan", country: "PAK", lat: 29.5430, lon: 67.8773, population: 100_000, elevation: 133, setting: "arid-lowland" },
  { id: "thatta", name: "Thatta", province: "Sindh", country: "PAK", lat: 24.7461, lon: 67.9236, population: 200_000, elevation: 13, setting: "coastal",
    note: "Indus delta district, where reduced river flow lets seawater push inland." },
  { id: "murree", name: "Murree", province: "Punjab", country: "PAK", lat: 33.9070, lon: 73.3943, population: 60_000, elevation: 2_291, setting: "mountain" },
  { id: "zhob", name: "Zhob", province: "Balochistan", country: "PAK", lat: 31.3417, lon: 69.4486, population: 70_000, elevation: 1_405, setting: "plateau" },

  // =========================================================================
  // Uzbekistan Places
  // =========================================================================
  {
    id: "tashkent",
    name: "Tashkent",
    province: "Tashkent City",
    country: "UZB",
    lat: 41.2995,
    lon: 69.2401,
    population: 3_000_000,
    elevation: 455,
    setting: "foothill",
    note: "Capital and largest metropolis in Central Asia; Chirchiq river oasis with growing urban heat island and summer air conditioning demands.",
  },
  {
    id: "samarkand",
    name: "Samarkand",
    province: "Samarkand Region",
    country: "UZB",
    lat: 39.6542,
    lon: 66.9597,
    population: 550_000,
    elevation: 702,
    setting: "irrigated-plain",
    note: "Ancient Silk Road crossroad in the Zeravshan valley; reliant on mountain glacier runoff with intensifying summer dryness.",
  },
  {
    id: "bukhara",
    name: "Bukhara",
    province: "Bukhara Region",
    country: "UZB",
    lat: 39.7747,
    lon: 64.4286,
    population: 280_000,
    elevation: 225,
    setting: "arid-lowland",
    note: "Lower Zeravshan desert oasis; severe extreme heat, water scarcity, and increasing soil salinization.",
  },
  {
    id: "nukus",
    name: "Nukus",
    province: "Republic of Karakalpakstan",
    country: "UZB",
    lat: 42.4619,
    lon: 59.6166,
    population: 330_000,
    elevation: 76,
    setting: "arid-lowland",
    note: "Capital of Karakalpakstan adjacent to the desiccated Aral Sea; severely impacted by Aralkum toxic salt-dust storms and water quality degradation.",
  },
  {
    id: "andijan",
    name: "Andijan",
    province: "Andijan Region",
    country: "UZB",
    lat: 40.7821,
    lon: 72.3442,
    population: 450_000,
    elevation: 490,
    setting: "irrigated-plain",
    note: "Eastern Fergana Valley agricultural powerhouse; highly densely populated basin with intense summer agricultural water competition.",
  },
  {
    id: "namangan",
    name: "Namangan",
    province: "Namangan Region",
    country: "UZB",
    lat: 40.9983,
    lon: 71.6726,
    population: 670_000,
    elevation: 476,
    setting: "foothill",
    note: "Northern Fergana basin at the foot of the Chatkal range; prominent horticulture center exposed to seasonal flash runoff and heat spells.",
  },
  {
    id: "fergana",
    name: "Fergana",
    province: "Fergana Region",
    country: "UZB",
    lat: 40.3842,
    lon: 71.7843,
    population: 380_000,
    elevation: 590,
    setting: "irrigated-plain",
    note: "Southern Fergana Valley industrial and orchard center, dependent on transboundary Syr Darya tributaries.",
  },
  {
    id: "qarshi",
    name: "Qarshi",
    province: "Qashqadaryo Region",
    country: "UZB",
    lat: 38.8606,
    lon: 65.7891,
    population: 275_000,
    elevation: 375,
    setting: "arid-lowland",
    note: "Kashkadarya steppe center; frequently experiences extreme summer temperatures exceeding 45 °C with extensive pump-irrigation infrastructure.",
  },
  {
    id: "urgench",
    name: "Urgench",
    province: "Khorezm Region",
    country: "UZB",
    lat: 41.5500,
    lon: 60.6333,
    population: 200_000,
    elevation: 91,
    setting: "arid-lowland",
    note: "Khorezm oasis on the lower Amu Darya near historic Khiva; completely dependent on upstream river discharge.",
  },
  {
    id: "termez",
    name: "Termez",
    province: "Surxondaryo Region",
    country: "UZB",
    lat: 37.2242,
    lon: 67.2783,
    population: 190_000,
    elevation: 302,
    setting: "arid-lowland",
    note: "Southernmost city on the Amu Darya / Afghan border; warmest climate in Uzbekistan with subtropical crops and intense solar radiation.",
  },
  {
    id: "navoiy",
    name: "Navoiy",
    province: "Navoiy Region",
    country: "UZB",
    lat: 40.0844,
    lon: 65.3792,
    population: 155_000,
    elevation: 382,
    setting: "arid-lowland",
    note: "Kyzylkum desert industrial center; high solar energy potential and sharp continental temperature fluctuations.",
  },
  {
    id: "jizzakh",
    name: "Jizzakh",
    province: "Jizzakh Region",
    country: "UZB",
    lat: 40.1158,
    lon: 67.8422,
    population: 180_000,
    elevation: 378,
    setting: "foothill",
    note: "Mirzachul steppe gateway near the Turkestan Range; grain and cotton belt with shifting precipitation timing.",
  },
  {
    id: "guliston",
    name: "Guliston",
    province: "Sirdaryo Region",
    country: "UZB",
    lat: 40.4897,
    lon: 68.7842,
    population: 95_000,
    elevation: 271,
    setting: "irrigated-plain",
    note: "Syr Darya irrigated plain; high groundwater table salinity and summer heat stress.",
  },

  // =========================================================================
  // Australia Places
  // =========================================================================
  { id: "sydney", name: "Sydney", province: "New South Wales", country: "AUS", lat: -33.8688, lon: 151.2093, population: 5_300_000, elevation: 39, setting: "coastal",
    note: "Harbour megacity with extreme heat event frequency rising rapidly; eastern seaboard fire weather driver." },
  { id: "melbourne", name: "Melbourne", province: "Victoria", country: "AUS", lat: -37.8136, lon: 144.9631, population: 5_100_000, elevation: 31, setting: "coastal",
    note: "Temperate maritime capital with 'four seasons in one day'; heatwaves intensifying under SSP3-7.0 and above." },
  { id: "brisbane", name: "Brisbane", province: "Queensland", country: "AUS", lat: -27.4698, lon: 153.0251, population: 2_600_000, elevation: 27, setting: "coastal",
    note: "Subtropical east coast; compound heat-humidity events and intensifying east-coast lows drive flood risk." },
  { id: "perth", name: "Perth", province: "Western Australia", country: "AUS", lat: -31.9505, lon: 115.8605, population: 2_100_000, elevation: 25, setting: "coastal",
    note: "Mediterranean climate under severe drying trend; winter rainfall has halved since 1970." },
  { id: "adelaide", name: "Adelaide", province: "South Australia", country: "AUS", lat: -34.9285, lon: 138.6007, population: 1_400_000, elevation: 50, setting: "coastal",
    note: "Driest capital; acute risk of concurrent heatwave, wildfire smoke, and power grid failure." },
  { id: "canberra", name: "Canberra", province: "Australian Capital Territory", country: "AUS", lat: -35.2809, lon: 149.1300, population: 470_000, elevation: 577, setting: "plateau",
    note: "Inland capital at 577 m; warmer and drier trend with 2020 haze event shrinking winter snowpack on nearby ranges." },
  { id: "darwin", name: "Darwin", province: "Northern Territory", country: "AUS", lat: -12.4634, lon: 130.8456, population: 150_000, elevation: 30, setting: "coastal",
    note: "Tropical monsoon; wet-season intensification and dry-season lengthening compress the productive agriculture window." },
  { id: "hobart", name: "Hobart", province: "Tasmania", country: "AUS", lat: -42.8821, lon: 147.3272, population: 240_000, elevation: 54, setting: "coastal",
    note: "Coolest capital, but warming 0.3°C/decade; kelp forest collapse in warming Southern Ocean waters already documented." },
  { id: "gold-coast", name: "Gold Coast", province: "Queensland", country: "AUS", lat: -28.0167, lon: 153.4000, population: 680_000, elevation: 10, setting: "coastal",
    note: "Low-lying beachfront city; sea-level rise of 0.5–1.0 m by 2100 threatens coastal real estate and infrastructure." },
  { id: "townsville", name: "Townsville", province: "Queensland", country: "AUS", lat: -19.2590, lon: 146.8169, population: 200_000, elevation: 15, setting: "coastal",
    note: "Gateway to the Great Barrier Reef; mass bleaching events linked directly to sea surface temperature anomalies." },
  { id: "cairns", name: "Cairns", province: "Queensland", country: "AUS", lat: -16.9186, lon: 145.7781, population: 165_000, elevation: 8, setting: "coastal",
    note: "Tropical rainforest edge; cyclone intensity amplifying as Coral Sea warms beyond 1.5°C above pre-industrial." },
  { id: "alice-springs", name: "Alice Springs", province: "Northern Territory", country: "AUS", lat: -23.6980, lon: 133.8807, population: 27_000, elevation: 547, setting: "arid-lowland",
    note: "Arid continental centre; 50°C heat extremes projected for mid-century under SSP5-8.5." },
  { id: "broken-hill", name: "Broken Hill", province: "New South Wales", country: "AUS", lat: -31.9537, lon: 141.4535, population: 17_000, elevation: 299, setting: "arid-lowland",
    note: "Far-west outback town with chronic water insecurity as the Darling–Baaka system faces record low flows." },
  { id: "port-hedland", name: "Port Hedland", province: "Western Australia", country: "AUS", lat: -20.3103, lon: 118.5961, population: 16_000, elevation: 7, setting: "coastal",
    note: "Pilbara port exposed to tropical cyclones; recorded Australia's highest non-fire radiative temperature at 50.7°C in 2003." },

  // =========================================================================
  // New Zealand Places
  // =========================================================================
  { id: "auckland", name: "Auckland", province: "Auckland", country: "NZL", lat: -36.8485, lon: 174.7633, population: 1_700_000, elevation: 7, setting: "coastal",
    note: "Largest NZ city on a volcanic field isthmus; sea-level rise threatens low-lying suburbs and critical harbour infrastructure." },
  { id: "wellington", name: "Wellington", province: "Wellington", country: "NZL", lat: -41.2865, lon: 174.7762, population: 440_000, elevation: 10, setting: "coastal",
    note: "Capital perched on Cook Strait; among the world's windiest cities and highly exposed to subduction-zone tsunami risk." },
  { id: "christchurch", name: "Christchurch", province: "Canterbury", country: "NZL", lat: -43.5321, lon: 172.6362, population: 400_000, elevation: 10, setting: "irrigated-plain",
    note: "Canterbury Plains hub in the South Island rain shadow; hotter, drier summers and increasing irrigation demand on alpine-fed rivers." },
  { id: "hamilton", name: "Hamilton", province: "Waikato", country: "NZL", lat: -37.7870, lon: 175.2793, population: 180_000, elevation: 39, setting: "irrigated-plain",
    note: "Waikato River dairy heartland; nitrogen-driven water quality crisis compounded by intensifying drought cycles." },
  { id: "tauranga", name: "Tauranga", province: "Bay of Plenty", country: "NZL", lat: -37.6878, lon: 176.1651, population: 160_000, elevation: 5, setting: "coastal",
    note: "Fastest-growing NZ city; Bay of Plenty coastline exposed to rising sea levels and more intense ex-tropical cyclones." },
  { id: "napier", name: "Napier", province: "Hawke's Bay", country: "NZL", lat: -39.4928, lon: 176.9120, population: 65_000, elevation: 8, setting: "coastal",
    note: "Art Deco capital on Hawke Bay; severe drought episodes and intensifying Cyclone Gabrielle-type events." },
  { id: "dunedin", name: "Dunedin", province: "Otago", country: "NZL", lat: -45.8788, lon: 170.5028, population: 135_000, elevation: 15, setting: "coastal",
    note: "Southern university city; harbourside low-lying areas already experiencing tidal flooding (king tides)." },
  { id: "palmerston-north", name: "Palmerston North", province: "Manawatū-Whanganui", country: "NZL", lat: -40.3523, lon: 175.6082, population: 92_000, elevation: 37, setting: "irrigated-plain",
    note: "Manawatū plains agricultural hub; river flooding risk amplified by more intense westerly storm sequences." },
  { id: "queenstown", name: "Queenstown", province: "Otago", country: "NZL", lat: -45.0312, lon: 168.6626, population: 15_000, elevation: 310, setting: "mountain",
    note: "Ski and adventure tourism capital; declining snowpack in Remarkables and Cecil Peak threatens winter-season viability." },
  { id: "nelson", name: "Nelson", province: "Nelson", country: "NZL", lat: -41.2706, lon: 173.2840, population: 55_000, elevation: 10, setting: "coastal",
    note: "Sunniest NZ city; top-of-South viticulture and horticulture exposed to water-scarcity risk as Waimea basin tightens." },
];

const byId = new Map(PLACES.map((place) => [place.id, place]));

export function getPlace(id: string): Place | undefined {
  return byId.get(id);
}

export function getPlacesForCountry(countryCode?: CountryCode): Place[] {
  if (!countryCode) return PLACES;
  return PLACES.filter((place) => place.country === countryCode);
}

export function searchPlaces(
  query: string,
  limit = 8,
  countryCode?: CountryCode,
): Place[] {
  const needle = query.trim().toLowerCase();
  const pool = countryCode ? getPlacesForCountry(countryCode) : PLACES;

  if (!needle) {
    return [...pool].sort((a, b) => b.population - a.population).slice(0, limit);
  }
  return pool
    .filter(
      (place) =>
        place.name.toLowerCase().includes(needle) ||
        place.province.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || b.population - a.population;
    })
    .slice(0, limit);
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Nearest named place to a clicked point, for labelling map selections. */
export function nearestPlace(
  point: { lat: number; lon: number },
  maxKm = 150,
  countryCode?: CountryCode,
): { place: Place; distanceKm: number } | null {
  let best: { place: Place; distanceKm: number } | null = null;
  const pool = countryCode ? getPlacesForCountry(countryCode) : PLACES;

  for (const place of pool) {
    const distanceKm = haversineKm(point, place);
    if (!best || distanceKm < best.distanceKm) best = { place, distanceKm };
  }
  return best && best.distanceKm <= maxKm ? best : null;
}

export const PAKISTAN_BOUNDS = COUNTRIES.PAK.bbox;
export const UZBEKISTAN_BOUNDS = COUNTRIES.UZB.bbox;
export const AUSTRALIA_BOUNDS = COUNTRIES.AUS.bbox;
export const NEW_ZEALAND_BOUNDS = COUNTRIES.NZL.bbox;

export function isInsidePakistanBounds(lat: number, lon: number): boolean {
  return isInsideCountryBounds(lat, lon, "PAK");
}

export function isInsideUzbekistanBounds(lat: number, lon: number): boolean {
  return isInsideCountryBounds(lat, lon, "UZB");
}

export function isInsideAustraliaBounds(lat: number, lon: number): boolean {
  return isInsideCountryBounds(lat, lon, "AUS");
}

export function isInsideNewZealandBounds(lat: number, lon: number): boolean {
  return isInsideCountryBounds(lat, lon, "NZL");
}
