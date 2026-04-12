import {
  ALL_LINES,
  GammesData,
  LineId,
  Lot,
  MonthKey,
  Operation,
  PDPData,
  ProductId,
  Schedule,
  ScheduledLot,
  ScheduledOperation,
  SchedulingRule,
} from "../data/types";
import { sortLots } from "./heuristics";

// Hours offset from Jan 1 2026 00:00 UTC for the start of each month
const MONTH_START_HOURS: Record<MonthKey, number> = {
  jan: 0,
  feb: 31 * 24,
  mar: (31 + 28) * 24,
  apr: (31 + 28 + 31) * 24,
  may: (31 + 28 + 31 + 30) * 24,
  jun: (31 + 28 + 31 + 30 + 31) * 24,
  jul: (31 + 28 + 31 + 30 + 31 + 30) * 24,
  aug: (31 + 28 + 31 + 30 + 31 + 30 + 31) * 24,
  sep: (31 + 28 + 31 + 30 + 31 + 30 + 31 + 31) * 24,
  oct: (31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30) * 24,
  nov: (31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31) * 24,
  dec: (31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 30) * 24,
};

const MONTH_DAYS: Record<MonthKey, number> = {
  jan: 31, feb: 28, mar: 31, apr: 30, may: 31, jun: 30,
  jul: 31, aug: 31, sep: 30, oct: 31, nov: 30, dec: 31,
};

function monthDueDate(month: MonthKey): number {
  return MONTH_START_HOURS[month] + MONTH_DAYS[month] * 24;
}

export function generateLots(pdp: PDPData, gammes: GammesData): Lot[] {
  const lots: Lot[] = [];

  for (const productEntry of Object.entries(pdp)) {
    const productId = productEntry[0] as ProductId;
    const months = productEntry[1];
    const gamme = gammes[productId];
    if (!gamme) continue;

    // Build operations in line order A→J, only for lines with production > 0
    const operations: Operation[] = ALL_LINES
      .filter((line) => (gamme.production[line] ?? 0) > 0)
      .map((line) => ({
        lineId: line,
        productionTime: gamme.production[line] as number,
        cleaningTime: gamme.cleaning[line] ?? 0,
      }));

    if (operations.length === 0) continue;

    for (const monthEntry of Object.entries(months)) {
      const month = monthEntry[0] as MonthKey;
      const quantity = monthEntry[1];
      if (quantity <= 0) continue;

      const dueDate = monthDueDate(month);

      for (let i = 1; i <= quantity; i++) {
        lots.push({
          id: `${productId}-${month}-${i}`,
          productId,
          month,
          dueDate,
          operations,
        });
      }
    }
  }

  return lots;
}

export function dispatch(lots: Lot[], rule: SchedulingRule): Schedule {
  // GA_OPTIMIZED lots arrive pre-ordered; all other rules sort here
  const orderedLots = rule === "GA_OPTIMIZED" ? lots : sortLots(lots, rule, 0);

  // Track the earliest hour each line becomes available
  const lineAvailableAt: Record<LineId, number> = {
    A: 0, B: 0, C: 0, D: 0, E: 0,
    F: 0, G: 0, H: 0, I: 0, J: 0,
  };

  const scheduledLots: ScheduledLot[] = orderedLots.map((lot) => {
    let prevOpEndTime = 0;

    const scheduledOps: ScheduledOperation[] = lot.operations.map((op) => {
      const startTime = Math.max(lineAvailableAt[op.lineId], prevOpEndTime);
      const endTime = startTime + op.productionTime;

      // Line is blocked until production ends + cleaning is done
      lineAvailableAt[op.lineId] = endTime + op.cleaningTime;
      prevOpEndTime = endTime;

      return { ...op, startTime, endTime };
    });

    const completionTime =
      scheduledOps.length > 0
        ? scheduledOps[scheduledOps.length - 1].endTime
        : 0;

    return { lot, completionTime, scheduledOps };
  });

  const makespan =
    scheduledLots.length > 0
      ? Math.max(...scheduledLots.map((sl) => sl.completionTime))
      : 0;

  return {
    rule,
    lots: scheduledLots,
    makespan,
    generatedAt: new Date().toISOString(),
  };
}

export function runScheduler(
  pdp: PDPData,
  gammes: GammesData,
  rule: SchedulingRule
): Schedule {
  const lots = generateLots(pdp, gammes);
  return dispatch(lots, rule);
}
