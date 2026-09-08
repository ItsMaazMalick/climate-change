#!/usr/bin/env node
/**
 * Generate cell-index JSON files for Australia and New Zealand.
 * Pre-computes which grid cells fall within each state/region.
 * Run: node scripts/gen-cell-index.js
 */

const fs = require("fs");
const path = require("path");

const GEO_DIR = path.join(__dirname, "../public/geo");

// ---- AUS Grid ----
const AUS_GRID = { lonMin: 112.0, latMin: -44.0, resolution: 0.25, nLon: 168, nLat: 139 };

// ---- NZL Grid ----
const NZL_GRID = { lonMin: 166.0, latMin: -47.5, resolution: 0.25, nLon: 51, nLat: 57 };

const AUS_STATES = [
  { id: "nsw", lonMin: 140.9, latMin: -37.5, lonMax: 153.6, latMax: -28.2 },
  { id: "vic", lonMin: 140.9, latMin: -39.2, lonMax: 149.7, latMax: -33.9 },
  { id: "qld", lonMin: 137.9, latMin: -29.0, lonMax: 153.6, latMax: -10.0 },
  { id: "sa",  lonMin: 128.9, latMin: -38.1, lonMax: 141.0, latMax: -25.9 },
  { id: "wa",  lonMin: 112.0, latMin: -35.2, lonMax: 129.0, latMax: -13.7 },
  { id: "tas", lonMin: 143.8, latMin: -43.7, lonMax: 148.5, latMax: -39.6 },
  { id: "nt",  lonMin: 128.9, latMin: -26.0, lonMax: 138.0, latMax: -10.9 },
  { id: "act", lonMin: 148.7, latMin: -35.9, lonMax: 149.4, latMax: -35.1 },
];

const NZL_REGIONS = [
  { id: "northland",          lonMin: 172.7, latMin: -36.0, lonMax: 174.6, latMax: -34.4 },
  { id: "auckland",           lonMin: 174.5, latMin: -37.3, lonMax: 175.3, latMax: -36.0 },
  { id: "waikato",            lonMin: 174.5, latMin: -38.7, lonMax: 176.5, latMax: -37.3 },
  { id: "bay-of-plenty",      lonMin: 175.5, latMin: -38.5, lonMax: 178.0, latMax: -37.0 },
  { id: "gisborne",           lonMin: 177.5, latMin: -39.0, lonMax: 178.5, latMax: -37.5 },
  { id: "hawkes-bay",         lonMin: 176.0, latMin: -40.0, lonMax: 178.0, latMax: -38.5 },
  { id: "taranaki",           lonMin: 173.5, latMin: -40.0, lonMax: 175.0, latMax: -38.7 },
  { id: "manawatu-whanganui", lonMin: 174.5, latMin: -40.8, lonMax: 176.5, latMax: -38.7 },
  { id: "wellington",         lonMin: 174.7, latMin: -41.6, lonMax: 176.2, latMax: -40.8 },
  { id: "tasman",             lonMin: 172.0, latMin: -42.5, lonMax: 173.8, latMax: -40.7 },
  { id: "nelson",             lonMin: 173.0, latMin: -41.6, lonMax: 174.0, latMax: -41.0 },
  { id: "marlborough",        lonMin: 173.5, latMin: -42.0, lonMax: 174.5, latMax: -41.0 },
  { id: "west-coast",         lonMin: 166.5, latMin: -44.5, lonMax: 172.0, latMax: -41.5 },
  { id: "canterbury",         lonMin: 170.5, latMin: -44.5, lonMax: 174.2, latMax: -42.0 },
  { id: "otago",              lonMin: 168.0, latMin: -46.5, lonMax: 171.5, latMax: -44.0 },
  { id: "southland",          lonMin: 166.0, latMin: -47.5, lonMax: 170.0, latMax: -45.5 },
];

function buildCellIndex(grid, regions) {
  const index = {};
  for (const region of regions) {
    index[region.id] = [];
  }

  for (let r = 0; r < grid.nLat; r++) {
    const lat = grid.latMin + (r + 0.5) * grid.resolution;
    for (let c = 0; c < grid.nLon; c++) {
      const lon = grid.lonMin + (c + 0.5) * grid.resolution;
      const cellIdx = r * grid.nLon + c;

      for (const region of regions) {
        if (
          lat >= region.latMin &&
          lat <= region.latMax &&
          lon >= region.lonMin &&
          lon <= region.lonMax
        ) {
          index[region.id].push(cellIdx);
          break; // assign to first matching region (no overlap)
        }
      }
    }
  }
  return index;
}

const ausIndex = buildCellIndex(AUS_GRID, AUS_STATES);
const nzlIndex = buildCellIndex(NZL_GRID, NZL_REGIONS);

const ausCounts = Object.entries(ausIndex).map(([k, v]) => `${k}: ${v.length} cells`).join(", ");
const nzlCounts = Object.entries(nzlIndex).map(([k, v]) => `${k}: ${v.length} cells`).join(", ");

fs.writeFileSync(path.join(GEO_DIR, "aus-states-cells.json"), JSON.stringify(ausIndex), "utf8");
fs.writeFileSync(path.join(GEO_DIR, "nzl-regions-cells.json"), JSON.stringify(nzlIndex), "utf8");

console.log(`✓ aus-states-cells.json: ${ausCounts}`);
console.log(`✓ nzl-regions-cells.json: ${nzlCounts}`);
console.log("\nCell index files generated successfully.");
