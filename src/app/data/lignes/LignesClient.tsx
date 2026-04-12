"use client";

import { useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { OuvertureLignesData, ALL_LINES, LineId, LigneParams } from "@/lib/data/types";
import { LIGNE_CONSTRAINTS, clampLigneParam, LigneParamKey } from "@/lib/data/constraints";
import { exportLignesToExcel } from "@/lib/excel/exporter";
import { parseLignesExcel } from "@/lib/excel/parser";
import { useScheduleStore } from "@/stores/scheduleStore";

interface Props {
  initialData: OuvertureLignesData;
  canEdit: boolean;
}

const PARAM_LABELS: Record<keyof LigneParams, string> = {
  weeks: "Semaines",
  coeff: "Coeff. Rendement",
  shifts: "Postes / Jour",
  days: "Jours / Semaine",
  hours: "Heures / Poste",
};

const PARAM_KEYS = (Object.keys(PARAM_LABELS) as (keyof LigneParams)[]);

export default function LignesClient({ initialData, canEdit }: Props) {
  const markDataSaved = useScheduleStore((s) => s.markDataSaved);
  const [data, setData] = useState<OuvertureLignesData>(initialData);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const draftKey = (line: LineId, param: keyof LigneParams) => `${line}-${param}`;

  const handleChange = useCallback((line: LineId, param: keyof LigneParams, value: string) => {
    setDrafts((prev) => ({ ...prev, [draftKey(line, param)]: value }));
    setDirty(true);
  }, []);

  const handleBlur = useCallback((line: LineId, param: keyof LigneParams) => {
    const key = draftKey(line, param);
    setDrafts((prev) => {
      const draft = prev[key];
      if (draft === undefined) return prev;
      const raw = parseFloat(draft.replace(",", "."));
      // Clamp to hard constraints instead of just clamping to 0
      const num = isNaN(raw) ? LIGNE_CONSTRAINTS[param].min : clampLigneParam(param as LigneParamKey, raw);
      setData((d) => ({ ...d, [line]: { ...d[line], [param]: num } }));
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/lignes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        setDirty(false);
        markDataSaved();
        setMessage({ type: "success", text: "Ouverture lignes enregistrée avec succès." });
      } else {
        setMessage({ type: "error", text: json.error ?? "Erreur lors de l'enregistrement." });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau." });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const result = parseLignesExcel(buffer);
      if (result.success) {
        setData(result.data);
        setDirty(true);
        setMessage({ type: "success", text: "Fichier importé. Vérifiez les données puis enregistrez." });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Computed opening time per line: TO_j = weeks × coeff × shifts × days × hours
  // Reads from live drafts first so the column updates while typing
  const openingTime = (line: LineId): number => {
    const getLive = (param: keyof LigneParams): number => {
      const key = draftKey(line, param);
      if (drafts[key] !== undefined) {
        const raw = parseFloat(drafts[key].replace(",", "."));
        return isNaN(raw) || raw < 0 ? 0 : raw;
      }
      return data[line][param];
    };
    const result = getLive("weeks") * getLive("coeff") * getLive("shifts") * getLive("days") * getLive("hours");
    return +result.toFixed(2);
  };

  /** Check if a draft value exceeds constraints (for red border) */
  const isOutOfRange = (line: LineId, param: keyof LigneParams): boolean => {
    const key = draftKey(line, param);
    const draft = drafts[key];
    if (draft === undefined) return false;
    const raw = parseFloat(draft.replace(",", "."));
    if (isNaN(raw)) return true;
    const c = LIGNE_CONSTRAINTS[param];
    return raw < c.min || raw > c.max;
  };

  return (
    <AppShell title="Ouverture des Lignes">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Paramètres de capacité par atelier (A – J)
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
              Non enregistré
            </span>
          )}
          <button
            onClick={() => exportLignesToExcel(data)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            Exporter Excel
          </button>
          {canEdit && (
            <>
              <label className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 transition-colors cursor-pointer">
                Importer Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              </label>
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-medium"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-16">
                Ligne
              </th>
              {PARAM_KEYS.map((k) => {
                const c = LIGNE_CONSTRAINTS[k];
                return (
                  <th key={k} className="px-4 py-2.5 text-center font-semibold text-gray-700">
                    <span>{PARAM_LABELS[k]}</span>
                    {!c.fixed && (
                      <span className="block text-[10px] font-normal text-gray-400">
                        {c.min}–{c.max}
                      </span>
                    )}
                    {c.fixed && (
                      <span className="block text-[10px] font-normal text-gray-400">
                        fixé à {c.min}
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="px-4 py-2.5 text-center font-semibold text-blue-700 bg-blue-50/50">
                TO (h/mois)
              </th>
            </tr>
          </thead>
          <tbody>
            {ALL_LINES.map((line, idx) => {
              const to = openingTime(line);
              return (
                <tr key={line} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-2 font-bold text-gray-800 text-lg">{line}</td>
                  {PARAM_KEYS.map((param) => {
                    const val = data[line][param];
                    const c = LIGNE_CONSTRAINTS[param];
                    const outOfRange = isOutOfRange(line, param);
                    return (
                      <td key={param} className="px-3 py-1.5 text-center">
                        {canEdit ? (
                          c.fixed ? (
                            /* hours — fixed, read-only */
                            <input
                              type="number"
                              value={c.min}
                              disabled
                              className="w-24 px-2 py-1 text-center text-sm text-gray-400 border border-gray-200 rounded bg-gray-100 cursor-not-allowed"
                            />
                          ) : (
                            <div className="relative">
                              <input
                                type="number"
                                min={c.min}
                                max={c.max}
                                step={c.step}
                                value={drafts[draftKey(line, param)] ?? String(val)}
                                onChange={(e) => handleChange(line, param, e.target.value)}
                                onBlur={() => handleBlur(line, param)}
                                onFocus={(e) => e.target.select()}
                                className={`w-24 px-2 py-1 text-center text-sm text-gray-900 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                                  outOfRange ? "border-red-400 bg-red-50" : "border-gray-200"
                                }`}
                                title={outOfRange ? `Limites: ${c.min} – ${c.max}` : undefined}
                              />
                              {outOfRange && (
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-red-500 whitespace-nowrap">
                                  {c.min}–{c.max}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-gray-800">{val}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-center font-semibold text-blue-700 bg-blue-50/50">
                    {to}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-1">Formule de calcul:</p>
        <p className="text-xs text-gray-500 font-mono">
          TO_j = Semaines × Coeff. Rendement × Postes/Jour × Jours/Semaine × Heures/Poste
        </p>
      </div>
    </AppShell>
  );
}
