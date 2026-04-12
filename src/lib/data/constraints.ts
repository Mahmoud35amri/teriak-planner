import { LigneParams } from "./types";

/**
 * Hard constraints for Ouverture Lignes parameters.
 * Single source of truth — used by: proposals form, lignes editor,
 * API validation, and suggestion engine.
 */
export const LIGNE_CONSTRAINTS = {
  weeks:  { min: 0.1, max: 4.2, step: 0.1, fixed: false },
  coeff:  { min: 0.01, max: 1,  step: 0.01, fixed: false },
  shifts: { min: 1,   max: 3,   step: 1,    fixed: false },
  days:   { min: 1,   max: 7,   step: 1,    fixed: false },
  hours:  { min: 7,   max: 7,   step: 1,    fixed: true  },
} as const;

export type LigneParamKey = keyof typeof LIGNE_CONSTRAINTS;

const PARAM_KEYS = Object.keys(LIGNE_CONSTRAINTS) as LigneParamKey[];

/**
 * Clamp a single parameter value to its hard constraint range,
 * rounded to the correct step.
 */
export function clampLigneParam(key: LigneParamKey, value: number): number {
  const c = LIGNE_CONSTRAINTS[key];
  if (c.fixed) return c.min;
  const clamped = Math.min(c.max, Math.max(c.min, value));
  // Round to step
  const rounded = Math.round(clamped / c.step) * c.step;
  // Avoid floating-point drift
  const decimals = c.step < 1 ? (c.step.toString().split(".")[1]?.length ?? 0) : 0;
  return parseFloat(rounded.toFixed(decimals));
}

/**
 * Validate a full set of LigneParams against hard constraints.
 * Returns { valid, errors } — errors list specific problems for UI/API feedback.
 */
export function validateLigneParams(
  params: Partial<LigneParams>,
  lineLabel?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const prefix = lineLabel ? `Atelier ${lineLabel}: ` : "";

  for (const key of PARAM_KEYS) {
    const val = params[key];
    if (val === undefined) continue;
    const c = LIGNE_CONSTRAINTS[key];

    if (typeof val !== "number" || isNaN(val)) {
      errors.push(`${prefix}${key} doit être un nombre valide`);
      continue;
    }
    if (c.fixed && val !== c.min) {
      errors.push(`${prefix}${key} est fixé à ${c.min}`);
    }
    if (val < c.min) {
      errors.push(`${prefix}${key} minimum = ${c.min} (reçu: ${val})`);
    }
    if (val > c.max) {
      errors.push(`${prefix}${key} maximum = ${c.max} (reçu: ${val})`);
    }
  }

  return { valid: errors.length === 0, errors };
}
