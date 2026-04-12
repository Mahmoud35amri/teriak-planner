import {
  ALL_LINES,
  ALL_MONTHS,
  ALL_PRODUCTS,
  LignesOverrides,
  LineId,
  MonthKey,
  OuvertureLignesData,
  PDPData,
  PDPOverrides,
  ProductId,
} from "./types";

// ---- Immutable merge: base + sparse overrides → full data ----

export function mergePDP(base: PDPData, overrides: PDPOverrides | null): PDPData {
  if (!overrides) return base;

  const result = { ...base };
  for (const pid of ALL_PRODUCTS) {
    if (overrides[pid]) {
      result[pid] = { ...base[pid], ...overrides[pid] };
    }
  }
  return result;
}

export function mergeLignes(
  base: OuvertureLignesData,
  overrides: LignesOverrides | null
): OuvertureLignesData {
  if (!overrides) return base;

  const result = { ...base };
  for (const lid of ALL_LINES) {
    if (overrides[lid]) {
      result[lid] = { ...base[lid], ...overrides[lid] };
    }
  }
  return result;
}

// ---- Extract only changed cells (for storage) ----

export function diffPDP(base: PDPData, modified: PDPData): PDPOverrides {
  const diff: PDPOverrides = {};
  for (const pid of ALL_PRODUCTS) {
    for (const m of ALL_MONTHS) {
      if (modified[pid][m] !== base[pid][m]) {
        if (!diff[pid]) diff[pid] = {};
        diff[pid]![m] = modified[pid][m];
      }
    }
  }
  return diff;
}

export function diffLignes(
  base: OuvertureLignesData,
  modified: OuvertureLignesData
): LignesOverrides {
  const diff: LignesOverrides = {};
  const keys = ["weeks", "coeff", "shifts", "days", "hours"] as const;
  for (const lid of ALL_LINES) {
    for (const k of keys) {
      if (modified[lid][k] !== base[lid][k]) {
        if (!diff[lid]) diff[lid] = {};
        (diff[lid] as Record<string, number>)[k] = modified[lid][k];
      }
    }
  }
  return diff;
}

// ---- Count changes (for badges) ----

export function countPDPChanges(overrides: PDPOverrides | null): number {
  if (!overrides) return 0;
  let count = 0;
  for (const pid of Object.keys(overrides) as ProductId[]) {
    count += Object.keys(overrides[pid] ?? {}).length;
  }
  return count;
}

export function countLignesChanges(overrides: LignesOverrides | null): LineId[] {
  if (!overrides) return [];
  return Object.keys(overrides).filter(
    (lid) => Object.keys(overrides[lid as LineId] ?? {}).length > 0
  ) as LineId[];
}

// ---- Describe overrides for comparison table ----

export function describePDPOverrides(
  overrides: PDPOverrides | null,
  basePdp: PDPData
): string {
  if (!overrides || countPDPChanges(overrides) === 0) return "Base";
  const parts: string[] = [];
  for (const pid of Object.keys(overrides) as ProductId[]) {
    for (const m of Object.keys(overrides[pid] ?? {}) as MonthKey[]) {
      const oldVal = basePdp[pid]?.[m] ?? 0;
      const newVal = overrides[pid]![m]!;
      parts.push(`${pid} ${m}: ${oldVal}→${newVal}`);
    }
  }
  return parts.join(", ");
}

export function describeLignesOverrides(
  overrides: LignesOverrides | null,
  baseLignes: OuvertureLignesData
): string {
  if (!overrides || countLignesChanges(overrides).length === 0) return "Base";
  const parts: string[] = [];
  const keys = ["weeks", "coeff", "shifts", "days", "hours"] as const;
  for (const lid of Object.keys(overrides) as LineId[]) {
    const ov = overrides[lid];
    if (!ov) continue;
    for (const k of keys) {
      if (ov[k] !== undefined) {
        const oldVal = baseLignes[lid]?.[k] ?? "?";
        parts.push(`${lid}: ${k} ${oldVal}→${ov[k]}`);
      }
    }
  }
  return parts.join(", ");
}
