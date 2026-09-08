import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  aggregateCells,
  assertEnsemblePercentile,
  cellAt,
  cellCentre,
  cycleAt,
  layerAt,
  layerCount,
  layerForMonth,
  fieldSlug,
  nearestValued,
  type GridField,
  type GridGeometry,
} from "@/lib/climate/grid";

const geometry: GridGeometry = {
  lonMin: 60.375,
  latMin: 23.375,
  resolution: 0.25,
  nLon: 71,
  nLat: 56,
  cellCount: 71 * 56,
};

function makeField(values: Array<number | null>, significance?: Array<number | null>): GridField {
  return {
    spec: {
      variable: "tas", model: "ensemble-all", scenario: "ssp245",
      product: "anomaly", aggregation: "annual", percentile: "median",
      period: "2040-2059", statistic: "mean",
    },
    source: "test",
    units: "°C",
    grid: geometry,
    stats: { count: 0, min: null, max: null, mean: null },
    values,
    significance: significance ?? null,
  };
}

describe("grid indexing", () => {
  it("round-trips a coordinate through its cell", () => {
    const cell = cellAt(geometry, 73.05, 33.68)!;
    const centre = cellCentre(geometry, cell.index);
    expect(Math.abs(centre.lon - 73.05)).toBeLessThanOrEqual(0.125);
    expect(Math.abs(centre.lat - 33.68)).toBeLessThanOrEqual(0.125);
  });

  it("indexes row-major from the south-west corner", () => {
    const southWest = cellAt(geometry, geometry.lonMin + 0.01, geometry.latMin + 0.01)!;
    expect(southWest.index).toBe(0);

    const oneRowUp = cellAt(geometry, geometry.lonMin + 0.01, geometry.latMin + 0.26)!;
    expect(oneRowUp.index).toBe(geometry.nLon);
  });

  it("rejects coordinates outside the lattice", () => {
    expect(cellAt(geometry, 40, 33)).toBeNull();
    expect(cellAt(geometry, 73, 50)).toBeNull();
  });
});

describe("nearestValued", () => {
  it("returns the containing cell when it has data", () => {
    const values = new Array<number | null>(geometry.cellCount).fill(null);
    const target = cellAt(geometry, 73.05, 33.68)!;
    values[target.index] = 21.1;

    const hit = nearestValued(makeField(values), 73.05, 33.68)!;
    expect(hit.value).toBe(21.1);
    expect(hit.offsetCells).toBe(0);
  });

  it("walks outward when the containing cell is masked", () => {
    // A coastal or border point can land on a cell the model masks out.
    // Reporting "no data" for Gwadar would be worse than reporting the
    // neighbouring cell and saying how far away it is.
    const values = new Array<number | null>(geometry.cellCount).fill(null);
    const target = cellAt(geometry, 73.05, 33.68)!;
    values[target.index + 1] = 22.5;

    const hit = nearestValued(makeField(values), 73.05, 33.68)!;
    expect(hit.value).toBe(22.5);
    expect(hit.offsetCells).toBe(1);
  });

  it("gives up rather than reaching arbitrarily far", () => {
    const values = new Array<number | null>(geometry.cellCount).fill(null);
    expect(nearestValued(makeField(values), 73.05, 33.68)).toBeNull();
  });
});

describe("aggregateCells", () => {
  it("ignores masked cells in the mean", () => {
    const values: Array<number | null> = [10, null, 20, 30];
    const stats = aggregateCells(makeField(values), [0, 1, 2, 3]);
    expect(stats.mean).toBe(20);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
    expect(stats.cellsWithData).toBe(3);
    expect(stats.cellsTotal).toBe(4);
  });

  it("reports no mean rather than zero when nothing has data", () => {
    const stats = aggregateCells(makeField([null, null]), [0, 1]);
    expect(stats.mean).toBeNull();
    expect(stats.cellsWithData).toBe(0);
  });

  it("scores agreement from the significance classification", () => {
    // Class 2 is "models conflict on the sign"; anything else counts as a
    // robust signal.
    const stats = aggregateCells(makeField([1, 2, 3, 4], [1, 2, 1, 1]), [0, 1, 2, 3]);
    expect(stats.agreement).toBe(0.75);
  });

  it("reports unknown agreement when the field carries no classification", () => {
    const stats = aggregateCells(makeField([1, 2]), [0, 1]);
    expect(stats.agreement).toBeNull();
  });
});

describe("fieldSlug", () => {
  it("matches the filename the pipeline writes", () => {
    expect(
      fieldSlug({
        variable: "tas", product: "anomaly", aggregation: "annual",
        scenario: "ssp245", model: "ensemble-all", percentile: "median",
        period: "2040-2059",
      }),
    ).toBe("tas_anomaly_annual_ssp245_ensemble-all_median_2040-2059");
  });
});

describe("assertEnsemblePercentile", () => {
  it("allows any percentile for the ensemble", () => {
    expect(() => assertEnsemblePercentile("ensemble-all", "p90")).not.toThrow();
    expect(() => assertEnsemblePercentile("ensemble-all", "median")).not.toThrow();
  });

  it("allows the mean for an individual model", () => {
    expect(() => assertEnsemblePercentile("canesm5-r1i1p1f1", "mean")).not.toThrow();
  });

  it("rejects a cross-model percentile of a single model as a bad request", () => {
    // Classified as bad_request rather than unsupported_combination: the
    // quantity does not exist, so handlers that tolerate archive sparsity
    // must still surface this one.
    try {
      assertEnsemblePercentile("canesm5-r1i1p1f1", "p90");
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("bad_request");
      expect((error as ApiError).status).toBe(400);
    }
  });
});

describe("layered fields", () => {
  const size = geometry.nLat * geometry.nLon;

  function makeMonthly(): GridField {
    // Twelve stacked lattices; each layer is filled with its month number so
    // a slicing bug is immediately visible rather than plausible.
    const values: Array<number | null> = [];
    for (let month = 1; month <= 12; month += 1) {
      for (let cell = 0; cell < size; cell += 1) values.push(month);
    }
    return {
      ...makeField(values),
      times: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      nTime: 12,
    };
  }

  it("treats an annual field as a single layer", () => {
    const field = makeField(new Array(size).fill(1));
    expect(layerCount(field)).toBe(1);
    expect(layerAt(field, 0)).toBe(field);
  });

  it("slices a monthly field into the requested layer", () => {
    const field = makeMonthly();
    expect(layerCount(field)).toBe(12);
    const july = layerAt(field, 6);
    expect(july.values).toHaveLength(size);
    expect(july.values[0]).toBe(7);
    expect(july.nTime).toBe(1);
  });

  it("clamps an out-of-range layer rather than reading past the array", () => {
    const field = makeMonthly();
    expect(layerAt(field, 99).values[0]).toBe(12);
    expect(layerAt(field, -5).values[0]).toBe(1);
  });

  it("maps a month number to its layer index", () => {
    const field = makeMonthly();
    expect(layerForMonth(field, 7)).toBe(6);
    expect(layerForMonth(field, 13)).toBeNull();
  });

  it("reads the full seasonal cycle at one cell", () => {
    const cycle = cycleAt(makeMonthly(), 42);
    expect(cycle).toHaveLength(12);
    expect(cycle.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(cycle.map((p) => p.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("recomputes stats for the sliced layer, not the whole stack", () => {
    const march = layerAt(makeMonthly(), 2);
    expect(march.stats.min).toBe(3);
    expect(march.stats.max).toBe(3);
    expect(march.stats.count).toBe(size);
  });
});
