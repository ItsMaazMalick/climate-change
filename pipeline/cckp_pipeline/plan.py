"""
Extraction plans.

A *plan* is a named set of :class:`FieldSpec` records.  Plans exist so the
gridded footprint of the application can grow deliberately: ``core`` is small
enough to bundle with the repository, ``standard`` covers the indicators the
UI exposes by default, and ``full`` rasterises the entire catalogue.
"""

from __future__ import annotations

from .catalog import (
    ENSEMBLE,
    ENSEMBLE_PERCENTILES,
    FUTURE_PERIODS,
    MODELS,
    REFERENCE_PERIOD,
    SSP_SCENARIOS,
    VARIABLES,
)
from .extract import FieldSpec

#: Scenarios the UI treats as first-class.  SSP1-1.9 is published for a much
#: narrower set of variables, so it is opt-in rather than a default.
HEADLINE_SCENARIOS = ("ssp126", "ssp245", "ssp370", "ssp585")

CORE_VARIABLES = ("tas", "pr")

STANDARD_VARIABLES = (
    "tas",
    "tasmax",
    "tasmin",
    "pr",
    "hd35",
    "hd40",
    "txx",
    "tnn",
    "rx1day",
    "rx5day",
    "cdd",
    "hi35",
    "tr23",
    "sd",
    "cdd65",
    "r95ptot",
)


def _future_fields(
    variables: tuple[str, ...],
    scenarios: tuple[str, ...],
    periods: tuple[str, ...],
    percentiles: tuple[str, ...],
    products: tuple[str, ...] = ("climatology", "anomaly"),
    aggregations: tuple[str, ...] = ("annual",),
    model: str = ENSEMBLE,
) -> list[FieldSpec]:
    return [
        FieldSpec(
            variable=variable,
            model=model,
            scenario=scenario,
            product=product,
            aggregation=aggregation,
            percentile=percentile,
            period=period,
        )
        for variable in variables
        for scenario in scenarios
        for period in periods
        for product in products
        for aggregation in aggregations
        for percentile in percentiles
    ]


def _baseline_fields(
    variables: tuple[str, ...],
    aggregations: tuple[str, ...] = ("annual",),
    model: str = ENSEMBLE,
) -> list[FieldSpec]:
    """
    Historical climatology — the reference every anomaly hangs off.

    The ensemble is published at percentiles across models; an individual
    realisation only has a mean, because a cross-model percentile of one model
    is not a quantity.  Asking for the wrong one returns nothing, silently.
    """
    percentile = "median" if model == ENSEMBLE else "mean"
    return [
        FieldSpec(
            variable=variable,
            model=model,
            scenario="historical",
            product="climatology",
            aggregation=aggregation,
            percentile=percentile,
            period=REFERENCE_PERIOD,
        )
        for variable in variables
        for aggregation in aggregations
    ]


def core_plan() -> list[FieldSpec]:
    """Temperature and precipitation, ensemble median, annual — ~66 fields."""
    return _baseline_fields(CORE_VARIABLES) + _future_fields(
        CORE_VARIABLES, HEADLINE_SCENARIOS, FUTURE_PERIODS, ("median",)
    )


def uncertainty_plan() -> list[FieldSpec]:
    """p10/p90 anomaly envelopes for the two headline variables."""
    return _future_fields(
        CORE_VARIABLES,
        HEADLINE_SCENARIOS,
        FUTURE_PERIODS,
        ("p10", "p90"),
        products=("anomaly",),
    )


def seasonal_plan() -> list[FieldSpec]:
    """Monthly climatologies, used for the seasonal-cycle chart."""
    return _baseline_fields(CORE_VARIABLES, aggregations=("monthly",)) + _future_fields(
        CORE_VARIABLES,
        HEADLINE_SCENARIOS,
        FUTURE_PERIODS,
        ("median",),
        products=("climatology",),
        aggregations=("monthly",),
    )


def standard_plan() -> list[FieldSpec]:
    """Every indicator the UI ships, ensemble median, annual."""
    return _baseline_fields(STANDARD_VARIABLES) + _future_fields(
        STANDARD_VARIABLES, HEADLINE_SCENARIOS, FUTURE_PERIODS, ("median",)
    )


def models_plan(variable: str = "tas") -> list[FieldSpec]:
    """Every individual GCM for one variable — powers the model-spread map."""
    individual = tuple(code for code in MODELS if code != ENSEMBLE)
    fields: list[FieldSpec] = []
    for model in individual:
        fields += _baseline_fields((variable,), model=model)
        fields += _future_fields(
            (variable,),
            HEADLINE_SCENARIOS,
            FUTURE_PERIODS,
            ("mean",),
            model=model,
        )
    return fields


def full_plan() -> list[FieldSpec]:
    """The entire catalogue at ensemble level, all percentiles, all SSPs."""
    variables = tuple(VARIABLES)
    return _baseline_fields(variables) + _future_fields(
        variables, SSP_SCENARIOS, FUTURE_PERIODS, ENSEMBLE_PERCENTILES
    )


PLANS = {
    "core": core_plan,
    "uncertainty": uncertainty_plan,
    "seasonal": seasonal_plan,
    "standard": standard_plan,
    "models": models_plan,
    "full": full_plan,
}


def resolve(name: str) -> list[FieldSpec]:
    if name not in PLANS:
        raise KeyError(f"unknown plan {name!r}; choose from {sorted(PLANS)}")
    specs = PLANS[name]()
    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique: list[FieldSpec] = []
    for spec in specs:
        if spec.slug in seen:
            continue
        seen.add(spec.slug)
        unique.append(spec)
    return unique
