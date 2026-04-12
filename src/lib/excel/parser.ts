import * as XLSX from "xlsx";
import {
  PDPData,
  GammesData,
  OuvertureLignesData,
  ALL_PRODUCTS,
  ALL_LINES,
  ALL_MONTHS,
  ProductId,
  LineId,
  MonthKey,
} from "@/lib/data/types";
import { DEFAULT_PDP, DEFAULT_GAMMES, DEFAULT_OUVERTURE_LIGNES } from "@/lib/data/defaults";

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function normalizeProduct(val: unknown): ProductId | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const s = String(val).trim().toUpperCase();
  if (ALL_PRODUCTS.includes(s as ProductId)) return s as ProductId;
  return null;
}

function normalizeLine(val: unknown): LineId | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const s = String(val).trim().toUpperCase();
  if (ALL_LINES.includes(s as LineId)) return s as LineId;
  return null;
}

const MONTH_ALIASES: Record<string, MonthKey> = {
  jan: "jan", janvier: "jan", january: "jan",
  feb: "feb", fev: "feb", fevrier: "feb", february: "feb",
  mar: "mar", mars: "mar", march: "mar",
  apr: "apr", avr: "apr", avril: "apr", april: "apr",
  may: "may", mai: "may",
  jun: "jun", juin: "jun", june: "jun",
  jul: "jul", juil: "jul", juillet: "jul", july: "jul",
  aug: "aug", aou: "aug", aout: "aug", august: "aug",
  sep: "sep", septembre: "sep", september: "sep",
  oct: "oct", octobre: "oct", october: "oct",
  nov: "nov", novembre: "nov", november: "nov",
  dec: "dec", decembre: "dec", december: "dec",
};

function normalizeMonth(val: unknown): MonthKey | null {
  if (typeof val !== "string") return null;
  const s = val.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  return MONTH_ALIASES[s] ?? null;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Find a sheet by name fragment (case-insensitive). Returns -1 if not found. */
function findSheet(wb: XLSX.WorkBook, ...fragments: string[]): number {
  return wb.SheetNames.findIndex((name) =>
    fragments.some((f) => name.toLowerCase().includes(f.toLowerCase()))
  );
}

/**
 * Parse a PDP Excel file.
 * Row 0: header — first cell ignored, columns 2-13 are months (jan-dec)
 * Rows 1-13: product rows
 */
export function parsePDPExcel(buffer: ArrayBuffer): ParseResult<PDPData> {
  try {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetIdx = findSheet(wb, "pdp", "plan") !== -1
      ? findSheet(wb, "pdp", "plan")
      : 0;
    const ws = wb.Sheets[wb.SheetNames[sheetIdx]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    if (rows.length < 2) {
      return { success: false, error: "Le fichier est vide ou ne contient pas de données." };
    }

    // Find header row: the one with months in it
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const hasMonth = (rows[r] as unknown[]).some((c) => normalizeMonth(c) !== null);
      if (hasMonth) { headerRowIdx = r; break; }
    }

    const headerRow = rows[headerRowIdx] as unknown[];
    const monthCols: Record<number, MonthKey> = {};
    for (let c = 1; c < headerRow.length; c++) {
      const m = normalizeMonth(headerRow[c]);
      if (m) monthCols[c] = m;
    }

    if (Object.keys(monthCols).length === 0) {
      return { success: false, error: "Aucun mois reconnu dans la ligne d'en-tête." };
    }

    const result: PDPData = {} as PDPData;
    for (const p of ALL_PRODUCTS) result[p] = { ...DEFAULT_PDP[p] };

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      const product = normalizeProduct(row[0]);
      if (!product) continue;
      for (const [colStr, month] of Object.entries(monthCols)) {
        result[product][month] = toNumber(row[Number(colStr)]);
      }
    }

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: `Erreur de lecture: ${err instanceof Error ? err.message : "inconnue"}` };
  }
}

/**
 * Parse a Gammes Produits Excel file.
 *
 * Supported formats:
 * A) Single sheet, two-block: two sets of A-J column headers in one row (first = production, second = cleaning)
 *    Row 0: optional section titles ("Temps Production", "Temps nettoyage")
 *    Row 1: "Produit", A, B, ..., J, A, B, ..., J
 *    Rows 2+: product data
 *
 * B) Two sheets named "Production"/"Nettoyage" (or similar)
 *    Each sheet: row 0 = "Produit", A, B, ..., J; rows 1+ = product data
 */
export function parseGammesExcel(buffer: ArrayBuffer): ParseResult<GammesData> {
  try {
    const wb = XLSX.read(buffer, { type: "array" });

    // Try format B: two sheets
    const prodSheetIdx = findSheet(wb, "prod");
    const cleanSheetIdx = findSheet(wb, "net", "clean", "nett");
    if (prodSheetIdx !== -1 && cleanSheetIdx !== -1 && prodSheetIdx !== cleanSheetIdx) {
      return parseGammesTwoSheets(wb, prodSheetIdx, cleanSheetIdx);
    }

    // Format A: single sheet with two blocks of A-J
    const sheetIdx = findSheet(wb, "gamme") !== -1 ? findSheet(wb, "gamme") : 0;
    const ws = wb.Sheets[wb.SheetNames[sheetIdx]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    if (rows.length < 2) {
      return { success: false, error: "Fichier gammes vide." };
    }

    // Find the column header row: first row where second cell is a LineId ("A")
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      if (normalizeLine((rows[r] as unknown[])[1]) !== null) {
        headerRowIdx = r;
        break;
      }
    }

    const headerRow = rows[headerRowIdx] as unknown[];

    // Build colMap tracking first vs second occurrence of each line letter
    // First occurrence → production, second → cleaning
    const lineCount: Partial<Record<LineId, number>> = {};
    const colMap: Record<number, { line: LineId; type: "production" | "cleaning" }> = {};

    for (let c = 1; c < headerRow.length; c++) {
      const line = normalizeLine(headerRow[c]);
      if (!line) continue;
      lineCount[line] = (lineCount[line] ?? 0) + 1;
      const type: "production" | "cleaning" = lineCount[line] === 1 ? "production" : "cleaning";
      colMap[c] = { line, type };
    }

    if (Object.keys(colMap).length === 0) {
      return { success: false, error: "Aucune ligne (A-J) reconnue dans les en-têtes." };
    }

    const result = deepCloneGammes(DEFAULT_GAMMES);

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      const product = normalizeProduct(row[0]);
      if (!product) continue;
      for (const [colStr, { line, type }] of Object.entries(colMap)) {
        result[product][type][line] = toNumber(row[Number(colStr)]);
      }
    }

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: `Erreur: ${err instanceof Error ? err.message : "inconnue"}` };
  }
}

function parseGammesTwoSheets(wb: XLSX.WorkBook, prodIdx: number, cleanIdx: number): ParseResult<GammesData> {
  const parseSheet = (ws: XLSX.WorkSheet): Record<ProductId, Partial<Record<LineId, number>>> => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
    // Find header row
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      if (normalizeLine((rows[r] as unknown[])[1]) !== null) { headerRowIdx = r; break; }
    }
    const header = rows[headerRowIdx] as unknown[];
    const lineCols: Record<number, LineId> = {};
    for (let c = 1; c < header.length; c++) {
      const l = normalizeLine(header[c]);
      if (l && !Object.values(lineCols).includes(l)) lineCols[c] = l; // first occurrence only
    }
    const out = {} as Record<ProductId, Partial<Record<LineId, number>>>;
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      const p = normalizeProduct(row[0]);
      if (!p) continue;
      out[p] = {};
      for (const [cStr, line] of Object.entries(lineCols)) {
        out[p][line] = toNumber(row[Number(cStr)]);
      }
    }
    return out;
  };

  const prodData = parseSheet(wb.Sheets[wb.SheetNames[prodIdx]]);
  const cleanData = parseSheet(wb.Sheets[wb.SheetNames[cleanIdx]]);

  const result = deepCloneGammes(DEFAULT_GAMMES);
  for (const p of ALL_PRODUCTS) {
    if (prodData[p]) result[p].production = { ...result[p].production, ...prodData[p] };
    if (cleanData[p]) result[p].cleaning = { ...result[p].cleaning, ...cleanData[p] };
  }

  return { success: true, data: result };
}

/**
 * Parse an Ouverture Lignes Excel file.
 *
 * Supported formats:
 * A) Transposed (lines as columns, params as rows) — as in DONNEES TECHNIQUES.xlsx:
 *    Some header rows, then a row with A-J line headers, then param rows.
 *
 * B) Standard (lines as rows, params as columns):
 *    Row 0: "Ligne", "Semaines", "Coeff.", "Postes/Jour", "Jours/Sem.", "Heures/Poste"
 *    Rows 1-10: one row per line
 */
export function parseLignesExcel(buffer: ArrayBuffer): ParseResult<OuvertureLignesData> {
  try {
    const wb = XLSX.read(buffer, { type: "array" });

    // Prefer a sheet named "ouverture" or "ligne"; fall back to last sheet then first
    let sheetIdx = findSheet(wb, "ouverture", "ligne", "lignes");
    if (sheetIdx === -1) sheetIdx = wb.SheetNames.length - 1;

    const ws = wb.Sheets[wb.SheetNames[sheetIdx]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    if (rows.length < 2) {
      return { success: false, error: "Fichier ouverture lignes vide." };
    }

    // --- Detect format ---
    // Find the row that contains line IDs (A-J). Count how many line IDs appear in each row.
    let lineHeaderRowIdx = -1;
    let lineHeaderColOffset = 0; // which column the first line ID appears at

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r] as unknown[];
      let lineCount = 0;
      let firstLineCol = -1;
      for (let c = 0; c < row.length; c++) {
        if (normalizeLine(row[c]) !== null) {
          if (firstLineCol === -1) firstLineCol = c;
          lineCount++;
        }
      }
      if (lineCount >= 5) { // at least 5 of A-J found in this row
        lineHeaderRowIdx = r;
        lineHeaderColOffset = firstLineCol;
        break;
      }
    }

    const PARAM_ALIASES: Record<string, keyof OuvertureLignesData[LineId]> = {
      sem: "weeks", semaine: "weeks", semaines: "weeks", week: "weeks", weeks: "weeks",
      coeff: "coeff", rendement: "coeff", securite: "coeff", coefficient: "coeff",
      poste: "shifts", postes: "shifts", shift: "shifts", shifts: "shifts",
      jour: "days", jours: "days", day: "days", days: "days",
      heure: "hours", heures: "hours", hour: "hours", hours: "hours",
    };

    function matchParam(cell: unknown): keyof OuvertureLignesData[LineId] | null {
      const s = String(cell ?? "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z]/g, " ")
        .split(/\s+/);
      for (const word of s) {
        if (PARAM_ALIASES[word]) return PARAM_ALIASES[word];
      }
      return null;
    }

    const result: OuvertureLignesData = {} as OuvertureLignesData;
    for (const l of ALL_LINES) result[l] = { ...DEFAULT_OUVERTURE_LIGNES[l] };

    if (lineHeaderRowIdx !== -1) {
      // Format A: TRANSPOSED — lines are columns, params are rows
      const lineRow = rows[lineHeaderRowIdx] as unknown[];
      const colToLine: Record<number, LineId> = {};
      for (let c = lineHeaderColOffset; c < lineRow.length; c++) {
        const line = normalizeLine(lineRow[c]);
        if (line) colToLine[c] = line;
      }

      for (let r = lineHeaderRowIdx + 1; r < rows.length; r++) {
        const row = rows[r] as unknown[];
        const param = matchParam(row[0]);
        if (!param) continue;
        for (const [colStr, line] of Object.entries(colToLine)) {
          result[line] = { ...result[line], [param]: toNumber(row[Number(colStr)]) };
        }
      }
    } else {
      // Format B: STANDARD — lines are rows, params are columns
      const headerRow = rows[0] as unknown[];
      const paramCols: Record<number, keyof OuvertureLignesData[LineId]> = {};
      for (let c = 1; c < headerRow.length; c++) {
        const param = matchParam(headerRow[c]);
        if (param) paramCols[c] = param;
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] as unknown[];
        const line = normalizeLine(row[0]);
        if (!line) continue;
        for (const [colStr, param] of Object.entries(paramCols)) {
          result[line] = { ...result[line], [param]: toNumber(row[Number(colStr)]) };
        }
      }
    }

    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: `Erreur: ${err instanceof Error ? err.message : "inconnue"}` };
  }
}

function deepCloneGammes(src: GammesData): GammesData {
  const result = {} as GammesData;
  for (const p of ALL_PRODUCTS) {
    result[p] = {
      production: { ...src[p].production },
      cleaning: { ...src[p].cleaning },
    };
  }
  return result;
}
