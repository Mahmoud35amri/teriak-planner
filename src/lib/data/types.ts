// ---- Core Teriak Data Types ----

export type ProductId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8"
  | "P9"
  | "P10"
  | "P11"
  | "P12"
  | "P13";

export type LineId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type MonthKey =
  | "jan"
  | "feb"
  | "mar"
  | "apr"
  | "may"
  | "jun"
  | "jul"
  | "aug"
  | "sep"
  | "oct"
  | "nov"
  | "dec";

export const ALL_LINES: LineId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const ALL_PRODUCTS: ProductId[] = [
  "P1", "P2", "P3", "P4", "P5", "P6", "P7",
  "P8", "P9", "P10", "P11", "P12", "P13",
];
export const ALL_MONTHS: MonthKey[] = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "Janvier", feb: "Février", mar: "Mars", apr: "Avril",
  may: "Mai", jun: "Juin", jul: "Juillet", aug: "Août",
  sep: "Septembre", oct: "Octobre", nov: "Novembre", dec: "Décembre",
};

// PDP: batches per product per month
export type PDPData = Record<ProductId, Record<MonthKey, number>>;

// Gammes: production + cleaning hours per product per line
export interface GammeEntry {
  production: Partial<Record<LineId, number>>;
  cleaning: Partial<Record<LineId, number>>;
}
export type GammesData = Record<ProductId, GammeEntry>;

// Ouverture Lignes: capacity parameters per line
export interface LigneParams {
  weeks: number;    // Nbre_sem
  coeff: number;    // Coeff_rendement
  shifts: number;   // Nbre_postes/j
  days: number;     // Nbre_j/sem
  hours: number;    // Heures/poste
}
export type OuvertureLignesData = Record<LineId, LigneParams>;

// ---- Scheduling Types ----

export type SchedulingRule = "SPT" | "EDD" | "CR" | "LPT" | "GA_OPTIMIZED";

export interface Lot {
  id: string;         // e.g. "P1-jan-1"
  productId: ProductId;
  month: MonthKey;
  dueDate: number;    // hours from epoch (end of planned month)
  operations: Operation[];
}

export interface Operation {
  lineId: LineId;
  productionTime: number;
  cleaningTime: number;
}

export interface ScheduledOperation extends Operation {
  startTime: number;  // hours from epoch
  endTime: number;
}

export interface ScheduledLot {
  lot: Lot;
  completionTime: number;
  scheduledOps: ScheduledOperation[];
}

export interface Schedule {
  rule: SchedulingRule;
  lots: ScheduledLot[];
  makespan: number;
  generatedAt: string;
  gaImprovement?: number; // % makespan reduction vs EDD baseline (GA_OPTIMIZED only)
}

// Monthly charge breakdown
export type MonthlyCHMap = Record<MonthKey, Record<LineId, number>>;

// ---- KPI Types ----

export interface KPIResult {
  otd: number;                          // % on-time delivery
  occupation: Record<LineId, number>;   // % per line
  tardiness: Record<string, number>;    // hours per lot
  avgTardiness: number;
  maxTardiness: number;
  availableCapacity: Record<LineId, number>; // hours per line
}

// ---- What-If Override Types ----

/** Sparse overrides for PDP quantities — only changed cells */
export type PDPOverrides = Partial<Record<ProductId, Partial<Record<MonthKey, number>>>>;

/** Sparse overrides for Lignes capacity — only changed lines/params */
export type LignesOverrides = Partial<Record<LineId, Partial<LigneParams>>>;
