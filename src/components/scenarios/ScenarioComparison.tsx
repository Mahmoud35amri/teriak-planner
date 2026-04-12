"use client";

import { KPIResult, LignesOverrides, LineId, ALL_LINES, PDPOverrides, Schedule } from "@/lib/data/types";
import { ScenarioRecord } from "@/stores/scenarioStore";
import { countLignesChanges, countPDPChanges } from "@/lib/data/merge";


interface ParsedScenario {
  id: string;
  name: string;
  rule: string;
  kpis: KPIResult;
  makespan: number;
  pdpOverrides: PDPOverrides | null;
  lignesOverrides: LignesOverrides | null;
}

interface MetricRow {
  label: string;
  values: string[];
  rawValues?: number[];
  lowerIsBetter?: boolean;
  isInfo?: boolean; // informational rows — no winner
}

function parseScenario(s: ScenarioRecord): ParsedScenario {
  const kpis = JSON.parse(s.kpis) as KPIResult;
  const schedule = JSON.parse(s.schedule) as Schedule;
  const pdpOverrides = s.pdpOverrides ? (JSON.parse(s.pdpOverrides) as PDPOverrides) : null;
  const lignesOverrides = s.lignesOverrides ? (JSON.parse(s.lignesOverrides) as LignesOverrides) : null;
  return {
    id: s.id,
    name: s.name,
    rule: s.schedulingRule,
    kpis,
    makespan: schedule.makespan,
    pdpOverrides,
    lignesOverrides,
  };
}

function getBottleneckLine(occupation: Record<LineId, number>): string {
  let maxOcc = -1;
  let maxLine = "-";
  for (const lid of ALL_LINES) {
    if (occupation[lid] !== undefined && occupation[lid] > maxOcc) {
      maxOcc = occupation[lid];
      maxLine = lid;
    }
  }
  return maxLine;
}

function getMinCapacity(availableCapacity: Record<LineId, number>): number {
  let min = Infinity;
  for (const lid of ALL_LINES) {
    if (availableCapacity[lid] !== undefined && availableCapacity[lid] < min) {
      min = availableCapacity[lid];
    }
  }
  return min === Infinity ? 0 : min;
}

function buildRows(parsed: ParsedScenario[]): MetricRow[] {
  return [
    {
      label: "Makespan (h)",
      values: parsed.map((p) => Math.round(p.makespan).toString()),
      rawValues: parsed.map((p) => p.makespan),
      lowerIsBetter: true,
    },
    {
      label: "OTD (%)",
      values: parsed.map((p) => p.kpis.otd.toFixed(1) + "%"),
      rawValues: parsed.map((p) => p.kpis.otd),
      lowerIsBetter: false,
    },
    {
      label: "Lots en retard",
      values: parsed.map((p) => {
        const n = Object.values(p.kpis.tardiness).filter((t) => t > 0).length;
        return n.toString();
      }),
      rawValues: parsed.map((p) => Object.values(p.kpis.tardiness).filter((t) => t > 0).length),
      lowerIsBetter: true,
    },
    {
      label: "Retard moyen (h)",
      values: parsed.map((p) => p.kpis.avgTardiness.toFixed(1)),
      rawValues: parsed.map((p) => p.kpis.avgTardiness),
      lowerIsBetter: true,
    },
    {
      label: "Retard max (h)",
      values: parsed.map((p) => p.kpis.maxTardiness.toFixed(1)),
      rawValues: parsed.map((p) => p.kpis.maxTardiness),
      lowerIsBetter: true,
    },
    {
      label: "Occupation max (%)",
      values: parsed.map((p) => Math.max(...Object.values(p.kpis.occupation)).toFixed(1) + "%"),
      rawValues: parsed.map((p) => Math.max(...Object.values(p.kpis.occupation))),
      lowerIsBetter: true,
    },
    {
      label: "Ligne goulot",
      values: parsed.map((p) => getBottleneckLine(p.kpis.occupation)),
      isInfo: true,
    },
    {
      label: "Capacité min (h)",
      values: parsed.map((p) => getMinCapacity(p.kpis.availableCapacity).toFixed(1)),
      rawValues: parsed.map((p) => getMinCapacity(p.kpis.availableCapacity)),
      lowerIsBetter: false, // higher is better
    },
    {
      label: "Modifications PDP",
      values: parsed.map((p) => {
        const c = countPDPChanges(p.pdpOverrides);
        return c > 0 ? `${c} modif.` : "Base";
      }),
      isInfo: true,
    },
    {
      label: "Modifications Lignes",
      values: parsed.map((p) => {
        const lines = countLignesChanges(p.lignesOverrides);
        return lines.length > 0 ? lines.join(", ") : "Base";
      }),
      isInfo: true,
    },
  ];
}

function winnerIndex(rawValues: number[], lowerIsBetter: boolean): number {
  if (rawValues.every((v) => v === rawValues[0])) return -1;
  let best = rawValues[0];
  let bestIdx = 0;
  rawValues.forEach((v, i) => {
    const isBetter = lowerIsBetter ? v < best : v > best;
    if (isBetter) { best = v; bestIdx = i; }
  });
  return bestIdx;
}

async function exportToExcel(parsed: ParsedScenario[], rows: MetricRow[]) {
  const RULE_LABELS: Record<string, string> = {
    SPT: "SPT", EDD: "EDD", CR: "CR", LPT: "LPT", GA_OPTIMIZED: "GA",
  };
  
  const ExcelJS = (await import("exceljs")).default || await import("exceljs");
  const { saveAs } = await import("file-saver");
  
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Comparaison");

  const header = ["Indicateur", ...parsed.map((p) => `${p.name} (${RULE_LABELS[p.rule] ?? p.rule})`)];
  
  ws.columns = header.map((h, i) => ({ header: h, width: i === 0 ? 25 : 20 }));
  
  rows.forEach((row) => {
    ws.addRow([row.label, ...row.values]);
  });

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
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
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? "FFF8FAFC" : "FFFFFFFF" } };
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

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, "comparaison_scenarios.xlsx");
}

interface Props {
  scenarios: ScenarioRecord[];
}

export default function ScenarioComparison({ scenarios }: Props) {
  const parsed = scenarios.map(parseScenario);
  const rows = buildRows(parsed);

  const RULE_LABELS: Record<string, string> = {
    SPT: "SPT", EDD: "EDD", CR: "CR", LPT: "LPT", GA_OPTIMIZED: "GA",
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-900">
          Comparaison des scénarios
        </h3>
        <button
          onClick={() => exportToExcel(parsed, rows)}
          className="px-3 py-1 text-xs bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 font-medium transition-colors cursor-pointer"
        >
          📥 Exporter Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-blue-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-48 bg-white/60">
                Indicateur
              </th>
              {parsed.map((p) => (
                <th key={p.id} className="px-4 py-2.5 text-center font-semibold text-gray-900 bg-white/60 min-w-[160px]">
                  <div>{p.name}</div>
                  <div className="text-xs font-normal text-blue-600 mt-0.5">{RULE_LABELS[p.rule] ?? p.rule}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const winner = row.isInfo || !row.rawValues || !row.lowerIsBetter === undefined
                ? -1
                : winnerIndex(row.rawValues, row.lowerIsBetter!);
              return (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white/40" : "bg-white/20"}>
                  <td className="px-4 py-2.5 text-gray-600 font-medium">{row.label}</td>
                  {row.values.map((v, ci) => (
                    <td
                      key={ci}
                      className={`px-4 py-2.5 text-center font-semibold ${
                        winner === ci
                          ? "text-green-700 bg-green-50"
                          : row.isInfo
                          ? "text-gray-500 font-normal"
                          : "text-gray-800"
                      }`}
                    >
                      {v}
                      {winner === ci && (
                        <span className="ml-1.5 text-xs text-green-600 font-normal">meilleur</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
