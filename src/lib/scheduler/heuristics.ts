import { Lot, SchedulingRule } from "../data/types";

function totalProductionTime(lot: Lot): number {
  return lot.operations.reduce((sum, op) => sum + op.productionTime, 0);
}

export function sortLots(
  lots: Lot[],
  rule: SchedulingRule,
  now: number = 0
): Lot[] {
  const sorted = [...lots];

  switch (rule) {
    case "SPT":
      return sorted.sort(
        (a, b) => totalProductionTime(a) - totalProductionTime(b)
      );

    case "EDD":
      return sorted.sort((a, b) => a.dueDate - b.dueDate);

    case "CR": {
      return sorted.sort((a, b) => {
        const remaining_a = totalProductionTime(a) || 1;
        const remaining_b = totalProductionTime(b) || 1;
        const cr_a = (a.dueDate - now) / remaining_a;
        const cr_b = (b.dueDate - now) / remaining_b;
        return cr_a - cr_b;
      });
    }

    case "LPT":
      return sorted.sort(
        (a, b) => totalProductionTime(b) - totalProductionTime(a)
      );

    default:
      return sorted;
  }
}
