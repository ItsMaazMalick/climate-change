/**
 * Plain-language explanations behind every "ⓘ" on the IOFS page.
 *
 * Where ESS Climate Intelligence (the sibling El Niño dashboard this page
 * draws its ENSO panels from) already carries real, reviewed copy for a
 * concept — RONI, Niño 3.4, ENSO status, the probability outlook — that
 * exact text is reused here rather than re-written, so the explanation
 * stays consistent across both products. The rest (the warming trajectory,
 * the episode comparator, the four-pathway fan chart) are specific to this
 * page and are written fresh, in the same structure: what it is, what the
 * value means, the agricultural implication, and the one-line takeaway.
 */

export interface GlossaryTerm {
  term: string;
  text: string;
}

export interface GlossaryEntry {
  title: string;
  /** Short glossary-style "What is X?" entries, shown first. */
  define?: GlossaryTerm[];
  /** "What does this mean?" — can be overridden per-render with a live value. */
  meaning?: string;
  implication?: string;
  takeaway?: string;
  source?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  "enso-status": {
    title: "ENSO Status",
    define: [
      {
        term: "What is El Niño?",
        text: "El Niño is a climate condition in which parts of the central and eastern tropical Pacific Ocean become unusually warm. This can influence atmospheric circulation and alter the probability of rainfall and temperature patterns in many parts of the world.",
      },
      {
        term: "What is La Niña?",
        text: "La Niña is the opposite phase, when the same part of the tropical Pacific becomes unusually cool.",
      },
      {
        term: "What is ENSO?",
        text: "ENSO stands for El Niño Southern Oscillation. It is the overall climate system that includes El Niño, La Niña and Neutral conditions.",
      },
      {
        term: "What does \"Strong\" or \"Super\" mean?",
        text: "NOAA grades an event by its peak RONI: Weak (0.5–0.9), Moderate (1.0–1.4), Strong (1.5–1.9), and Super/Very Strong (2.0 °C or more) — the same bins this page uses to label the current reading.",
      },
    ],
    implication:
      "El Niño can influence the probability of rainfall and temperature changes, but it does not determine weather by itself. Agricultural effects depend on the actual rainfall, temperature, water availability and crop conditions experienced on the ground.",
    takeaway:
      "El Niño is an important global climate signal. It is a reason to monitor more closely — not by itself a prediction of agricultural loss.",
    source: "NOAA Climate Prediction Center (CPC)",
  },

  roni: {
    title: "RONI Index",
    define: [
      {
        term: "What is RONI?",
        text: "RONI (Relative Oceanic Niño Index) is an index used to describe El Niño and La Niña conditions while taking account of temperature conditions across the wider tropical oceans.",
      },
      {
        term: "In simple language",
        text: "A positive RONI indicates conditions on the El Niño side, while a negative RONI indicates conditions on the La Niña side. The farther the value moves away from neutral, the stronger the Pacific climate signal may be.",
      },
      { term: "Scale", text: "La Niña ← Neutral → El Niño" },
    ],
    implication:
      "RONI itself does not measure crop stress. It tells us about the strength of a large-scale climate driver. We therefore need to examine rainfall, temperature, water demand, soil moisture and vegetation response separately.",
    takeaway: "RONI tells us about the climate driver. Observations tell us about the impact.",
    source: "NOAA Climate Prediction Center · RONI.ascii.txt",
  },

  "nino34-sst": {
    title: "Niño 3.4 SST Anomaly",
    define: [
      {
        term: "What is Niño 3.4?",
        text: "Niño 3.4 is an important area of the tropical Pacific Ocean (5°N–5°S, 170°W–120°W) that scientists monitor to understand the development and strength of El Niño and La Niña.",
      },
      { term: "What is SST?", text: "SST means Sea Surface Temperature — simply the temperature of the ocean surface." },
      {
        term: "What is an SST anomaly?",
        text: "SST anomaly tells us how much warmer or cooler the ocean is compared with what is normally expected for that location and time of year. For example, +1.8 °C does not mean the ocean temperature is 1.8 °C — it means the ocean is approximately 1.8 °C warmer than its expected normal temperature.",
      },
    ],
    implication:
      "This Pacific warming can influence large-scale atmospheric circulation, which may subsequently influence regional rainfall and temperature patterns. It is therefore an upstream climate signal rather than a direct measurement of agriculture.",
    takeaway: "The Pacific is unusually warm. Now we need to determine whether and how the land is responding.",
    source: "NOAA Climate Prediction Center · sstoi.indices",
  },

  "roni-chart": {
    title: "Reading This Chart",
    meaning:
      "Higher positive values indicate stronger warming on the El Niño side of the ENSO system. Negative values indicate conditions on the La Niña side. Both lines are anomalies — departures from what is normally expected — not absolute temperatures.",
    implication:
      "Strong Pacific warming can increase the likelihood of climate effects in some regions, but the same ENSO strength does not necessarily produce the same agricultural conditions every time.",
    takeaway:
      "This graph tells us how unusual the current global climate signal is compared with history. It does not by itself tell us the severity of agricultural impacts — it helps us see whether the current Pacific signal is weak, moderate or unusually strong relative to previous events.",
    source: "NOAA Climate Prediction Center · RONI.ascii.txt, sstoi.indices",
  },

  "enso-outlook": {
    title: "Reading This Outlook",
    meaning:
      "This graph shows the estimated probability of El Niño conditions during each of the next nine overlapping three-month seasons. An 80% probability does not mean El Niño will occur for 80% of the time — it means current observations and forecasts indicate El Niño is substantially more likely than the other ENSO states during that period.",
    implication:
      "Continued El Niño conditions mean that climate-sensitive sectors such as agriculture should keep monitoring rainfall, temperature and water availability. It does not mean agricultural damage is inevitable.",
    takeaway: "This is an outlook for the Pacific climate system. Actual agricultural risk must be assessed using observations.",
    source: "IRI / NOAA CPC objective ENSO outlook",
  },

  "episode-comparator": {
    title: "Comparing El Niño Episodes",
    meaning:
      "Each El Niño episode starts on a different calendar date, so lining them up by date hides their actual shape. This chart re-anchors every episode to \"month 0\" — the first season its RONI crossed +0.5 °C — so the current event and a past one can be read side by side at the same stage of development.",
    implication:
      "A steeper early rise generally points to a faster-strengthening event. Whether the current episode ultimately peaks higher or lower than the comparison one is not yet known while it is still developing — the right-hand end of the current line is simply where the real data stops so far.",
    takeaway: "This answers \"is this tracking like a known strong event?\" — not \"what will happen next.\"",
    source: "NOAA Climate Prediction Center · RONI.ascii.txt",
  },

  "episode-ranking": {
    title: "Strongest El Niño Episodes",
    meaning:
      "Each row is the peak RONI reached during one historical episode — a run of consecutive seasons where RONI stayed at or above +0.5 °C. This is computed directly from the real RONI series, grouping consecutive above-threshold seasons into one episode and taking that run's single highest value.",
    implication:
      "RONI adjusts for the long-term global warming trend, so this ranking can differ from rankings built on the raw (non-trend-adjusted) Niño 3.4 anomaly, such as NOAA's ONI. Neither is \"more correct\" — they answer slightly different questions.",
    takeaway: "This is a ranking by ocean-signal strength, not by the damage any one event caused on land.",
    source: "NOAA Climate Prediction Center · RONI.ascii.txt",
  },

  "warming-fan-chart": {
    title: "Four Pathways, One Country",
    meaning:
      "The shaded band is the full spread between the lowest-warming and highest-warming of the four emissions pathways (SSP1-2.6 to SSP5-8.5) at each point between now and 2099. The bold line through the middle is SSP2-4.5 — \"middle of the road\" — and the four dots at the right are each pathway's own value in 2080–2099.",
    implication:
      "The width of the band is itself the finding for a ranking table like this one: a country with a wide band faces very different outcomes depending on how much the world cuts emissions, while a narrow band means the pathways mostly agree.",
    takeaway: "Compare the band's width, not just its position — a narrow high band can matter as much as a wide one.",
    source: "World Bank Climate Change Knowledge Portal — CMIP6 (0.25°), ensemble median",
  },

  "emissions-pathways": {
    title: "What Is an Emissions Pathway (SSP)?",
    define: [
      {
        term: "SSP",
        text: "A Shared Socioeconomic Pathway — a scenario pairing a future trajectory of greenhouse-gas emissions with the socioeconomic story (population, energy use, land use) that could plausibly produce it.",
      },
      {
        term: "The number after \"SSP\"",
        text: "The radiative forcing reached by 2100, in watts per square metre — a direct measure of how much extra energy that pathway traps. SSP1-1.9 is the lowest, SSP5-8.5 the highest.",
      },
    ],
    meaning:
      "None of the four pathways shown here is a prediction. They are four internally consistent \"what if\" futures spanning strong global mitigation (SSP1-2.6) through continued high fossil-fuel growth (SSP5-8.5), used so a reader can see how much the climate outcome itself depends on a choice society hasn't made yet.",
    takeaway: "Which pathway is \"most likely\" is a policy question, not a scientific one — these numbers describe each \"if\", not which will happen.",
    source: "IPCC AR6 WG1 · CMIP6",
  },

  "cmip6-baseline": {
    title: "Baseline, Anomaly & Ensemble Median",
    define: [
      {
        term: "Baseline (1995–2014)",
        text: "The 20-year historical reference period every projected change on this page is measured against — chosen by the archive, not by this page.",
      },
      {
        term: "Anomaly",
        text: "The change from that baseline, not an absolute value. \"+3.2 °C\" means 3.2 degrees warmer than 1995–2014 typically was, not that the temperature itself is 3.2 °C.",
      },
      {
        term: "Ensemble median",
        text: "The World Bank's archive downscales 30 separate climate models for each pathway. The median is the middle value across all 30 — a central estimate, not any single model's output.",
      },
    ],
    takeaway: "Every figure on this page is \"how much change, relative to 1995–2014, do the models typically agree on\" — never a raw forecast from one model.",
    source: "World Bank Climate Change Knowledge Portal — CMIP6 (0.25°)",
  },
};
