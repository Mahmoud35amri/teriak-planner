"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import AppShell from "@/components/layout/AppShell";
import { type Role } from "@/lib/auth/roles";
import { SessionUser } from "@/lib/auth/session";
import { computeMonthlyCHFromPDP, computeMonthlyTO } from "@/lib/scheduler/metrics";
import {
  ALL_LINES,
  ALL_MONTHS,
  MONTH_LABELS,
  MonthKey,
  PDPData,
  GammesData,
  OuvertureLignesData,
} from "@/lib/data/types";

interface Props {
  session: SessionUser;
  canViewKPIs: boolean;
}

type ApiResponse<T> = { success: boolean; data?: T };

function styleSheet(ws: ExcelJS.Worksheet) {
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
}

async function exportKPIs(
  kpis: ReturnType<typeof useScheduleStore.getState>["kpis"],
  schedule: ReturnType<typeof useScheduleStore.getState>["schedule"]
) {
  if (!kpis || !schedule) return;

  const wb = new ExcelJS.Workbook();

  const wsSummary = wb.addWorksheet("Résumé KPI");
  wsSummary.columns = [{ header: "Indicateur", width: 35 }, { header: "Valeur", width: 25 }];
  wsSummary.addRow(["OTD — Taux de respect PDP (%)", parseFloat(kpis.otd.toFixed(2))]);
  wsSummary.addRow(["Lots en retard", schedule.lots.filter((sl) => sl.completionTime > sl.lot.dueDate).length]);
  wsSummary.addRow(["Retard moyen (h)", parseFloat(kpis.avgTardiness.toFixed(2))]);
  wsSummary.addRow(["Retard maximum (h)", parseFloat(kpis.maxTardiness.toFixed(2))]);
  wsSummary.addRow(["Makespan (h)", parseFloat(schedule.makespan.toFixed(2))]);
  wsSummary.addRow(["Règle d'ordonnancement", schedule.rule]);
  wsSummary.addRow(["Généré le", schedule.generatedAt]);
  styleSheet(wsSummary);

  const wsOcc = wb.addWorksheet("Occupation");
  wsOcc.columns = [
    { header: "Atelier", width: 15 },
    { header: "Taux d'occupation (%)", width: 25 },
    { header: "Capacité disponible (h)", width: 25 },
  ];
  ALL_LINES.forEach((line) => {
    wsOcc.addRow([`Atelier ${line}`, parseFloat(kpis.occupation[line].toFixed(2)), parseFloat(kpis.availableCapacity[line].toFixed(2))]);
  });
  styleSheet(wsOcc);

  const wsTard = wb.addWorksheet("Retards");
  wsTard.columns = [
    { header: "Lot", width: 15 },
    { header: "Produit", width: 15 },
    { header: "Mois PDP", width: 15 },
    { header: "Fin prévue (h)", width: 18 },
    { header: "Échéance (h)", width: 15 },
    { header: "Retard (h)", width: 15 },
  ];
  const tardRows = schedule.lots
    .map((sl) => ({
      id: sl.lot.id,
      product: sl.lot.productId,
      month: sl.lot.month,
      completion: sl.completionTime,
      due: sl.lot.dueDate,
      tardiness: Math.max(0, sl.completionTime - sl.lot.dueDate),
    }))
    .sort((a, b) => b.tardiness - a.tardiness);
    
  tardRows.forEach((r) => {
    wsTard.addRow([r.id, r.product, r.month, parseFloat(r.completion.toFixed(2)), parseFloat(r.due.toFixed(2)), parseFloat(r.tardiness.toFixed(2))]);
  });
  styleSheet(wsTard);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `Teriak_KPI_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function DashboardClient({ session, canViewKPIs }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const { schedule, kpis, lastDataSavedAt } = useScheduleStore();

  useEffect(() => {
    setUser({ id: session.id, name: session.name, email: session.email, role: session.role as Role });
  }, [session, setUser]);

  // ---- KPI data fetching ----
  const [pdp, setPdp] = useState<PDPData | null>(null);
  const [gammes, setGammes] = useState<GammesData | null>(null);
  const [lignes, setLignes] = useState<OuvertureLignesData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>("jan");

  useEffect(() => {
    if (!canViewKPIs) return;
    const fetchAll = () => {
      fetch("/api/pdp").then((r) => r.json()).then((j: ApiResponse<PDPData>) => { if (j.success && j.data) setPdp(j.data); }).catch(() => undefined);
      fetch("/api/gammes").then((r) => r.json()).then((j: ApiResponse<GammesData>) => { if (j.success && j.data) setGammes(j.data); }).catch(() => undefined);
      fetch("/api/lignes").then((r) => r.json()).then((j: ApiResponse<OuvertureLignesData>) => { if (j.success && j.data) setLignes(j.data); }).catch(() => undefined);
    };
    fetchAll();
  }, [canViewKPIs]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canViewKPIs || !lastDataSavedAt) return;
    fetch("/api/pdp").then((r) => r.json()).then((j: ApiResponse<PDPData>) => { if (j.success && j.data) setPdp(j.data); }).catch(() => undefined);
    fetch("/api/gammes").then((r) => r.json()).then((j: ApiResponse<GammesData>) => { if (j.success && j.data) setGammes(j.data); }).catch(() => undefined);
    fetch("/api/lignes").then((r) => r.json()).then((j: ApiResponse<OuvertureLignesData>) => { if (j.success && j.data) setLignes(j.data); }).catch(() => undefined);
  }, [lastDataSavedAt, canViewKPIs]);

  const monthlyCH = useMemo(() => (pdp && gammes ? computeMonthlyCHFromPDP(pdp, gammes) : null), [pdp, gammes]);
  const monthlyTO = useMemo(() => (lignes ? computeMonthlyTO(lignes) : null), [lignes]);

  const maxOccInfo = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return null;
    let maxPct = 0, maxLine = "", maxMonth = "";
    for (const month of ALL_MONTHS) {
      for (const line of ALL_LINES) {
        const ch = monthlyCH[month][line];
        const to = monthlyTO[line];
        const pct = to > 0 ? (ch / to) * 100 : 0;
        if (pct > maxPct) { maxPct = pct; maxLine = `${line}`; maxMonth = MONTH_LABELS[month]; }
      }
    }
    return { pct: Math.round(maxPct * 10) / 10, line: maxLine, month: maxMonth };
  }, [monthlyCH, monthlyTO]);

  const capaciteInfo = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return null;
    let minCD = Infinity, minLine = "", minMonth = "";
    for (const month of ALL_MONTHS) {
      for (const line of ALL_LINES) {
        const ch = monthlyCH[month][line];
        const to = monthlyTO[line];
        const cd = to - ch;
        if (cd < minCD) { minCD = cd; minLine = line; minMonth = MONTH_LABELS[month]; }
      }
    }
    return { cd: Math.round(minCD), line: minLine, month: minMonth };
  }, [monthlyCH, monthlyTO]);

  const monthCapacityData = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return [];
    return ALL_LINES.map((line) => {
      const ch = monthlyCH[selectedMonth][line];
      const to = monthlyTO[line];
      return { line, cd: Math.round((to - ch) * 10) / 10, ch: Math.round(ch * 10) / 10, to: Math.round(to * 10) / 10 };
    });
  }, [selectedMonth, monthlyCH, monthlyTO]);

  const tardinessRows = schedule
    ? schedule.lots
        .map((sl) => ({ id: sl.lot.id, product: sl.lot.productId, month: sl.lot.month, tardiness: Math.max(0, sl.completionTime - sl.lot.dueDate), completionTime: sl.completionTime }))
        .filter((r) => r.tardiness > 0)
        .sort((a, b) => b.tardiness - a.tardiness)
        .slice(0, 20)
    : [];

  const lateLots = schedule ? schedule.lots.filter((sl) => sl.completionTime > sl.lot.dueDate).length : null;

  return (
    <AppShell title="Tableau de bord">
      <div className="max-w-5xl mx-auto">
        {/* ===== KPI Section ===== */}
        {canViewKPIs && (
          <div className="space-y-6" id="kpi">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
                >
                  Indicateurs de Performance
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Vue d&apos;ensemble des KPI clés
                </p>
              </div>
              {schedule && kpis && (
                <button
                  onClick={() => exportKPIs(kpis, schedule)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors font-medium"
                >
                  Exporter Excel
                </button>
              )}
            </div>

            {/* Info line: last scheduling run */}
            {schedule && (
              <p className="text-xs text-gray-400 -mt-3">
                Dernier ordonnancement : {schedule.rule} — {schedule.generatedAt}
              </p>
            )}

            {/* 4 KPI summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* KPI 1: OTD */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">OTD</p>
                {kpis ? (
                  <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-mono)", color: kpis.otd >= 90 ? "#22C55E" : kpis.otd >= 70 ? "#F59E0B" : "#EF4444" }}>
                    {kpis.otd.toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-4xl font-bold text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>—</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Taux respect PDP</p>
              </div>

              {/* KPI 2: Occupation max */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Occupation max</p>
                {maxOccInfo ? (
                  <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-mono)", color: maxOccInfo.pct > 85 ? "#EF4444" : maxOccInfo.pct > 70 ? "#F59E0B" : "#22C55E" }}>
                    {maxOccInfo.pct}%
                  </p>
                ) : (
                  <p className="text-4xl font-bold text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>—</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {maxOccInfo ? `Atelier ${maxOccInfo.line}, ${maxOccInfo.month}` : "par atelier/mois"}
                </p>
              </div>

              {/* KPI 3: Retards */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Retards</p>
                {schedule ? (
                  <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-mono)", color: lateLots === 0 ? "#22C55E" : "#EF4444" }}>
                    {lateLots}
                  </p>
                ) : (
                  <p className="text-4xl font-bold text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>—</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{schedule ? `sur ${schedule.lots.length} lots` : "lots planifiés"}</p>
              </div>

              {/* KPI 4: Capacité dispo */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Capacité dispo.</p>
                {capaciteInfo ? (
                  <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-mono)", color: capaciteInfo.cd >= 0 ? "#22C55E" : "#EF4444" }}>
                    {capaciteInfo.cd} h
                  </p>
                ) : (
                  <p className="text-4xl font-bold text-gray-300" style={{ fontFamily: "var(--font-mono)" }}>—</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {capaciteInfo ? `Atelier ${capaciteInfo.line}, ${capaciteInfo.month}` : "par atelier/mois"}
                </p>
              </div>
            </div>

            {!schedule && (
              <p className="text-xs text-gray-400 -mt-3">
                OTD et retards calculés après ordonnancement depuis le Gantt.
              </p>
            )}

            {/* KPI 4 chart: Capacité disponible par atelier par mois */}
            {monthlyCH && monthlyTO && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-sm font-medium text-gray-700 mb-3">
                  Capacité disponible par atelier{" "}
                  <span className="text-xs text-gray-400 font-normal">CD = TO − CH (heures)</span>
                </h2>

                <div className="flex flex-wrap gap-1 mb-4">
                  {ALL_MONTHS.map((month) => (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(month)}
                      className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                        selectedMonth === month
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                      }`}
                    >
                      {MONTH_LABELS[month]}
                    </button>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthCapacityData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit=" h" />
                    <YAxis type="category" dataKey="line" tick={{ fontSize: 12 }} width={30} tickFormatter={(v: string) => `${v}`} />
                    <Tooltip formatter={(v) => [`${v} h`, "Capacité disponible"]} labelFormatter={(label) => `Atelier ${label}`} />
                    <ReferenceLine x={0} stroke="#6B7280" strokeWidth={1.5} />
                    <Bar dataKey="cd" radius={[0, 3, 3, 0]} maxBarSize={28}>
                      {monthCapacityData.map((entry) => (
                        <Cell key={entry.line} fill={entry.cd >= 0 ? "#22C55E" : "#EF4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 justify-end">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
                    Capacité restante
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                    Surcharge (goulot)
                  </span>
                </div>
              </div>
            )}

            {/* Tardiness table */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">
                Retards par lot{" "}
                <span className="text-xs text-gray-400 font-normal">T = max(0, C − d)</span>
              </h2>
              {!schedule ? (
                <p className="text-sm text-gray-400">Lancez l&apos;ordonnancement depuis le Gantt pour afficher les retards.</p>
              ) : tardinessRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="text-left py-2 pr-4 font-medium">Lot</th>
                        <th className="text-left py-2 pr-4 font-medium">Produit</th>
                        <th className="text-left py-2 pr-4 font-medium">Mois PDP</th>
                        <th className="text-right py-2 pr-4 font-medium">Fin prévue (h)</th>
                        <th className="text-right py-2 font-medium">Retard (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tardinessRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 pr-4 font-mono text-xs text-gray-700">{row.id}</td>
                          <td className="py-1.5 pr-4 text-gray-600">{row.product}</td>
                          <td className="py-1.5 pr-4 text-gray-600 capitalize">{row.month}</td>
                          <td className="py-1.5 pr-4 text-right text-gray-600">{row.completionTime.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-medium text-red-600">
                            +{row.tardiness.toFixed(1)} h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-green-600">Aucun lot en retard — tous les lots respectent leur date de livraison.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
