"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import MonthDrilldownChart from "./MonthDrilldownChart";
import AppShell from "@/components/layout/AppShell";
import ProposalsPanel from "@/components/planning/ProposalsPanel";
import { useScheduleStore } from "@/stores/scheduleStore";
import { computeMonthlyCHFromPDP, computeMonthlyTO } from "@/lib/scheduler/metrics";
import {
  ALL_LINES,
  ALL_MONTHS,
  MONTH_LABELS,
  MonthKey,
  LineId,
  PDPData,
  GammesData,
  OuvertureLignesData,
} from "@/lib/data/types";

type ApiResponse<T> = { success: boolean; data?: T };

interface Props {
  canSubmit: boolean;
  canApprove: boolean;
}

export default function ChargeClient({ canSubmit, canApprove }: Props) {
  const lastDataSavedAt = useScheduleStore((s) => s.lastDataSavedAt);
  const [pdp, setPdp] = useState<PDPData | null>(null);
  const [gammes, setGammes] = useState<GammesData | null>(null);
  const [lignes, setLignes] = useState<OuvertureLignesData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>("jan");
  const [showProposals, setShowProposals] = useState(false);

  const fetchAll = useCallback(() => {
    fetch("/api/pdp")
      .then((r) => r.json())
      .then((j: ApiResponse<PDPData>) => { if (j.success && j.data) setPdp(j.data); })
      .catch(() => undefined);

    fetch("/api/gammes")
      .then((r) => r.json())
      .then((j: ApiResponse<GammesData>) => { if (j.success && j.data) setGammes(j.data); })
      .catch(() => undefined);

    fetch("/api/lignes")
      .then((r) => r.json())
      .then((j: ApiResponse<OuvertureLignesData>) => { if (j.success && j.data) setLignes(j.data); })
      .catch(() => undefined);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (lastDataSavedAt) fetchAll(); }, [lastDataSavedAt]);

  const monthlyCH = useMemo(
    () => (pdp && gammes ? computeMonthlyCHFromPDP(pdp, gammes) : null),
    [pdp, gammes]
  );

  const monthlyTO = useMemo(
    () => (lignes ? computeMonthlyTO(lignes) : null),
    [lignes]
  );

  const drilldownData = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return [];
    return ALL_LINES.map((line) => {
      const ch = monthlyCH[selectedMonth][line];
      const to = monthlyTO[line];
      const occupation = to > 0 ? (ch / to) * 100 : 0;
      return {
        line,
        occupation: Math.round(occupation * 10) / 10,
        ch: Math.round(ch * 10) / 10,
        to: Math.round(to * 10) / 10,
      };
    });
  }, [selectedMonth, monthlyCH, monthlyTO]);

  // Annual overloaded lines (any month)
  const overloadedLines = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return [];
    return ALL_LINES.filter((line) => {
      const annualCH = ALL_MONTHS.reduce((sum, m) => sum + monthlyCH[m][line], 0);
      const annualTO = monthlyTO[line] * 12;
      return annualTO > 0 && (annualCH / annualTO) * 100 > 100;
    });
  }, [monthlyCH, monthlyTO]);

  // For selected month: which lines are overloaded (> 100%)?
  const overloadedInMonth = useMemo(() => {
    if (!monthlyCH || !monthlyTO) return [];
    return ALL_LINES.filter((line) => {
      const ch = monthlyCH[selectedMonth][line];
      const to = monthlyTO[line];
      return to > 0 && (ch / to) * 100 > 100;
    });
  }, [selectedMonth, monthlyCH, monthlyTO]);

  // Worst overloaded line in the selected month (for pre-selecting in proposals)
  const worstLine = useMemo<LineId | undefined>(() => {
    if (!monthlyCH || !monthlyTO || overloadedInMonth.length === 0) return undefined;
    let worst: LineId = overloadedInMonth[0];
    let worstPct = 0;
    for (const line of overloadedInMonth) {
      const pct = (monthlyCH[selectedMonth][line] / monthlyTO[line]) * 100;
      if (pct > worstPct) { worstPct = pct; worst = line; }
    }
    return worst;
  }, [selectedMonth, monthlyCH, monthlyTO, overloadedInMonth]);

  const ready = monthlyCH !== null && monthlyTO !== null;

  return (
    <AppShell title="Analyse de Faisabilité">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analyse de Faisabilité</h1>
          <p className="text-sm text-gray-500 mt-1">
            Taux d&apos;occupation par atelier — sélectionnez un mois
          </p>
        </div>

        {overloadedLines.length > 0 && (
          <div className="p-3 rounded-md border bg-red-50 border-red-300">
            <p className="text-sm font-semibold text-red-800 mb-1">
              Surcharge annuelle détectée — {overloadedLines.length} atelier{overloadedLines.length > 1 ? "s" : ""} dépassent 100% de capacité
            </p>
            <div className="flex flex-wrap gap-2">
              {overloadedLines.map((line) => (
                <span key={line} className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                  Atelier {line}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Monthly navigation bar */}
        <div className="flex flex-wrap gap-1">
          {ALL_MONTHS.map((month) => (
            <button
              key={month}
              onClick={() => { setSelectedMonth(month); setShowProposals(false); }}
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

        {!ready && (
          <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            Chargement des données...
          </div>
        )}

        {ready && (
          <MonthDrilldownChart
            month={selectedMonth}
            data={drilldownData}
          />
        )}

        {/* Overload in selected month — non-feasible alert + button */}
        {ready && overloadedInMonth.length > 0 && (
          <div className="p-4 rounded-lg border bg-red-50 border-red-300">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Solution non réalisable — {overloadedInMonth.length} atelier{overloadedInMonth.length > 1 ? "s" : ""}{" "}
                  {overloadedInMonth.length > 1 ? "dépassent" : "dépasse"} 100% en {MONTH_LABELS[selectedMonth]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {overloadedInMonth.map((line) => {
                    const pct = monthlyCH && monthlyTO
                      ? Math.round((monthlyCH[selectedMonth][line] / monthlyTO[line]) * 1000) / 10
                      : 0;
                    return (
                      <span key={line} className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        Atelier {line} — {pct}%
                      </span>
                    );
                  })}
                </div>
              </div>
              {(canSubmit || canApprove) && (
                <button
                  onClick={() => setShowProposals((v) => !v)}
                  className={`px-4 py-1.5 text-sm rounded font-medium shrink-0 transition-colors ${
                    showProposals
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-red-700 text-white hover:bg-red-800"
                  }`}
                >
                  {showProposals ? "Fermer les propositions" : "Proposer une modification"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inline proposals panel — shown when user clicks the button */}
        {showProposals && (canSubmit || canApprove) && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Propositions de modification — {MONTH_LABELS[selectedMonth]}
              </h2>
              <button
                onClick={() => setShowProposals(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            <ProposalsPanel
              canSubmit={canSubmit}
              canApprove={canApprove}
              defaultWorkshop={worstLine}
              onApplied={fetchAll}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
