import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  PDPData,
  GammesData,
  OuvertureLignesData,
  ALL_PRODUCTS,
  ALL_LINES,
  ALL_MONTHS,
  MONTH_LABELS,
} from "@/lib/data/types";

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, filename);
}

function styleSheet(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // Teal-700
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  headerRow.height = 25;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const isAlt = rowNumber % 2 !== 0;
    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isAlt ? "FFF8FAFC" : "FFFFFFFF" },
      };
      if (colNumber === 1) {
        cell.font = { bold: true, color: { argb: "FF334155" } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    row.height = 20;
  });
}

export async function exportPDPToExcel(data: PDPData, filename = "PDP_2026.xlsx") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PDP");

  ws.columns = [
    { header: "Produit", width: 12 },
    ...ALL_MONTHS.map((m) => ({ header: MONTH_LABELS[m], width: 12 })),
  ];

  ALL_PRODUCTS.forEach((p) => {
    ws.addRow([p, ...ALL_MONTHS.map((m) => data[p][m] ?? 0)]);
  });

  styleSheet(ws);
  await saveWorkbook(wb, filename);
}

export async function exportGammesToExcel(data: GammesData, filename = "Gammes_Produits.xlsx") {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Production
  const wsProd = wb.addWorksheet("Production");
  wsProd.columns = [
    { header: "Produit", width: 12 },
    ...ALL_LINES.map((l) => ({ header: `Ligne ${l}`, width: 12 })),
  ];
  ALL_PRODUCTS.forEach((p) => {
    wsProd.addRow([p, ...ALL_LINES.map((l) => data[p].production[l] ?? 0)]);
  });
  styleSheet(wsProd);

  // Sheet 2: Cleaning
  const wsClean = wb.addWorksheet("Nettoyage");
  wsClean.columns = [
    { header: "Produit", width: 12 },
    ...ALL_LINES.map((l) => ({ header: `Ligne ${l}`, width: 12 })),
  ];
  ALL_PRODUCTS.forEach((p) => {
    wsClean.addRow([p, ...ALL_LINES.map((l) => data[p].cleaning[l] ?? 0)]);
  });
  styleSheet(wsClean);

  await saveWorkbook(wb, filename);
}

export async function exportLignesToExcel(data: OuvertureLignesData, filename = "Ouverture_Lignes.xlsx") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ouverture Lignes");

  ws.columns = [
    { header: "Ligne", width: 10 },
    { header: "Semaines", width: 15 },
    { header: "Coeff. Rendement", width: 18 },
    { header: "Postes/Jour", width: 15 },
    { header: "Jours/Semaine", width: 16 },
    { header: "Heures/Poste", width: 16 },
    { header: "TO (h)", width: 12 },
  ];

  ALL_LINES.forEach((l) => {
    const p = data[l];
    const to = p.weeks * p.coeff * p.shifts * p.days * p.hours;
    ws.addRow([l, p.weeks, p.coeff, p.shifts, p.days, p.hours, parseFloat(to.toFixed(1))]);
  });

  styleSheet(ws);
  await saveWorkbook(wb, filename);
}
