import { ALL_LINES, ALL_MONTHS, ALL_PRODUCTS, GammesData, KPIResult, LineId, MonthlyCHMap, MonthKey, OuvertureLignesData, PDPData, Schedule } from "../data/types";

export function computeTO(lignes: OuvertureLignesData, annualize = false): Record<LineId, number> {
  const result = {} as Record<LineId, number>;
  for (const line of ALL_LINES) {
    const p = lignes[line];
    result[line] = p.weeks * p.coeff * p.shifts * p.days * p.hours * (annualize ? 12 : 1);
  }
  return result;
}

export function computeCH(schedule: Schedule): Record<LineId, number> {
  const ch = Object.fromEntries(ALL_LINES.map((l) => [l, 0])) as Record<LineId, number>;
  for (const sl of schedule.lots) {
    for (const op of sl.scheduledOps) {
      ch[op.lineId] += op.productionTime + op.cleaningTime;
    }
  }
  return ch;
}

export function computeMonthlyCH(schedule: Schedule): MonthlyCHMap {
  const result = Object.fromEntries(
    ALL_MONTHS.map((m) => [
      m,
      Object.fromEntries(ALL_LINES.map((l) => [l, 0])) as Record<LineId, number>,
    ])
  ) as MonthlyCHMap;

  for (const sl of schedule.lots) {
    const month = sl.lot.month as MonthKey;
    for (const op of sl.scheduledOps) {
      result[month][op.lineId] += op.productionTime + op.cleaningTime;
    }
  }
  return result;
}

export function computeMonthlyTO(lignes: OuvertureLignesData): Record<LineId, number> {
  return computeTO(lignes, false);
}

/** Compute monthly CH per line directly from PDP × Gammes — no scheduler required. */
export function computeMonthlyCHFromPDP(pdp: PDPData, gammes: GammesData): MonthlyCHMap {
  const result = Object.fromEntries(
    ALL_MONTHS.map((m) => [
      m,
      Object.fromEntries(ALL_LINES.map((l) => [l, 0])) as Record<LineId, number>,
    ])
  ) as MonthlyCHMap;

  for (const product of ALL_PRODUCTS) {
    const gamme = gammes[product];
    if (!gamme) continue;
    for (const month of ALL_MONTHS) {
      const batches = pdp[product]?.[month] ?? 0;
      if (batches === 0) continue;
      for (const line of ALL_LINES) {
        const prod = gamme.production[line] ?? 0;
        const clean = gamme.cleaning[line] ?? 0;
        result[month][line] += batches * (prod + clean);
      }
    }
  }
  return result;
}

export function computeKPIs(
  schedule: Schedule,
  lignes: OuvertureLignesData
): KPIResult {
  const N = schedule.lots.length;
  const zeros = Object.fromEntries(ALL_LINES.map((l) => [l, 0])) as Record<LineId, number>;

  if (N === 0) {
    return {
      otd: 100,
      occupation: { ...zeros },
      tardiness: {},
      avgTardiness: 0,
      maxTardiness: 0,
      availableCapacity: { ...zeros },
    };
  }

  const to = computeTO(lignes, true);
  const ch = computeCH(schedule);

  // KPI 1: OTD
  const onTime = schedule.lots.filter(
    (sl) => sl.completionTime <= sl.lot.dueDate
  ).length;
  const otd = (onTime / N) * 100;

  // KPI 2: Occupation rate per line
  const occupation = Object.fromEntries(
    ALL_LINES.map((line) => [
      line,
      to[line] > 0 ? (ch[line] / to[line]) * 100 : 0,
    ])
  ) as Record<LineId, number>;

  // KPI 3: Tardiness per lot
  const tardiness: Record<string, number> = {};
  for (const sl of schedule.lots) {
    tardiness[sl.lot.id] = Math.max(0, sl.completionTime - sl.lot.dueDate);
  }
  const tardinessValues = Object.values(tardiness);
  const avgTardiness =
    tardinessValues.reduce((s, v) => s + v, 0) / N;
  const maxTardiness =
    tardinessValues.length > 0 ? Math.max(...tardinessValues) : 0;

  // KPI 4: Available capacity per line
  const availableCapacity = Object.fromEntries(
    ALL_LINES.map((line) => [line, to[line] - ch[line]])
  ) as Record<LineId, number>;

  return { otd, occupation, tardiness, avgTardiness, maxTardiness, availableCapacity };
}
