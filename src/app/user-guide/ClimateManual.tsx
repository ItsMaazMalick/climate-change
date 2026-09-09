"use client";
import React, { useState, useEffect } from 'react';
import {
  Home, BookOpen, Rocket, Map, Scale, Flame, MapPin, Library, Microscope, HelpCircle, Phone,
  Check, RefreshCw, BarChart2, Lightbulb, Search, Target, Building, SunDim, TrendingUp,
  Thermometer, Ruler, Radio, Settings, AlertTriangle, Globe, Building2, Mail, MessageCircle,
  Menu, X
} from 'lucide-react';

export default function ClimateManual() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      let current = 'hero';
      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (window.scrollY >= sectionTop - 150) {
          current = section.getAttribute('id') || 'hero';
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setIsSidebarOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const navItems = [
    { id: 'hero', icon: Home, label: 'Home' },
    { id: 'introduction', icon: BookOpen, label: 'Introduction' },
    { id: 'getting-started', icon: Rocket, label: 'Getting Started' },
    { id: 'explorer', icon: Map, label: 'Explorer' },
    { id: 'compare', icon: Scale, label: 'Compare' },
    { id: 'hotspots', icon: Flame, label: 'Hotspots' },
    { id: 'places', icon: MapPin, label: 'Places' },
    { id: 'learn', icon: Library, label: 'Learn' },
    { id: 'methodology', icon: Microscope, label: 'Methodology' },
    { id: 'faq', icon: HelpCircle, label: 'FAQ' },
    { id: 'support', icon: Phone, label: 'Support' },
  ];

  const faqs = [
    { q: "What is CMIP6?", a: "CMIP6 (Coupled Model Intercomparison Project Phase 6) is the latest generation of global climate model experiments, including output from 100+ models worldwide, used by the IPCC Sixth Assessment Report." },
    { q: "What are SSP pathways?", a: "Shared Socioeconomic Pathways (SSPs) represent different global futures. SSP1-1.9 assumes aggressive cuts. SSP2-4.5 represents current trends. SSP5-8.5 assumes fossil-fuel intensive growth. The gap shows the impact of policy choices." },
    { q: "How accurate are the projections?", a: "Projections are not forecasts. They show how climate could change under specific emissions. Models agree well on temperature but less on precipitation. The uncertainty panel shows how much models disagree." },
    { q: "What does Relative Change mean?", a: "The difference from the 1995-2014 baseline. +2.1°C means the future 20-year average is 2.1°C warmer. Toggle to Absolute Value for actual physical values." },
    { q: "Can I compare two scenarios?", a: "Yes! Use the Compare page for side-by-side views. The Explorer right panel also shows All Policy Pathways comparison for any clicked point." },
    { q: "What is the Ensemble Median?", a: "The middle value across 30 downscaled GCM models. Minimizes individual model bias and is the recommended default. You can also select individual models." }
  ];

  return (
    <div className="font-sans text-ink bg-surface-recessed min-h-screen overflow-x-hidden antialiased">

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-surface-panel border border-border rounded-(--radius-control) shadow-md flex items-center justify-center text-ink"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Navigation */}
      <nav className={`fixed top-0 left-0 h-screen w-72 bg-surface-panel border-r border-border z-40 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-border">
          <div className="flex flex-col items-start gap-2">
            <img src="/images/ess_logo.webp" alt="Earth Scan Systems" className="w-[150px] h-auto object-contain" />
            <div className="ml-1 text-brand text-base font-semibold tracking-tight">Climate Intelligence Explorer</div>
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => scrollTo(e, item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-(--radius-control) text-sm font-semibold transition-colors ${isActive
 ? 'bg-leaf-soft text-brand border border-leaf/20'
                    : 'text-ink-faint hover:bg-surface-recessed hover:text-ink'
                    }`}
                >
                  <Icon size={18} className={isActive ? 'text-brand' : 'text-ink-faint'} />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="p-5 border-t border-border text-xs font-medium text-ink-faint">
          &copy; 2026 Earth Scan Systems
        </div>
      </nav>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-surface-inverse/40 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-72 flex flex-col min-h-screen">

        {/* HERO SECTION */}
        <section id="hero" className="relative px-6 md:px-12 pt-32 pb-24 bg-surface-panel border-b border-border flex items-center min-h-[500px] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,_rgba(22,163,74,0.08)_0%,_transparent_40%),radial-gradient(circle_at_0%_100%,_rgba(234,88,12,0.05)_0%,_transparent_40%)]" />
          <div className="relative z-10 max-w-4xl">
            <div className="inline-block px-3 py-1 mb-6 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint uppercase">
              USER MANUAL
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-ink mb-6">
              Climate Intelligence <span className="text-brand">Explorer</span>
            </h1>
            <p className="text-lg text-ink-muted font-medium max-w-2xl mb-10 leading-relaxed">
              Your complete guide to exploring CMIP6 climate projections across Uzbekistan, Pakistan, Australia &amp; New Zealand &mdash; by location and emissions pathway.
            </p>

            <div className="flex flex-wrap items-center gap-6 p-5 bg-surface-recessed border border-border rounded-(--radius-container) mb-10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">Version</span>
                <span className="text-sm font-semibold font-mono text-ink-muted">1.0</span>
              </div>
              <div className="hidden sm:block w-px h-8 bg-surface-active" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">Data</span>
                <span className="text-sm font-semibold font-mono text-ink-muted">CMIP6 0.25&deg;</span>
              </div>
              <div className="hidden sm:block w-px h-8 bg-surface-active" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">Models</span>
                <span className="text-sm font-semibold font-mono text-ink-muted">30 GCMs</span>
              </div>
              <div className="hidden sm:block w-px h-8 bg-surface-active" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">By</span>
                <span className="text-sm font-semibold font-mono text-ink-muted">Earth Scan Systems</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a href="#explorer" onClick={(e) => scrollTo(e, 'explorer')} className="inline-flex items-center justify-center px-7 py-3 rounded-(--radius-control) text-sm font-semibold text-white bg-brand hover:bg-brand-deep shadow-[0_2px_8px_rgba(22,163,74,0.25)] hover:shadow-[0_4px_12px_rgba(22,163,74,0.3)] transition-all">
                Explore Features
              </a>
              <a href="https://ess-climate-change.vercel.app/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center px-7 py-3 rounded-(--radius-control) text-sm font-semibold text-ink-muted bg-surface-panel border border-border hover:bg-surface-recessed hover:border-border-strong shadow-(--elevation-flat) hover:-translate-y-px transition-all">
                Open Platform
              </a>
            </div>
          </div>
        </section>

        {/* INTRODUCTION */}
        <section id="introduction" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">OVERVIEW</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">What is Climate Intelligence Explorer?</h2>
            <p className="text-base text-ink-faint font-medium">High-resolution climate projections, made accessible.</p>
          </div>

          {/* Walkthrough video */}
          <figure className="relative z-10 mb-16 mx-auto">
            <div className="overflow-hidden rounded-(--radius-container) border border-border bg-surface-inverse shadow-(--elevation-overlay)">
              <div className="relative aspect-video w-full">
                <iframe
                  src="https://drive.google.com/file/d/12KEbFiGuHW6lVME7oPijfj_YIHrjzyek/preview"
                  title="Climate Intelligence platform walkthrough"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
            <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-faint">
              <span className="inline-flex items-center gap-2 font-semibold text-ink-muted">
                <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
                Video walkthrough
              </span>
              <span>
                Watch the platform end to end, then use the illustrated guide below as reference.
              </span>
            </figcaption>
          </figure>

          <div className="bg-surface-panel rounded-(--radius-container) p-8 md:p-10 shadow-(--elevation-flat) border border-border">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="text-ink-muted text-sm md:text-base leading-relaxed space-y-5">
                <p>
                  The <strong>Climate Intelligence Explorer</strong> is a web platform by Earth Scan Systems that lets you explore how climate could change at any location across <strong>Uzbekistan</strong>, <strong>Pakistan</strong>, <strong>Australia</strong> and <strong>New Zealand</strong> under different CMIP6 emissions pathways.
                </p>
                <p>
                  Click anywhere on the map, select a climate indicator, choose an SSP scenario and time horizon &mdash; and instantly see baseline values, projected changes, multi-model uncertainty and cross-scenario comparisons.
                </p>
                <div className="flex flex-col gap-3 pt-4">
                  {[
                    "16 climate indicators — temperature, heat stress, precipitation, drought, energy demand",
                    "5 SSP emissions pathways (SSP1-1.9 to SSP5-8.5)",
                    "30 downscaled GCM models + ensemble median",
                    "5 time horizons from baseline (1995-2014) to end-of-century (2080-2099)",
                    "Province/district-level aggregation with hotspot ranking"
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-3 font-medium text-ink-muted text-sm">
                      <Check className="text-brand mt-0.5 shrink-0" size={18} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-ink border-b border-border pb-3 mb-5">Platform Pages</h3>
                <div className="space-y-2">
                  {[
                    { icon: Map, title: "Explorer", desc: "Interactive map with raster overlays and point queries" },
                    { icon: Scale, title: "Compare", desc: "Side-by-side scenario and region comparison" },
                    { icon: Flame, title: "Hotspots", desc: "Ranked list of most-affected provinces and districts" },
                    { icon: MapPin, title: "Places", desc: "Pre-built city profiles with weather forecasts" },
                    { icon: Library, title: "Learn", desc: "How to read climate projections" },
                    { icon: Microscope, title: "Methodology", desc: "Data sources, pipeline, and limitations" }
                  ].map((page, i) => (
                    <div key={i} className="flex items-start gap-4 p-3.5 rounded-(--radius-control) hover:bg-surface-recessed border border-transparent hover:border-border transition-colors">
                      <div className="w-10 h-10 rounded-(--radius-control) bg-surface-panel border border-border shadow-(--elevation-flat) flex items-center justify-center text-brand shrink-0">
                        <page.icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink mb-0.5">{page.title}</h4>
                        <p className="text-xs text-ink-faint">{page.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GETTING STARTED */}
        <section id="getting-started" className="py-20 px-6 md:px-12 bg-surface-panel border-y border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">SETUP</span>
              <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Getting Started</h2>
              <p className="text-base text-ink-faint font-medium">No installation needed &mdash; just open and explore.</p>
            </div>

            <div className="relative pl-10 md:pl-12">
              <div className="absolute left-[19px] md:left-[23px] top-0 bottom-0 w-0.5 bg-surface-active" />

              {[
                { title: "Open the Platform", desc: <>Navigate to <a href="https://ess-climate-change.vercel.app/" target="_blank" rel="noreferrer" className="text-brand font-semibold hover:underline underline-offset-2">ess-climate-change.vercel.app</a> in any modern browser. Works on desktop, tablet, and mobile.</> },
                { title: "Select a Country", desc: "Use the country switcher in the header to toggle between Uzbekistan, Pakistan, Australia, and New Zealand." },
                { title: "Pick a Climate Indicator", desc: "Choose from 16 indicators grouped into: Temperature, Heat & Heat Stress, Precipitation, Heavy Rainfall, Dryness & Drought, and Energy Demand." },
                { title: "Choose an Emissions Pathway", desc: "Select one of 5 SSP scenarios &mdash; from SSP1-1.9 (very low, 1.0-1.8°C) to SSP5-8.5 (very high, 3.3-5.7°C)." },
                { title: "Click on the Map", desc: "Click anywhere on the map to query that location. The right panel shows baseline values, projected values, change, model uncertainty, and all-pathway comparisons." }
              ].map((step, i) => (
                <div key={i} className="relative mb-10 last:mb-0">
                  <div className="absolute -left-[50px] md:-left-[58px] top-0 w-10 h-10 md:w-11 md:h-11 bg-surface-panel border-2 border-leaf text-brand rounded-full flex items-center justify-center font-semibold text-sm font-mono shadow-[0_0_0_4px_#f8fafc] z-10">
                    {i + 1}
                  </div>
                  <div className="bg-surface-panel p-6 md:p-7 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h3 className="text-base font-semibold text-ink mb-2">{step.title}</h3>
                    <p className="text-sm text-ink-faint font-medium leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EXPLORER */}
        <section id="explorer" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">CORE FEATURE</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Explorer &mdash; Interactive Climate Map</h2>
            <p className="text-base text-ink-faint font-medium">Click anywhere to see how its climate could change.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                <img src="/images/01-explorer-map.jpeg" alt="Explorer map" className="w-full rounded-(--radius-container) border border-border" />
              </div>
              <span className="block text-center text-xs text-ink-faint font-mono">Figure 1 &mdash; Explorer Map with climate projection overlay</span>
            </div>

            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">The Explorer Interface</h3>
              <p className="text-sm text-ink-faint font-medium mb-6">The Explorer is the main page. It combines an interactive map with a control sidebar and data panel.</p>

              <div className="space-y-4">
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Map size={18} className="text-brand" /> Interactive Raster Map</h4>
                  <p className="text-sm text-ink-faint font-medium">The central map displays color-coded raster at 0.25&deg; resolution (~25 km). Major cities are labeled. Click any point to query its data. Use zoom controls to navigate.</p>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Settings size={18} className="text-brand" /> Left Sidebar Controls</h4>
                  <ul className="space-y-2 text-sm text-ink-muted">
                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span><strong>Target Coordinate / City</strong> &mdash; Search bar</span></li>
                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span><strong>Climate Indicator</strong> &mdash; 16 scientific variables</span></li>
                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span><strong>Emissions Pathway (SSP)</strong> &mdash; 5 scenario buttons</span></li>
                    <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span><strong>Time Horizon</strong> &mdash; 5 periods from baseline to 2080-2099</span></li>
                  </ul>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><TrendingUp size={18} className="text-brand" /> Right Data Panel</h4>
                  <p className="text-sm text-ink-faint font-medium">Shows: Baseline value (1995-2014), Projected value, Change (&Delta;), Multi-Model Uncertainty (10th-90th percentile), and All Policy Pathways comparison.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARE */}
        <section id="compare" className="py-20 px-6 md:px-12 bg-surface-panel border-y border-border w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">ANALYSIS</span>
              <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Compare &mdash; Side-by-Side Analysis</h2>
              <p className="text-base text-ink-faint font-medium">Compare scenarios, regions, and indicators in one view.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">Comparing Climate Futures</h3>
                <p className="text-sm text-ink-faint font-medium mb-6">The Compare page puts two different climate scenarios side by side.</p>

                <div className="space-y-4">
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Scale size={18} className="text-brand" /> Dual Panel Layout</h4>
                    <p className="text-sm text-ink-faint font-medium">View two configurations simultaneously &mdash; e.g., SSP1-2.6 vs SSP5-8.5, or same scenario for two cities. Each panel has independent controls.</p>
                  </div>
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><BarChart2 size={18} className="text-brand" /> Visual Comparison</h4>
                    <p className="text-sm text-ink-faint font-medium">Both panels use the same color scale. The gap between scenarios shows the part of the future still determined by policy choices.</p>
                  </div>
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Lightbulb size={18} className="text-brand" /> Use Cases</h4>
                    <ul className="space-y-2 text-sm text-ink-muted">
                      <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span>Compare low-emissions vs high-emissions future</span></li>
                      <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span>Compare mid-century vs end-of-century</span></li>
                      <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" /><span>Compare two different regions under same scenario</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                  <img src="/images/02-compare-view.jpeg" alt="Compare View" className="w-full rounded-(--radius-container) border border-border" />
                </div>
                <span className="block text-center text-xs text-ink-faint font-mono">Figure 2 &mdash; Compare View</span>
              </div>
            </div>
          </div>
        </section>

        {/* HOTSPOTS */}
        <section id="hotspots" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">RISK ANALYSIS</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Hotspots &mdash; Most Affected Areas</h2>
            <p className="text-base text-ink-faint font-medium">Ranked list of provinces and districts by projected climate change.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                <img src="/images/03-hotspots.jpeg" alt="Hotspots Ranking" className="w-full rounded-(--radius-container) border border-border" />
              </div>
              <span className="block text-center text-xs text-ink-faint font-mono">Figure 3 &mdash; Hotspots Ranking</span>
            </div>

            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">Identifying Climate Hotspots</h3>
              <p className="text-sm text-ink-faint font-medium mb-6">The Hotspots page ranks every province and district by projected climate change magnitude.</p>

              <div className="space-y-4">
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><BarChart2 size={18} className="text-brand" /> Ranked Table</h4>
                  <p className="text-sm text-ink-faint font-medium">Regions sorted by projected change. Each row shows baseline, projected value, and change magnitude with color severity indicators.</p>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Search size={18} className="text-brand" /> Filterable</h4>
                  <p className="text-sm text-ink-faint font-medium">Select any indicator and SSP pathway. Find which districts face the greatest change &mdash; e.g., most additional hot days above 40&deg;C under SSP5-8.5.</p>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Target size={18} className="text-brand" /> Decision Support</h4>
                  <p className="text-sm text-ink-faint font-medium">Helps governments and organizations prioritize climate resilience investments where needed most.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLACES */}
        <section id="places" className="py-20 px-6 md:px-12 bg-surface-panel border-y border-border w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">CITY PROFILES</span>
              <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Places &mdash; Pre-Built City Profiles</h2>
              <p className="text-base text-ink-faint font-medium">Explore climate data for major cities with weather forecasts.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">City-Level Climate Intelligence</h3>
                <p className="text-sm text-ink-faint font-medium mb-6">Pre-built profiles combining long-term projections with short-range weather data.</p>

                <div className="space-y-4">
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Building size={18} className="text-brand" /> City Quick-Select</h4>
                    <p className="text-sm text-ink-faint font-medium">Click any city name to load its profile. Includes Tashkent, Samarkand, Bukhara, Nukus, Andijan, Namangan, Fergana, and more.</p>
                  </div>
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><SunDim size={18} className="text-brand" /> Weather + Climate</h4>
                    <p className="text-sm text-ink-faint font-medium">Each profile shows short-range weather forecasts (Open-Meteo, 16 days) alongside long-term CMIP6 projections.</p>
                  </div>
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><TrendingUp size={18} className="text-brand" /> Historical Context</h4>
                    <p className="text-sm text-ink-faint font-medium">ERA5 reanalysis data (1950-present) shows what the climate has actually been, before exploring what it could become.</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                  <img src="/images/04-places.jpeg" alt="Places Profiles" className="w-full rounded-(--radius-container) border border-border" />
                </div>
                <span className="block text-center text-xs text-ink-faint font-mono">Figure 4 &mdash; Places &amp; City Profiles</span>
              </div>
            </div>
          </div>
        </section>

        {/* LEARN */}
        <section id="learn" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">EDUCATION</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Learn &mdash; Understanding Projections</h2>
            <p className="text-base text-ink-faint font-medium">How to read and interpret climate projection data.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                <img src="/images/05-learn.jpeg" alt="Learn Page" className="w-full rounded-(--radius-container) border border-border" />
              </div>
              <span className="block text-center text-xs text-ink-faint font-mono">Figure 5 &mdash; Learn Page</span>
            </div>

            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">Reading Climate Projections</h3>
              <p className="text-sm text-ink-faint font-medium mb-6">Explains key concepts to correctly interpret the data.</p>

              <div className="space-y-4">
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Thermometer size={18} className="text-brand" /> SSP Pathways Explained</h4>
                  <div className="grid gap-2">
                    {[
                      { ssp: "SSP1-1.9", color: "bg-[var(--ssp-119)]", desc: "Very low · 1.0-1.8°C" },
                      { ssp: "SSP1-2.6", color: "bg-brand-deep", desc: "Low · 1.3-2.4°C" },
                      { ssp: "SSP2-4.5", color: "bg-[var(--ssp-245)]", desc: "Intermediate · 2.1-3.5°C" },
                      { ssp: "SSP3-7.0", color: "bg-[var(--ssp-370)]", desc: "High · 2.8-4.6°C" },
                      { ssp: "SSP5-8.5", color: "bg-danger", desc: "Very high · 3.3-5.7°C" }
                    ].map(s => (
                      <div key={s.ssp} className="flex items-center gap-3 p-2.5 rounded-(--radius-control) border border-border bg-surface-recessed text-xs">
                        <div className={`w-3 h-3 rounded-full shrink-0 shadow-(--elevation-flat) ${s.color}`} />
                        <div><strong className="font-mono text-ink font-semibold mr-1">{s.ssp}</strong> &mdash; {s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Ruler size={18} className="text-brand" /> Baseline & Anomalies</h4>
                  <p className="text-sm text-ink-faint font-medium">All changes are against 1995-2014 baseline. +2.1°C means the 20-year average is projected 2.1°C warmer. It does not predict any single year.</p>
                </div>
                <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                  <h4 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><BarChart2 size={18} className="text-brand" /> Model Uncertainty</h4>
                  <p className="text-sm text-ink-faint font-medium">The 10th-90th percentile spread shows inter-model uncertainty &mdash; how much 30 climate models disagree. Narrow = high confidence.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* METHODOLOGY */}
        <section id="methodology" className="py-20 px-6 md:px-12 bg-surface-panel border-y border-border w-full">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">SCIENCE</span>
              <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Methodology &amp; Data Sources</h2>
              <p className="text-base text-ink-faint font-medium">Where the numbers come from and what they cannot tell you.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-semibold text-ink mb-3 tracking-tight">Data &amp; Processing</h3>
                <p className="text-sm text-ink-faint font-medium mb-6">Documents every data source, processing step, and known limitation.</p>

                <div className="space-y-4">
                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Radio size={18} className="text-brand" /> Three Data Sources</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-surface-recessed border border-border p-3.5 rounded-(--radius-control) text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono mb-2 bg-surface-panel border border-border text-ink-faint">PROJECTION</span>
                        <h5 className="text-xs font-semibold text-ink mb-1">CMIP6 (0.25&deg;)</h5>
                        <p className="text-[11px] text-ink-faint">World Bank CCKP &middot; 1950-2100</p>
                      </div>
                      <div className="bg-surface-recessed border border-border p-3.5 rounded-(--radius-control) text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono mb-2 bg-surface-panel border border-border text-ink-faint">OBSERVATION</span>
                        <h5 className="text-xs font-semibold text-ink mb-1">ERA5 Reanalysis</h5>
                        <p className="text-[11px] text-ink-faint">ECMWF &middot; 1950-present</p>
                      </div>
                      <div className="bg-surface-recessed border border-border p-3.5 rounded-(--radius-control) text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono mb-2 bg-surface-panel border border-border text-ink-faint">FORECAST</span>
                        <h5 className="text-xs font-semibold text-ink mb-1">Open-Meteo</h5>
                        <p className="text-[11px] text-ink-faint">Now + 16 days</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-panel p-5 rounded-(--radius-container) border border-border shadow-(--elevation-flat)">
                    <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Settings size={18} className="text-brand" /> Processing Pipeline</h4>
                    <ol className="space-y-2 text-sm text-ink-faint list-decimal pl-5">
                      <li><strong className="text-ink">Source</strong> &mdash; Global 0.25&deg; NetCDF from World Bank S3</li>
                      <li><strong className="text-ink">Subset</strong> &mdash; Clip to national bounding box</li>
                      <li><strong className="text-ink">Reduce</strong> &mdash; Flatten to stacked arrays (~11 KB/field)</li>
                      <li><strong className="text-ink">Index</strong> &mdash; Point-in-polygon for province/district aggregation</li>
                      <li><strong className="text-ink">Serve</strong> &mdash; Point queries read lattice directly</li>
                    </ol>
                  </div>

                  <div className="flex gap-4 p-5 bg-warn/10 rounded-(--radius-container) border-l-4 border-warn mt-4">
                    <AlertTriangle size={20} className="text-warn shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-ink mb-1">Key Limitations</h4>
                      <p className="text-sm text-ink-muted leading-relaxed">25 km cells cannot resolve a city. Complex terrain weakens downscaling. South Asian monsoon is a known model weakness. Twenty-year means say nothing about a given year. No crop, health, or economic models.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-surface-panel p-2 rounded-(--radius-container) shadow-(--elevation-overlay) border border-border mb-4 overflow-hidden">
                  <img src="/images/06-methodology.jpeg" alt="Methodology" className="w-full rounded-(--radius-container) border border-border" />
                </div>
                <span className="block text-center text-xs text-ink-faint font-mono">Figure 6 &mdash; Methodology &amp; Data Sources</span>
              </div>
            </div>
          </div>
        </section>

        {/* NAVIGATION GUIDE */}
        <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">NAVIGATION</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Platform Navigation</h2>
            <p className="text-base text-ink-faint font-medium">Access all features from the top header bar.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              { icon: Map, title: "Explorer", desc: "Interactive climate map with raster overlays." },
              { icon: Scale, title: "Compare", desc: "Side-by-side scenario comparisons." },
              { icon: Flame, title: "Hotspots", desc: "Most climate-affected areas ranked." },
              { icon: MapPin, title: "Places", desc: "City profiles with weather + projections." },
              { icon: Library, title: "Learn", desc: "Guide to reading climate projections." },
              { icon: Microscope, title: "Methodology", desc: "Data sources and limitations." }
            ].map((nav, i) => (
              <div key={i} className="bg-surface-panel border border-border p-6 rounded-(--radius-container) text-center shadow-(--elevation-flat) hover:shadow-(--elevation-raised) hover:-translate-y-1 hover:border-leaf transition-all duration-300">
                <nav.icon size={28} className="mx-auto mb-3 text-ink-muted" />
                <span className="block text-base font-semibold text-ink mb-1.5">{nav.title}</span>
                <p className="text-sm text-ink-faint">{nav.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-surface-recessed border border-border p-8 rounded-(--radius-container) text-center max-w-3xl mx-auto">
            <h3 className="text-base font-semibold text-ink mb-1.5">Country Switcher</h3>
            <p className="text-sm text-ink-faint mb-5">Toggle between supported countries:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="px-4 py-1.5 bg-leaf-soft text-brand border border-leaf/20 rounded-(--radius-control) text-sm font-semibold transition-colors">🇺🇿 Uzbekistan</span>
              <span className="px-4 py-1.5 bg-surface-panel text-ink-faint border border-border rounded-(--radius-control) text-sm font-semibold transition-colors">🇵🇰 Pakistan</span>
              <span className="px-4 py-1.5 bg-surface-panel text-ink-faint border border-border rounded-(--radius-control) text-sm font-semibold transition-colors">🇦🇺 Australia</span>
              <span className="px-4 py-1.5 bg-surface-panel text-ink-faint border border-border rounded-(--radius-control) text-sm font-semibold transition-colors">🇳🇿 New Zealand</span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-6 md:px-12 bg-surface-panel border-y border-border w-full">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">HELP</span>
              <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Frequently Asked Questions</h2>
              <p className="text-base text-ink-faint font-medium">Common questions answered.</p>
            </div>

            <div className="flex flex-col gap-3">
              {faqs.map((faq, index) => (
                <div key={index} className={`bg-surface-panel border rounded-(--radius-container) shadow-(--elevation-flat) transition-all duration-300 overflow-hidden ${openFaq === index ? 'border-leaf' : 'border-border'}`}>
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex justify-between items-center w-full p-5 text-left font-semibold text-[15px] text-ink"
                  >
                    <span>{faq.q}</span>
                    <span className={`text-ink-faint transition-transform duration-300 ${openFaq === index ? 'rotate-180 text-brand' : ''}`}>
                      ▼
                    </span>
                  </button>
                  <div className={`transition-all duration-300 ease-in-out ${openFaq === index ? 'max-h-96 opacity-100 pb-5 px-5' : 'max-h-0 opacity-0'}`}>
                    <p className="text-sm text-ink-muted leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SUPPORT */}
        <section id="support" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-4 bg-surface-recessed border border-border rounded-full text-xs font-semibold tracking-widest text-ink-faint font-mono">CONTACT</span>
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Need Help?</h2>
            <p className="text-base text-ink-faint font-medium">Our team is here to support you.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Globe, title: "Open Platform", desc: "Access the Climate Explorer directly.", link: "ess-climate-change.vercel.app", href: "https://ess-climate-change.vercel.app/" },
              { icon: Building2, title: "Earth Scan Systems", desc: "Visit our company website.", link: "escan-systems.com", href: "https://escan-systems.com/" },
              { icon: Mail, title: "Email Support", desc: "Contact our team.", link: "contact@escan-systems.com", href: "mailto:contact@escan-systems.com" },
              { icon: MessageCircle, title: "WhatsApp", desc: "Chat with us.", link: "+61 452 284 468", href: "https://wa.me/61452284468" }
            ].map((support, i) => (
              <a key={i} href={support.href} target="_blank" rel="noreferrer" className="flex flex-col items-center text-center bg-surface-panel border border-border p-8 rounded-(--radius-container) shadow-(--elevation-flat) hover:shadow-(--elevation-raised) hover:-translate-y-1 hover:border-leaf transition-all duration-300">
                <support.icon size={32} className="mb-4 text-ink" />
                <h3 className="text-base font-semibold text-ink mb-1.5">{support.title}</h3>
                <p className="text-sm text-ink-faint font-medium mb-4">{support.desc}</p>
                <span className="text-[13px] font-semibold font-mono text-brand">{support.link}</span>
              </a>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-surface-panel border-t border-border pt-16 px-6 md:px-12 mt-auto">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-border">
            <div className="md:col-span-6">
              <div className="flex flex-col items-start gap-3 mb-5">
                <img src="/images/ess_logo.webp" alt="Earth Scan Systems" className="w-[140px] h-auto object-contain" />
                <span className="text-[17px] font-semibold text-ink">Climate Intelligence Explorer</span>
              </div>
              <p className="text-sm text-ink-faint font-medium leading-relaxed mb-3">
                Data-driven decision support for climate adaptation.
              </p>
              <p className="text-xs text-ink-faint font-mono">
                Craigieburn, Victoria 3064, Australia &middot; DHA Phase V Sector G, Islamabad, Pakistan
              </p>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-widest text-ink mb-4 font-mono">Platform</h4>
              <div className="flex flex-col space-y-2.5">
                <a href="https://ess-climate-change.vercel.app/" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Explorer</a>
                <a href="https://ess-climate-change.vercel.app/compare" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Compare</a>
                <a href="https://ess-climate-change.vercel.app/hotspots" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Hotspots</a>
                <a href="https://ess-climate-change.vercel.app/learn" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Learn</a>
                <a href="https://ess-climate-change.vercel.app/methodology" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Methodology</a>
              </div>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-widest text-ink mb-4 font-mono">Data Sources</h4>
              <div className="flex flex-col space-y-2.5">
                <a href="https://climateknowledgeportal.worldbank.org/" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">World Bank CCKP</a>
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">Open-Meteo</a>
                <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="text-sm text-ink-faint font-medium hover:text-brand transition-colors">geoBoundaries</a>
              </div>
            </div>
          </div>

          <div className="text-center py-6 text-xs text-ink-faint font-medium">
            &copy; 2026 Earth Scan Systems. All rights reserved. | Climate Intelligence Explorer User Manual v1.0
          </div>
        </footer>

      </main>
    </div>
  );
}
