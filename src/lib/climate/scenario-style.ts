import { SCENARIOS, type ScenarioId } from "./taxonomy";

/**
 * A scenario's colour, label and forcing descriptor come from one place. The
 * colour is the locked IPCC AR6 SSP palette, exposed as a CSS variable so
 * charts, tables, legends, dots and map layers all read the same token — never
 * a local override.
 */
const SSP_VAR: Record<ScenarioId, string> = {
  historical: "var(--ssp-historical)",
  ssp119: "var(--ssp-119)",
  ssp126: "var(--ssp-126)",
  ssp245: "var(--ssp-245)",
  ssp370: "var(--ssp-370)",
  ssp585: "var(--ssp-585)",
};

export function scenarioColorVar(id: ScenarioId): string {
  return SSP_VAR[id] ?? "var(--ink-faint)";
}

export function scenarioMeta(id: ScenarioId) {
  const s = SCENARIOS[id];
  return {
    id,
    label: s.label,
    family: s.family,
    forcingDescriptor: s.forcingDescriptor,
    globalWarming2100: s.globalWarming2100,
    color: SSP_VAR[id],
  };
}
