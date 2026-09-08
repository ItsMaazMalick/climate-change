# Climate Pakistan

A CMIP6 climate projection explorer for Pakistan. Pick a location, an
emissions pathway and a time horizon, and see how the climate of that place
could change — with the disagreement between models shown rather than averaged
away.

Built on the World Bank Climate Change Knowledge Portal's bias-corrected,
downscaled CMIP6 collection at 0.25° (~25 km), covering 30 global climate
models, five SSP pathways and four future 20-year windows against a 1995–2014
baseline.

---

## What it does

| Surface | Question it answers |
| --- | --- |
| **Explorer** (`/`) | What does this indicator look like across Pakistan, and what is the value where I clicked? |
| **Compare** (`/compare`) | How much of the uncertainty is the pathway, how much is the models, and how much is the horizon? |
| **Hotspots** (`/hotspots`) | Which districts and provinces change most? |
| **Places** (`/places/[id]`) | What is the whole story for one city — baseline, projection, trajectory, mechanism? |
| **Learn** (`/learn`) | What is a scenario, why do models disagree, and how do I avoid over-reading this? |
| **Methodology** (`/methodology`) | Where do the numbers come from and what can they not tell me? |

### Three datasets, deliberately kept apart

A weather forecast, an observational reanalysis and a multi-decadal projection
answer different questions with different methods. They have separate stores,
separate endpoints and separate places in the interface, and they are never
combined into one number.

```
                 CLIMATE PAKISTAN
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
  WEATHER            CLIMATE            CLIMATE
  NOWCAST            HISTORY             FUTURE
     │                  │                  │
 Open-Meteo         ERA5 / CRU          CMIP6
 hours–days         1950–present       2015–2100
                                       SSP1-1.9 … SSP5-8.5
```

---

## Architecture

Raw CMIP6 output never reaches the database. The pipeline reduces global
NetCDF rasters to the smallest artefact that can still answer a point query,
and the database stores application-ready products along the eight dimensions
every query travels.

```
World Bank CCKP (S3)            global 0.25° NetCDF, ~8 MB per field
        │
        ▼
Python pipeline                 pipeline/cckp_pipeline
        ├── download + subset to Pakistan   71 × 56 = 3,976 cells
        ├── flatten to a row-major array    ~11 KB gzipped per field
        ├── index grid cells per admin unit  7 provinces, 126 districts
        └── write data/grid/*.json.gz + manifest.json
        │
        ├──────────────► Local grid store         point queries, map fields
        │                                          sub-millisecond
        │
        └──────────────► PostgreSQL + PostGIS     area aggregates, rankings,
                          scripts/load-grid.ts     spatial joins
        │
        ▼
Next.js API layer               validation · cache · rate limit · provenance
        │
        ▼
Next.js App Router              canvas map + SVG overlays, hand-built charts
```

### Query resolution

Every climate question reduces to one shape:

```
location → dataset → model → scenario → period → variable → statistic → value
```

Three sources can answer it, and the response always says which one did:

1. **Local grid** — the only source that can answer *at a point*. Sub-millisecond.
2. **PostgreSQL/PostGIS** — area aggregates and anything needing a sort or a
   spatial join. Ranking 126 districts is one index scan here.
3. **Upstream CCKP API** — authoritative for any combination in the full
   catalogue, but national resolution only, and slow.

A country-wide mean is a different claim from a 25 km cell value. The API and
the interface never present them identically.

---

## Getting started

### Requirements

- Node.js 20.9+
- Python 3.10+ (for the extraction pipeline)
- PostgreSQL with PostGIS (optional — Neon works well)

### Setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL if you want the DB layer
npm run db:generate
```

The application runs with no database and no pipeline output: it falls back to
the upstream API and reports reduced spatial resolution honestly. To get the
map and point queries, extract a grid:

```bash
cd pipeline
python -m venv .venv && ./.venv/bin/pip install -e .
./.venv/bin/python -m cckp_pipeline.cli extract standard --workers 6
```

Then, optionally, load it into PostgreSQL:

```bash
npm run db:push     # or db:migrate for a migration history
npm run db:seed     # dimensions, admin boundaries, grid cells, PostGIS indexes
npm run db:load     # aggregate every extracted field to every admin unit
```

```bash
npm run dev
```

### Extraction plans

| Plan | Fields | What it covers |
| --- | --- | --- |
| `core` | 66 | Temperature and precipitation, ensemble median |
| `uncertainty` | 64 | p10/p90 envelopes for the headline indicators |
| `seasonal` | 34 | Monthly climatologies (12 layers per field) |
| `standard` | 528 | Every indicator the UI ships |
| `models` | 990 | All 30 individual GCMs for one variable |
| `full` | 6,897 | The entire catalogue |

`cckp plans` lists them; `cckp variables` lists the 86 indicators available
upstream.

---

## API

All endpoints return `{ data, meta }` and set a long `s-maxage` — climate
projections are immutable, so caching them hard costs nothing in accuracy.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/meta` | The full vocabulary: scenarios, models, periods, indicators, coverage |
| `GET /api/climate/point` | Baseline, projection and change at a coordinate |
| `GET /api/climate/area` | The same, aggregated over a province or district |
| `GET /api/climate/field` | A whole rasterised field for the map |
| `GET /api/climate/scenarios` | One place and horizon across every pathway |
| `GET /api/climate/models` | Ensemble spread, optionally with all 30 members |
| `GET /api/climate/trajectory` | Every pathway's annual trace, 1950–2100 |
| `GET /api/climate/series` | One pathway's trace, optionally smoothed |
| `GET /api/climate/story` | Everything for one place, with narrative and mechanisms |
| `GET /api/climate/cycle` | The monthly climatology at a point, baseline against projection |
| `GET /api/climate/rankings` | Districts or provinces ranked by projected change |
| `GET /api/weather/forecast` | Short-range weather — a separate layer, never blended |
| `GET /api/health` | Which read paths are actually working |

Example:

```bash
curl 'localhost:3000/api/climate/point?lat=33.68&lon=73.05&indicator=tas&scenario=ssp245&period=2040-2059'
```

```json
{
  "data": {
    "baseline":  { "value": 21.117, "unit": "°C", "period": "1995-2014" },
    "projected": { "value": 22.671, "unit": "°C" },
    "anomaly":   { "value": 1.586,  "unit": "°C" },
    "meta": { "source": "grid", "spatialScope": "point" }
  }
}
```

---

## What this is not

The platform reports **climate variables**. It has no hydrological, crop,
health or economic model, and makes no claim about floods, yields or mortality.
Where a physical mechanism connects a variable to a consequence, the interface
names the mechanism and states explicitly what would be required to quantify
it — and stops there.

Other limits, stated in full at `/methodology`:

- A 25 km cell cannot resolve a city. Urban heat islands and valley inversions
  operate below that scale.
- Downscaling is weakest in the Hindu Kush–Karakoram–Himalaya, where elevation
  changes by kilometres inside one cell.
- CMIP6 models disagree more on South Asian monsoon precipitation than on
  almost any other regional signal. Rainfall projections deserve markedly more
  caution than temperature ones.
- Every value is a 20-year climatology. It says nothing about a given year.
- Annual precipitation totals hide the monsoon. Roughly 60% of the country's
  rain falls in July–September, so the annual figure can hold steady while the
  shape of the year moves; use the seasonal cycle for anything rainfall-related.
- Annual time series are published as national aggregates only.

---

## Development

```bash
npm run dev          # Turbopack dev server
npm run build        # production build
npm run typecheck
npm run lint
npm test             # 73 unit tests
npm run warm         # pre-populate the response cache after a deploy
```

## Data sources and citation

- World Bank Group, *Climate Change Knowledge Portal — CMIP6 bias-corrected
  downscaled projections (0.25°)*.
- Eyring, V. et al. (2016). Overview of CMIP6 experimental design and
  organization. *Geosci. Model Dev.* 9, 1937–1958.
- O'Neill, B. C. et al. (2016). The Scenario Model Intercomparison Project
  (ScenarioMIP) for CMIP6. *Geosci. Model Dev.* 9, 3461–3482.
- IPCC (2021). *Climate Change 2021: The Physical Science Basis*. WGI to AR6.
- Runfola, D. et al. (2020). geoBoundaries: A global database of political
  administrative boundaries. *PLoS ONE* 15(4).
- Open-Meteo.com weather API (forecast layer only).
