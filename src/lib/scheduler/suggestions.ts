import {
  ALL_LINES,
  ALL_MONTHS,
  GammesData,
  LigneParams,
  LineId,
  MonthKey,
  MONTH_LABELS,
  OuvertureLignesData,
  PDPData,
} from "@/lib/data/types";
import { LIGNE_CONSTRAINTS, clampLigneParam } from "@/lib/data/constraints";
import { computeMonthlyCHFromPDP, computeMonthlyTO } from "./metrics";

export interface Suggestion {
  line: LineId;
  severity: "warning" | "critical";
  peakMonth: MonthKey;
  peakOccupation: number;       // current %
  targetOccupation: number;     // after fix %
  currentParams: LigneParams;
  suggestedParams: LigneParams;
  currentTO: number;
  suggestedTO: number;
  affectedMonths: MonthKey[];
}

function computeLineTO(params: LigneParams): number {
  return params.weeks * params.coeff * params.shifts * params.days * params.hours;
}

/**
 * For an overloaded line, find the minimum parameter changes
 * (least disruptive first) that bring peak occupation ≤ 85%.
 *
 * Priority order: shifts → days → weeks → coeff
 */
function suggestParams(
  currentParams: LigneParams,
  peakCH: number
): LigneParams {
  const targetTO = peakCH / 0.85;
  const suggested: LigneParams = { ...currentParams };

  // 1. Try increasing shifts (least disruptive)
  for (
    let s = suggested.shifts;
    s <= LIGNE_CONSTRAINTS.shifts.max;
    s += LIGNE_CONSTRAINTS.shifts.step
  ) {
    suggested.shifts = clampLigneParam("shifts", s);
    if (computeLineTO(suggested) >= targetTO) return suggested;
  }
  suggested.shifts = LIGNE_CONSTRAINTS.shifts.max;

  // 2. Try increasing days
  for (
    let d = suggested.days;
    d <= LIGNE_CONSTRAINTS.days.max;
    d += LIGNE_CONSTRAINTS.days.step
  ) {
    suggested.days = clampLigneParam("days", d);
    if (computeLineTO(suggested) >= targetTO) return suggested;
  }
  suggested.days = LIGNE_CONSTRAINTS.days.max;

  // 3. Try increasing weeks
  for (
    let w = suggested.weeks;
    w <= LIGNE_CONSTRAINTS.weeks.max;
    w = Math.round((w + LIGNE_CONSTRAINTS.weeks.step) * 10) / 10
  ) {
    suggested.weeks = clampLigneParam("weeks", w);
    if (computeLineTO(suggested) >= targetTO) return suggested;
  }
  suggested.weeks = LIGNE_CONSTRAINTS.weeks.max;

  // 4. Try increasing coeff (efficiency improvement)
  for (
    let c = suggested.coeff;
    c <= LIGNE_CONSTRAINTS.coeff.max;
    c = Math.round((c + LIGNE_CONSTRAINTS.coeff.step) * 100) / 100
  ) {
    suggested.coeff = clampLigneParam("coeff", c);
    if (computeLineTO(suggested) >= targetTO) return suggested;
  }
  suggested.coeff = LIGNE_CONSTRAINTS.coeff.max;

  return suggested;
}

/**
 * Detect overloaded lines and generate parameter change suggestions.
 *
 * For each line, finds all months where occupation > 85%. If any exist,
 * a suggestion is generated that adjusts parameters to bring peak occupation
 * down to ≤ 85%.
 */
export function detectSuggestions(
  pdp: PDPData,
  gammes: GammesData,
  lignes: OuvertureLignesData
): Suggestion[] {
  const monthlyCH = computeMonthlyCHFromPDP(pdp, gammes);
  const monthlyTO = computeMonthlyTO(lignes);
  const suggestions: Suggestion[] = [];

  for (const line of ALL_LINES) {
    const to = monthlyTO[line];
    if (to <= 0) continue;

    let peakCH = 0;
    let peakMonth: MonthKey = "jan";
    let peakOcc = 0;
    const affectedMonths: MonthKey[] = [];

    for (const month of ALL_MONTHS) {
      const ch = monthlyCH[month][line];
      const occ = (ch / to) * 100;
      if (occ > 85) {
        affectedMonths.push(month);
      }
      if (ch > peakCH) {
        peakCH = ch;
        peakMonth = month;
        peakOcc = occ;
      }
    }

    if (affectedMonths.length === 0) continue;

    const severity: "warning" | "critical" = peakOcc > 100 ? "critical" : "warning";
    const currentParams = { ...lignes[line] };
    const suggestedParams = suggestParams(currentParams, peakCH);
    const suggestedTO = computeLineTO(suggestedParams);
    const targetOcc = suggestedTO > 0 ? (peakCH / suggestedTO) * 100 : 0;

    suggestions.push({
      line,
      severity,
      peakMonth,
      peakOccupation: Math.round(peakOcc * 10) / 10,
      targetOccupation: Math.round(targetOcc * 10) / 10,
      currentParams,
      suggestedParams,
      currentTO: Math.round(to * 100) / 100,
      suggestedTO: Math.round(suggestedTO * 100) / 100,
      affectedMonths,
    });
  }

  // Sort: critical first, then by peak occupation descending
  suggestions.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.peakOccupation - a.peakOccupation;
  });

  return suggestions;
}
