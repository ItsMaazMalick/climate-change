"""
Canonical catalogue of the World Bank CCKP CMIP6 x0.25 data collection.

Everything the pipeline and the web application know about the shape of the
upstream archive lives here.  The values were verified empirically against
``s3://wbg-cckp`` and ``https://cckpapi.worldbank.org/cckp/v1``.

Two access paths exist for the same underlying data:

* **Gridded NetCDF** on S3 — 0.25 degree global fields, one file per
  (variable, model+scenario, product, aggregation, percentile, period).
  This is what powers the map.
* **Aggregate JSON API** — spatially averaged values for a geography code
  (e.g. ``PAK``).  This is what powers headline numbers and lets the web app
  answer queries for combinations that were never rasterised locally.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

S3_BASE = "https://wbg-cckp.s3.amazonaws.com"
API_BASE = "https://cckpapi.worldbank.org/cckp/v1"

COLLECTION = "cmip6-x0.25"

# --------------------------------------------------------------------------
# Scenarios
# --------------------------------------------------------------------------

Scenario = Literal["historical", "ssp119", "ssp126", "ssp245", "ssp370", "ssp585"]

SSP_SCENARIOS: tuple[Scenario, ...] = ("ssp119", "ssp126", "ssp245", "ssp370", "ssp585")
ALL_SCENARIOS: tuple[Scenario, ...] = ("historical",) + SSP_SCENARIOS


# --------------------------------------------------------------------------
# Periods
# --------------------------------------------------------------------------

#: CCKP's reference climatology.  Every anomaly in the collection is expressed
#: relative to this window.
REFERENCE_PERIOD = "1995-2014"

FUTURE_PERIODS: tuple[str, ...] = ("2020-2039", "2040-2059", "2060-2079", "2080-2099")
ALL_PERIODS: tuple[str, ...] = (REFERENCE_PERIOD,) + FUTURE_PERIODS

#: Continuous time-series ranges (used by the ``timeseries`` product).
TIMESERIES_RANGE = {"historical": "1950-2014", "ssp": "2015-2100"}


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------

#: The 30 individual GCM realisations CCKP downscales, plus the ensemble.
#: Keys are the S3/API model codes; values are the display labels.
MODELS: dict[str, str] = {
    "ensemble-all": "Multi-model ensemble",
    "access-cm2-r1i1p1f1": "ACCESS-CM2",
    "access-esm1-5-r1i1p1f1": "ACCESS-ESM1-5",
    "bcc-csm2-mr-r1i1p1f1": "BCC-CSM2-MR",
    "canesm5-r1i1p1f1": "CanESM5",
    "cmcc-esm2-r1i1p1f1": "CMCC-ESM2",
    "cnrm-cm6-1-r1i1p1f2": "CNRM-CM6-1",
    "cnrm-esm2-1-r1i1p1f2": "CNRM-ESM2-1",
    "ec-earth3-r1i1p1f1": "EC-Earth3",
    "ec-earth3-veg-lr-r1i1p1f1": "EC-Earth3-Veg-LR",
    "fgoals-g3-r3i1p1f1": "FGOALS-g3",
    "gfdl-cm4-r1i1p1f1": "GFDL-CM4",
    "gfdl-esm4-r1i1p1f1": "GFDL-ESM4",
    "giss-e2-1-g-r1i1p1f2": "GISS-E2-1-G",
    "hadgem3-gc31-ll-r1i1p1f3": "HadGEM3-GC31-LL",
    "hadgem3-gc31-mm-r1i1p1f3": "HadGEM3-GC31-MM",
    "inm-cm4-8-r1i1p1f1": "INM-CM4-8",
    "inm-cm5-0-r1i1p1f1": "INM-CM5-0",
    "ipsl-cm6a-lr-r1i1p1f1": "IPSL-CM6A-LR",
    "kace-1-0-g-r1i1p1f1": "KACE-1-0-G",
    "kiost-esm-r1i1p1f1": "KIOST-ESM",
    "miroc6-r1i1p1f1": "MIROC6",
    "miroc-es2l-r1i1p1f2": "MIROC-ES2L",
    "mpi-esm1-2-hr-r1i1p1f1": "MPI-ESM1-2-HR",
    "mpi-esm1-2-lr-r1i1p1f1": "MPI-ESM1-2-LR",
    "mri-esm2-0-r1i1p1f1": "MRI-ESM2-0",
    "nesm3-r1i1p1f1": "NESM3",
    "noresm2-lm-r1i1p1f1": "NorESM2-LM",
    "noresm2-mm-r1i1p1f1": "NorESM2-MM",
    "taiesm1-r1i1p1f1": "TaiESM1",
    "ukesm1-0-ll-r1i1p1f2": "UKESM1-0-LL",
}

ENSEMBLE = "ensemble-all"


# --------------------------------------------------------------------------
# Variables
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Variable:
    code: str
    label: str
    unit: str
    #: ``temperature`` | ``precipitation`` | ``heat`` | ``drought`` | ``flood``
    #: | ``cryosphere`` | ``agriculture`` | ``energy`` | ``wind`` | ``humidity``
    family: str
    #: Anomalies for rate-like variables are more meaningful in percent.
    anomaly_unit: str | None = None
    description: str = ""
    #: ``True`` when higher values mean a worse outcome (drives map colouring).
    higher_is_worse: bool = True


VARIABLES: dict[str, Variable] = {
    v.code: v
    for v in (
        # --- temperature -------------------------------------------------
        Variable("tas", "Average temperature", "°C", "temperature",
                 description="Mean near-surface air temperature."),
        Variable("tasmax", "Maximum temperature", "°C", "temperature",
                 description="Mean of daily maximum near-surface air temperature."),
        Variable("tasmin", "Minimum temperature", "°C", "temperature",
                 description="Mean of daily minimum near-surface air temperature."),
        Variable("txx", "Hottest day (TXx)", "°C", "temperature",
                 description="Annual maximum of daily maximum temperature."),
        Variable("tnn", "Coldest night (TNn)", "°C", "temperature",
                 description="Annual minimum of daily minimum temperature."),
        # --- heat --------------------------------------------------------
        Variable("hd30", "Days above 30°C", "days", "heat"),
        Variable("hd35", "Hot days (>35°C)", "days", "heat",
                 description="Days with maximum temperature above 35°C."),
        Variable("hd40", "Very hot days (>40°C)", "days", "heat",
                 description="Days with maximum temperature above 40°C."),
        Variable("hd42", "Days above 42°C", "days", "heat"),
        Variable("hd45", "Days above 45°C", "days", "heat"),
        Variable("hd50", "Days above 50°C", "days", "heat"),
        Variable("tr", "Tropical nights", "days", "heat",
                 description="Nights with minimum temperature above 20°C."),
        Variable("tr23", "Nights above 23°C", "days", "heat"),
        Variable("tr26", "Nights above 26°C", "days", "heat"),
        Variable("tr29", "Nights above 29°C", "days", "heat"),
        Variable("wsdi", "Warm spell duration", "days", "heat",
                 description="Annual count of days in spells of ≥6 days above the "
                             "90th percentile of the 1995–2014 baseline."),
        Variable("csdi", "Cold spell duration", "days", "heat", higher_is_worse=False),
        Variable("hi35", "Heat index >35°C", "days", "heat",
                 description="Days where the heat index (temperature combined with "
                             "humidity) exceeds 35°C."),
        Variable("hi37", "Heat index >37°C", "days", "heat"),
        Variable("hi39", "Heat index >39°C", "days", "heat"),
        Variable("hi41", "Heat index >41°C", "days", "heat"),
        Variable("wbt", "Wet-bulb temperature", "°C", "heat"),
        Variable("wbt27", "Wet-bulb days >27°C", "days", "heat"),
        Variable("wbt29", "Wet-bulb days >29°C", "days", "heat"),
        Variable("wbt31", "Wet-bulb days >31°C", "days", "heat",
                 description="Days above the widely cited 31°C wet-bulb threshold "
                             "for dangerous heat stress."),
        Variable("swbgt", "Wet-bulb globe temperature", "°C", "heat"),
        Variable("swbgt32", "WBGT days >32°C", "days", "heat"),
        # --- precipitation ------------------------------------------------
        Variable("pr", "Precipitation", "mm", "precipitation",
                 anomaly_unit="%", higher_is_worse=False,
                 description="Total precipitation."),
        Variable("prpercnt", "Precipitation change", "%", "precipitation",
                 higher_is_worse=False),
        Variable("rx1day", "Max 1-day rainfall", "mm", "flood",
                 description="Largest single-day precipitation total."),
        Variable("rx5day", "Max 5-day rainfall", "mm", "flood",
                 description="Largest 5-consecutive-day precipitation total — the "
                             "classic riverine-flood proxy."),
        Variable("rxmonth", "Wettest month", "mm", "precipitation"),
        Variable("r10mm", "Days ≥10 mm", "days", "precipitation"),
        Variable("r20mm", "Days ≥20 mm", "days", "flood"),
        Variable("r50mm", "Days ≥50 mm", "days", "flood"),
        Variable("r95p", "Very wet day threshold", "mm", "flood"),
        Variable("r95ptot", "Rain from very wet days", "mm", "flood",
                 description="Precipitation falling on days above the 95th "
                             "percentile of the baseline."),
        Variable("r99ptot", "Rain from extremely wet days", "mm", "flood"),
        Variable("sdii", "Rainfall intensity", "mm/day", "flood",
                 description="Mean precipitation on wet days."),
        Variable("d5mm", "Days ≥5 mm", "days", "precipitation", higher_is_worse=False),
        # --- drought ------------------------------------------------------
        Variable("cdd", "Consecutive dry days", "days", "drought",
                 description="Longest run of days with less than 1 mm of rain."),
        Variable("cwd", "Consecutive wet days", "days", "drought",
                 higher_is_worse=False),
        Variable("spei12", "Drought index (SPEI-12)", "index", "drought",
                 higher_is_worse=False,
                 description="12-month Standardised Precipitation-Evapotranspiration "
                             "Index; negative values indicate drier conditions."),
        Variable("esi", "Evaporative stress index", "index", "drought"),
        # --- cryosphere -----------------------------------------------------
        Variable("sd", "Snow depth", "mm", "cryosphere", higher_is_worse=False,
                 description="Snow water equivalent — critical for Indus flow."),
        Variable("fd", "Frost days", "days", "cryosphere", higher_is_worse=False),
        Variable("id", "Ice days", "days", "cryosphere", higher_is_worse=False),
        # --- agriculture ------------------------------------------------------
        Variable("gsl", "Growing season length", "days", "agriculture",
                 higher_is_worse=False),
        Variable("gslstart", "Growing season start", "day of year", "agriculture"),
        Variable("gslend", "Growing season end", "day of year", "agriculture"),
        Variable("etopen", "Reference evapotranspiration", "mm", "agriculture"),
        # --- energy ------------------------------------------------------
        Variable("cdd65", "Cooling degree days", "°C-days", "energy",
                 description="Cooling demand proxy, base 65°F / 18.3°C."),
        Variable("hdd65", "Heating degree days", "°C-days", "energy",
                 higher_is_worse=False),
        # --- other -------------------------------------------------------
        Variable("hurs", "Relative humidity", "%", "humidity"),
        Variable("sfcwind", "Wind speed", "m/s", "wind"),
        Variable("sfcwindx", "Maximum wind speed", "m/s", "wind"),
        Variable("rsds", "Solar radiation", "W/m²", "energy", higher_is_worse=False),
    )
}


# --------------------------------------------------------------------------
# Products / aggregations / statistics
# --------------------------------------------------------------------------

Product = Literal["climatology", "anomaly", "timeseries", "natvar", "trend"]
Aggregation = Literal["annual", "seasonal", "monthly"]
Percentile = Literal["mean", "median", "p10", "p90"]

#: Percentiles the ensemble is published at.  Individual models only carry
#: ``mean`` (a percentile across models is meaningless for a single model).
ENSEMBLE_PERCENTILES: tuple[Percentile, ...] = ("median", "p10", "p90")
MODEL_PERCENTILES: tuple[Percentile, ...] = ("mean",)


# --------------------------------------------------------------------------
# Pakistan extent
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class BBox:
    lon_min: float
    lat_min: float
    lon_max: float
    lat_max: float


#: Generous bounding box covering Pakistan including Azad Jammu & Kashmir and
#: Gilgit-Baltistan, snapped outward to the 0.25 degree grid.
PAKISTAN_BBOX = BBox(lon_min=60.5, lat_min=23.5, lon_max=78.0, lat_max=37.25)

#: Bounding box covering Uzbekistan, snapped outward to the 0.25 degree grid.
UZBEKISTAN_BBOX = BBox(lon_min=56.0, lat_min=37.0, lon_max=73.25, lat_max=45.75)

COUNTRY_BBOXES: dict[str, BBox] = {
    "PAK": PAKISTAN_BBOX,
    "UZB": UZBEKISTAN_BBOX,
}

GRID_RESOLUTION = 0.25


# --------------------------------------------------------------------------
# URL construction
# --------------------------------------------------------------------------


def model_scenario_key(model: str, scenario: str) -> str:
    """S3 directory segment, e.g. ``ensemble-all-ssp245``."""
    return f"{model}-{scenario}"


def netcdf_key(
    *,
    variable: str,
    model: str,
    scenario: str,
    product: Product = "climatology",
    aggregation: Aggregation = "annual",
    statistic: str = "mean",
    percentile: Percentile = "median",
    period: str = REFERENCE_PERIOD,
) -> str:
    """
    Build the S3 object key for a gridded field.

    The archive's convention is::

        {product}-{variable}-{aggregation}-{statistic}_{collection}
            _{model}-{scenario}_{producttype}_{percentile}_{period}.nc

    where ``producttype`` is ``timeseries`` for the timeseries product and
    ``climatology`` for everything else.
    """
    ms = model_scenario_key(model, scenario)
    product_type = "timeseries" if product == "timeseries" else "climatology"
    stem = f"{product}-{variable}-{aggregation}-{statistic}"
    name = f"{stem}_{COLLECTION}_{ms}_{product_type}_{percentile}_{period}.nc"
    return f"data/{COLLECTION}/{variable}/{ms}/{name}"


def netcdf_url(**kwargs) -> str:
    return f"{S3_BASE}/{netcdf_key(**kwargs)}"


def api_url(
    *,
    geography: str = "PAK",
    variable: str = "tas",
    product: Product = "climatology",
    aggregation: Aggregation = "annual",
    period: str = REFERENCE_PERIOD,
    percentile: Percentile = "median",
    scenario: str = "ssp245",
    model: str = ENSEMBLE,
    statistic: str = "mean",
) -> str:
    """
    Build a CCKP aggregate-API URL.

    The 11-slot path is::

        {collection}_{type}_{variable}_{product}_{aggregation}_{period}
            _{percentile}_{scenario}_{model}_{modelcalc}_{statistic}

    ``model``/``modelcalc`` is ``ensemble``/``all`` for the multi-model
    ensemble and ``{gcm}``/``{variant}`` for a single realisation — so the
    S3 code ``access-cm2-r1i1p1f1`` becomes ``access-cm2_r1i1p1f1`` here.
    """
    if model == ENSEMBLE:
        model_code, model_calc = "ensemble", "all"
    else:
        model_code, _, model_calc = model.rpartition("-")
    product_type = "timeseries" if product == "timeseries" else "climatology"
    slug = "_".join(
        [
            COLLECTION,
            product_type,
            variable,
            product,
            aggregation,
            period,
            percentile,
            scenario,
            model_code,
            model_calc,
            statistic,
        ]
    )
    return f"{API_BASE}/{slug}/{geography}?_format=json"


__all__ = [
    "API_BASE",
    "S3_BASE",
    "COLLECTION",
    "ALL_PERIODS",
    "ALL_SCENARIOS",
    "BBox",
    "ENSEMBLE",
    "ENSEMBLE_PERCENTILES",
    "FUTURE_PERIODS",
    "GRID_RESOLUTION",
    "MODELS",
    "MODEL_PERCENTILES",
    "PAKISTAN_BBOX",
    "REFERENCE_PERIOD",
    "SSP_SCENARIOS",
    "TIMESERIES_RANGE",
    "VARIABLES",
    "Variable",
    "api_url",
    "netcdf_key",
    "netcdf_url",
]
