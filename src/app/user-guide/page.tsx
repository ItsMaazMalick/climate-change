import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "User Guide · Climate Intelligence",
  description: "A complete, visually-driven walkthrough of the platform.",
};

const SECTIONS = [
  {
    id: "01",
    title: "Global Navigation",
    desc: "Access the platform, switch territories, and find your land.",
    steps: 3,
  },
  {
    id: "02",
    title: "The Climate State",
    desc: "Pick indicators, scenarios, horizons, and display modes.",
    steps: 4,
  },
  {
    id: "03",
    title: "Reading the Grid",
    desc: "Understand color scales, uncertainty, and map probing.",
    steps: 3,
  },
  {
    id: "04",
    title: "Location Analytics",
    desc: "Analyze seasonal shifts, bounds, and vulnerability impacts.",
    steps: 6,
  },
  {
    id: "05",
    title: "Advanced Synthesis",
    desc: "Compare scenarios directly, rank hotspots, and read dossiers.",
    steps: 8,
  },
];

const STEPS = [
  {
    id: "step-01",
    num: "01",
    title: "Access the platform",
    img: "/images/manual/step01.png",
    aspect: "aspect-[12/1]",
    points: [
      "The Global Command Center resides in the top header.",
      "Navigate between primary tools: Map Explorer, Side-by-Side Compare, Vulnerability Hotspots, and City Dossiers.",
      "The layout remains persistent across all sub-applications for continuous context."
    ]
  },
  {
    id: "step-02",
    num: "02",
    title: "Switch territories",
    img: "/images/manual/step02.png",
    aspect: "aspect-[14/1]",
    points: [
      "Click the flag icon to instantly switch between supported countries (e.g., Pakistan, Uzbekistan).",
      "Switching countries automatically loads local administrative boundaries (provinces, districts).",
      "It instantly resets the spatial grid and filters the curated places list for that specific region."
    ]
  },
  {
    id: "step-03",
    num: "03",
    title: "Find your land",
    img: "/images/manual/step03.png",
    aspect: "aspect-[2/1]",
    points: [
      "Type any major city name, district, or coordinates into the search bar.",
      "The platform utilizes an intelligent geocoder to instantly fly the map to those coordinates.",
      "A probe is automatically dropped to load the localized point-specific data panel."
    ]
  },
  {
    id: "step-04",
    num: "04",
    title: "Pick an indicator",
    img: "/images/manual/step04.png",
    aspect: "aspect-[5/3]",
    points: [
      "Choose from a curated taxonomy of highly specific physical variables.",
      "Metrics range from Mean Temperature and Total Precipitation to Extreme Heat (Days >35°C) and Moisture Deficit.",
      "Every indicator automatically defines its own scientific unit and direction of concern."
    ]
  },
  {
    id: "step-05",
    num: "05",
    title: "Choose a scenario",
    img: "/images/manual/step05.png",
    aspect: "aspect-[5/3]",
    points: [
      "Compare the Historical Baseline (1995-2014) against distinct future socio-economic trajectories.",
      "Toggle to SSP2-4.5 for a 'Middle of the Road' pathway assuming moderate mitigation.",
      "Toggle to SSP5-8.5 to analyze the 'Fossil-Fueled Development' worst-case scenario."
    ]
  },
  {
    id: "step-06",
    num: "06",
    title: "Set the time horizon",
    img: "/images/manual/step06.png",
    aspect: "aspect-[5/3]",
    points: [
      "Select your desired 20-year future epoch for climatological averaging.",
      "Project to the Near Term (2020-2039) for immediate strategic planning.",
      "Project to the Mid Term (2040-2059) or Long Term (2080-2099) for intergenerational infrastructure resilience."
    ]
  },
  {
    id: "step-07",
    num: "07",
    title: "Absolute vs Anomaly",
    img: "/images/manual/step07.png",
    aspect: "aspect-[5/3]",
    points: [
      "Toggle the Display Mode between raw Absolute Climatology and the Relative Anomaly.",
      "Absolute mode shows raw physical values (e.g., 38°C).",
      "Anomaly mode isolates the climate change signal (e.g., +2.4°C hotter than the 1995-2014 baseline)."
    ]
  },
  {
    id: "step-08",
    num: "08",
    title: "Understand the color scale",
    img: "/images/manual/step08.png",
    aspect: "aspect-[3/1]",
    points: [
      "The continuous gradient automatically adjusts its mathematical bounds perfectly for the chosen indicator.",
      "Diverging metrics map to strict scientific palettes (e.g., red for hotter, brown for drier, blue for wetter).",
      "The legend dynamically updates its precision depending on the variable's physical variance."
    ]
  },
  {
    id: "step-09",
    num: "09",
    title: "Spot uncertainty",
    img: "/images/manual/step09.png",
    aspect: "aspect-[4/1]",
    points: [
      "A hatched pattern overlays grid cells where fewer than 80% of the ensemble models agree on the direction of change.",
      "This visual heuristic instantly communicates statistical noise.",
      "Never trust the raw color magnitude if it is heavily hatched; the models lack consensus."
    ]
  },
  {
    id: "step-10",
    num: "10",
    title: "Probe the cells",
    img: "/images/manual/step10.png",
    aspect: "aspect-[1/1]",
    points: [
      "Hover over any cell on the high-resolution grid to summon the Heads-Up Display (HUD).",
      "Instantly preview its exact latitude, longitude, and raw scientific value.",
      "Use this rapid-fire inspection to scan gradients before committing to a full point analysis."
    ]
  },
  {
    id: "step-11",
    num: "11",
    title: "Open the Location Panel",
    img: "/images/manual/step11.png",
    aspect: "aspect-[4/5]",
    points: [
      "Clicking any map cell expands the comprehensive side panel analytics.",
      "It immediately reveals the absolute baseline value for that exact 0.25° coordinate.",
      "It displays the projected anomaly alongside the total anticipated future state."
    ]
  },
  {
    id: "step-12",
    num: "12",
    title: "Read the seasonal cycle",
    img: "/images/manual/step12.png",
    aspect: "aspect-[5/4]",
    points: [
      "For metrics that accumulate over time, the seasonal cycle plots the 12 individual calendar months.",
      "It visually demonstrates when the baseline events (e.g., monsoon rains) historically occurred.",
      "It overlays the projected shifts, revealing changes in seasonality (e.g., later onset or early spring melts)."
    ]
  },
  {
    id: "step-13",
    num: "13",
    title: "Trust the model spread",
    img: "/images/manual/step13.png",
    aspect: "aspect-[5/4]",
    points: [
      "Never trust a single deterministic line; climate modeling is probabilistic.",
      "The spread chart plots the ensemble median heavily bracketed by the 10th and 90th percentiles.",
      "A tight spread implies high confidence; a wide, scattering spread dictates caution in adaptation planning."
    ]
  },
  {
    id: "step-14",
    num: "14",
    title: "All Policy Pathways",
    img: "/images/manual/step14.png",
    aspect: "aspect-[5/4]",
    points: [
      "A rapid side-by-side comparison of the active coordinate across every available emissions pathway.",
      "Instantly visualize the delta between aggressive mitigation (SSP1-1.9) and fossil-fueled growth (SSP5-8.5).",
      "The gap between these bars visually quantifies the portion of the future still determined by human policy choices."
    ]
  },
  {
    id: "step-15",
    num: "15",
    title: "Related Vulnerability Metrics",
    img: "/images/manual/step15.png",
    aspect: "aspect-[5/4]",
    points: [
      "Climate variables do not exist in isolation; they trigger cascading systemic risks.",
      "This semantic section highlights downstream risks associated with the primary indicator.",
      "Example: Rising mean temperatures are explicitly linked to agricultural heat stress and grid failure."
    ]
  },
  {
    id: "step-16",
    num: "16",
    title: "Scientific Methodology",
    img: "/images/manual/step16.png",
    aspect: "aspect-[5/4]",
    points: [
      "Full scientific transparency ensures trust in the data products.",
      "Read exactly how the active variable is mathematically defined from the raw netCDF outputs.",
      "Understand how it was dynamically downscaled from CMIP6 global circulation models."
    ]
  },
  {
    id: "step-17",
    num: "17",
    title: "Enter Compare Mode",
    img: "/images/manual/step17.png",
    aspect: "aspect-[16/9]",
    points: [
      "When you need to make high-stakes policy decisions, switch from the Map Explorer to the dedicated Compare view.",
      "Accessed via the main navigation header.",
      "Provides a distraction-free environment for pure numerical contrast."
    ]
  },
  {
    id: "step-18",
    num: "18",
    title: "Select Target Location",
    img: "/images/manual/step18.png",
    aspect: "aspect-[16/9]",
    points: [
      "Use the intelligent search bar localized within the Compare panel.",
      "It snaps your analysis precisely to a desired province, district, or municipal centroid.",
      "Ensures the comparison is grounded in local realities."
    ]
  },
  {
    id: "step-19",
    num: "19",
    title: "Configure Scenarios",
    img: "/images/manual/step19.png",
    aspect: "aspect-[16/9]",
    points: [
      "The tool renders the exact scenarios in a stark, readable matrix.",
      "It isolates the impacts of delayed mitigation vs rapid action for your selected indicator.",
      "It surfaces raw numerical deltas (Δ) for immediate reporting."
    ]
  },
  {
    id: "step-20",
    num: "20",
    title: "Policy Implication",
    img: "/images/manual/step20.png",
    aspect: "aspect-[16/9]",
    points: [
      "The system engine automatically synthesizes a conclusion based on the numerical delta.",
      "It provides a plain-English briefing of the climate divergence.",
      "Transforms raw data into an executive summary ready for stakeholders."
    ]
  },
  {
    id: "step-21",
    num: "21",
    title: "Open Hotspots",
    img: "/images/manual/step21.png",
    aspect: "aspect-[16/9]",
    points: [
      "Navigate to the Hotspots view to see aggregated, macro-level rankings.",
      "It shifts the perspective from localized point analysis to systemic national vulnerability.",
      "Identifies the regions facing the absolute highest degrees of climatic stress."
    ]
  },
  {
    id: "step-22",
    num: "22",
    title: "Rank the Districts",
    img: "/images/manual/step22.png",
    aspect: "aspect-[16/9]",
    points: [
      "Interact with ranked vulnerability tables across all provinces and districts.",
      "Sort by absolute value or projected change.",
      "Immediately reveals which administrative zones face the fastest warming or most severe moisture deficits."
    ]
  },
  {
    id: "step-23",
    num: "23",
    title: "Open Places Directory",
    img: "/images/manual/step23.png",
    aspect: "aspect-[16/9]",
    points: [
      "Use the Places directory to explore deeply curated qualitative narratives.",
      "Augments the quantitative model outputs with on-the-ground socioeconomic context.",
      "Categorizes cities by their foundational ecological settings."
    ]
  },
  {
    id: "step-24",
    num: "24",
    title: "Read Ecological Narratives",
    img: "/images/manual/step24.png",
    aspect: "aspect-[16/9]",
    points: [
      "The directory organizes major cities by setting (e.g., coastal, desert, oasis, glacial).",
      "Each dossier explains the physical mechanisms driving its unique climate trajectory.",
      "Provides holistic, point-by-point detail views of local climate history and future risks."
    ]
  }
];

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 pb-32 pt-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px]"></div>
          <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-blue-500/20 blur-[100px]"></div>
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              Platform Masterclass
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Climate Intelligence <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                User Manual
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Twenty-four exhaustive steps, from logging in to synthesizing advanced vulnerability metrics.
              Every picture below is the real interface, captured directly from the platform, with the interaction mathematically labeled and zoomed.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 -mt-16">

        {/* Index Grid */}
        <div className="relative z-10 mb-24 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-200/40"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    {section.id}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {section.steps} steps
                  </span>
                </div>
                <h3 className="mb-2 text-base font-bold text-slate-900">
                  {section.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {section.desc}
                </p>
              </div>
              <div className="mt-6 flex items-center text-sm font-bold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
                Explore phase <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </a>
          ))}
        </div>

        {/* Main Content Layout with Sidebar */}
        <div className="flex flex-col lg:flex-row gap-16 pb-32">

          {/* Sticky Sidebar Navigation */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Contents</h4>
              <nav className="flex flex-col gap-2">
                {SECTIONS.map((section) => (
                  <div key={section.id} className="mb-4">
                    <a href={`#section-${section.id}`} className="block text-sm font-bold text-slate-900 hover:text-emerald-600 transition-colors mb-2">
                      Phase {section.id}: {section.title}
                    </a>
                    <div className="flex flex-col gap-1 border-l-2 border-slate-100 ml-2 pl-3">
                      {STEPS.filter(s => {
                        const sNum = parseInt(s.num);
                        const secNum = parseInt(section.id);
                        if (secNum === 1) return sNum <= 3;
                        if (secNum === 2) return sNum > 3 && sNum <= 7;
                        if (secNum === 3) return sNum > 7 && sNum <= 10;
                        if (secNum === 4) return sNum > 10 && sNum <= 16;
                        if (secNum === 5) return sNum > 16;
                        return false;
                      }).map(step => (
                        <a key={step.id} href={`#${step.id}`} className="text-[13px] font-medium text-slate-500 hover:text-emerald-600 transition-colors py-1">
                          {step.num}. {step.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Steps Content */}
          <div className="flex-1 space-y-32">
            {STEPS.map((step, index) => {
              // Determine if this step starts a new section
              let sectionId = null;
              let sectionTitle = null;
              if (step.num === "01") { sectionId = "01"; sectionTitle = SECTIONS[0]?.title; }
              if (step.num === "04") { sectionId = "02"; sectionTitle = SECTIONS[1]?.title; }
              if (step.num === "08") { sectionId = "03"; sectionTitle = SECTIONS[2]?.title; }
              if (step.num === "11") { sectionId = "04"; sectionTitle = SECTIONS[3]?.title; }
              if (step.num === "17") { sectionId = "05"; sectionTitle = SECTIONS[4]?.title; }

              return (
                <div key={step.id} id={step.id} className="scroll-mt-24">

                  {/* Phase Header (if applicable) */}
                  {sectionId && (
                    <div id={`section-${sectionId}`} className="mb-12 border-b border-slate-200 pb-4">
                      <span className="text-sm font-extrabold uppercase tracking-widest text-emerald-600">
                        Phase {sectionId}
                      </span>
                      <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
                        {sectionTitle}
                      </h2>
                    </div>
                  )}

                  {/* Step Card */}
                  <div className="flex flex-col xl:flex-row gap-10">

                    {/* Text Column */}
                    <div className="xl:w-1/3 xl:shrink-0 flex flex-col justify-center">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white shadow-md">
                          {step.num}
                        </span>
                        <h3 className="text-2xl font-bold text-slate-900">
                          {step.title}
                        </h3>
                      </div>

                      <div className="mt-4 space-y-4">
                        {step.points.map((point, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                            <p className="text-[15px] leading-relaxed text-slate-600 font-medium">
                              {point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Image Column (macOS window style) */}
                    <div className="xl:w-2/3">
                      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-200/50">
                        {/* macOS Window Header */}
                        <div className="flex h-10 items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4">
                          <div className="h-3 w-3 rounded-full bg-red-400"></div>
                          <div className="h-3 w-3 rounded-full bg-amber-400"></div>
                          <div className="h-3 w-3 rounded-full bg-emerald-400"></div>
                        </div>
                        {/* Image Container */}
                        <div className="relative w-full bg-slate-50">
                          <img
                            src={step.img}
                            alt={step.title}
                            className="w-full h-auto block"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Support Section */}
      <footer className="border-t border-slate-200 bg-white py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            Ready to explore?
          </h3>
          <p className="mt-4 text-lg text-slate-600">
            You now have a complete mastery of the platform. Dive in and start generating climate insights.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/" className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 shadow-md">
              Open Map Explorer
            </Link>
            <Link href="/methodology" className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm">
              Read Methodology
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
