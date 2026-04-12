/**
 * Shared color utility for occupation percentage thresholds.
 * Single source of truth — used by ChargeClient, MonthDrilldownChart, and KPIClient.
 */
export function occupationColor(pct: number): string {
  if (pct > 85) return "#EF4444";
  if (pct > 70) return "#F59E0B";
  return "#22C55E";
}
