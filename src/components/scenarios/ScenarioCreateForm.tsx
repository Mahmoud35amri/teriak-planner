"use client";

import { useEffect, useState } from "react";
import {
  ALL_LINES,
  ALL_MONTHS,
  ALL_PRODUCTS,
  LignesOverrides,
  LigneParams,
  LineId,
  MonthKey,
  MONTH_LABELS,
  OuvertureLignesData,
  PDPData,
  PDPOverrides,
  ProductId,
  SchedulingRule,
} from "@/lib/data/types";
import { LIGNE_CONSTRAINTS, clampLigneParam, LigneParamKey } from "@/lib/data/constraints";
import { diffLignes, diffPDP } from "@/lib/data/merge";

const RULES: { value: SchedulingRule; label: string }[] = [
  { value: "SPT", label: "SPT — Temps le plus court en premier" },
  { value: "EDD", label: "EDD — Date d'échéance la plus proche" },
  { value: "CR", label: "CR — Ratio critique" },
  { value: "LPT", label: "LPT — Temps le plus long en premier" },
  { value: "GA_OPTIMIZED", label: "GA — Algorithme génétique (optimiseur IA)" },
];

const PARAM_LABELS: Record<string, string> = {
  weeks: "Sem.",
  coeff: "Coeff",
  shifts: "Postes/j",
  days: "Jours/s",
  hours: "Heures/p",
};

function computeTO(p: LigneParams): number {
  return p.weeks * p.coeff * p.shifts * p.days * p.hours;
}

interface Props {
  onCreated: () => void;
  onCancel: () => void;
  createScenario: (
    name: string,
    description: string,
    rule: SchedulingRule,
    pdpOverrides?: PDPOverrides,
    lignesOverrides?: LignesOverrides
  ) => Promise<unknown>;
}

export default function ScenarioCreateForm({ onCreated, onCancel, createScenario }: Props) {
  // Base data
  const [basePdp, setBasePdp] = useState<PDPData | null>(null);
  const [baseLignes, setBaseLignes] = useState<OuvertureLignesData | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rule, setRule] = useState<SchedulingRule>("EDD");

  // Editable copies
  const [editPdp, setEditPdp] = useState<PDPData | null>(null);
  const [editLignes, setEditLignes] = useState<OuvertureLignesData | null>(null);

  // Section visibility
  const [showPdp, setShowPdp] = useState(false);
  const [showLignes, setShowLignes] = useState(false);

  // Submit state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch base data on mount
  useEffect(() => {
    async function load() {
      try {
        const [pdpRes, lignesRes] = await Promise.all([
          fetch("/api/pdp").then((r) => r.json()),
          fetch("/api/lignes").then((r) => r.json()),
        ]);
        if (pdpRes.success) {
          setBasePdp(pdpRes.data);
          setEditPdp(JSON.parse(JSON.stringify(pdpRes.data)));
        }
        if (lignesRes.success) {
          setBaseLignes(lignesRes.data);
          setEditLignes(JSON.parse(JSON.stringify(lignesRes.data)));
        }
      } catch {
        setError("Erreur de chargement des données de base");
      }
      setLoadingBase(false);
    }
    void load();
  }, []);

  const handlePdpChange = (pid: ProductId, month: MonthKey, value: string) => {
    if (!editPdp) return;
    const num = parseInt(value, 10);
    setEditPdp((prev) => {
      if (!prev) return prev;
      return { ...prev, [pid]: { ...prev[pid], [month]: isNaN(num) ? 0 : Math.max(0, num) } };
    });
  };

  const handleLigneChange = (lid: LineId, key: LigneParamKey, value: string) => {
    if (!editLignes) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const clamped = clampLigneParam(key, num);
    setEditLignes((prev) => {
      if (!prev) return prev;
      return { ...prev, [lid]: { ...prev[lid], [key]: clamped } };
    });
  };

  const isPdpModified = (pid: ProductId, m: MonthKey): boolean => {
    if (!basePdp || !editPdp) return false;
    return editPdp[pid][m] !== basePdp[pid][m];
  };

  const isLigneModified = (lid: LineId, key: LigneParamKey): boolean => {
    if (!baseLignes || !editLignes) return false;
    return editLignes[lid][key] !== baseLignes[lid][key];
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Nom requis"); return; }
    setCreating(true);
    setError(null);

    let pdpOverrides: PDPOverrides | undefined;
    let lignesOverrides: LignesOverrides | undefined;

    if (basePdp && editPdp) {
      const d = diffPDP(basePdp, editPdp);
      if (Object.keys(d).length > 0) pdpOverrides = d;
    }
    if (baseLignes && editLignes) {
      const d = diffLignes(baseLignes, editLignes);
      if (Object.keys(d).length > 0) lignesOverrides = d;
    }

    const result = await createScenario(name, description, rule, pdpOverrides, lignesOverrides);
    setCreating(false);
    if (result) {
      onCreated();
    } else {
      setError("Erreur lors de la création du scénario");
    }
  };

  const pdpChangeCount = basePdp && editPdp ? Object.keys(diffPDP(basePdp, editPdp)).length : 0;
  const lignesChangeCount = baseLignes && editLignes
    ? Object.keys(diffLignes(baseLignes, editLignes)).length
    : 0;

  return (
    <div className="mb-6 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Nouveau scénario What-If</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Configurez la règle d&apos;ordonnancement et modifiez optionnellement le PDP ou les lignes
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Section 1: Base fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rush P1 Mars"
              className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Règle</label>
            <select
              value={rule}
              onChange={(e) => setRule(e.target.value as SchedulingRule)}
              className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              {RULES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {rule === "GA_OPTIMIZED" && (
          <p className="text-xs text-amber-600">
            L&apos;algorithme génétique (pop=50, gen=100) peut prendre quelques secondes.
          </p>
        )}

        {loadingBase ? (
          <p className="text-xs text-gray-400">Chargement des données de base...</p>
        ) : (
          <>
            {/* Section 2: PDP overrides */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowPdp((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span>
                  {showPdp ? "▼" : "▶"} Modifier le PDP pour ce scénario
                  {pdpChangeCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {pdpChangeCount} modif.
                    </span>
                  )}
                </span>
              </button>

              {showPdp && editPdp && (
                <div className="p-4 overflow-x-auto border-t border-gray-200">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 sticky left-0 bg-white z-10">Produit</th>
                        {ALL_MONTHS.map((m) => (
                          <th key={m} className="px-1.5 py-1.5 text-center font-semibold text-gray-600 min-w-[52px]">
                            {MONTH_LABELS[m].slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_PRODUCTS.map((pid) => (
                        <tr key={pid} className="border-t border-gray-100">
                          <td className="px-2 py-1 font-medium text-gray-700 sticky left-0 bg-white z-10">{pid}</td>
                          {ALL_MONTHS.map((m) => {
                            const modified = isPdpModified(pid, m);
                            return (
                              <td key={m} className="px-1 py-0.5">
                                <input
                                  type="number"
                                  min={0}
                                  value={editPdp[pid][m]}
                                  onChange={(e) => handlePdpChange(pid, m, e.target.value)}
                                  className={`w-full px-1.5 py-1 text-center rounded border text-xs transition-colors ${
                                    modified
                                      ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold"
                                      : "border-gray-200 text-gray-700"
                                  } focus:outline-none focus:ring-1 focus:ring-blue-400`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 3: Lignes overrides */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowLignes((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span>
                  {showLignes ? "▼" : "▶"} Modifier les ouvertures de lignes
                  {lignesChangeCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {lignesChangeCount} ligne{lignesChangeCount > 1 ? "s" : ""} modifiée{lignesChangeCount > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              </button>

              {showLignes && editLignes && (
                <div className="p-4 overflow-x-auto border-t border-gray-200">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Ligne</th>
                        {Object.keys(PARAM_LABELS).map((k) => (
                          <th key={k} className="px-2 py-1.5 text-center font-semibold text-gray-600 min-w-[70px]">
                            {PARAM_LABELS[k]}
                          </th>
                        ))}
                        <th className="px-3 py-1.5 text-center font-semibold text-gray-600">TO (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_LINES.map((lid) => {
                        const params = editLignes[lid];
                        const to = computeTO(params);
                        return (
                          <tr key={lid} className="border-t border-gray-100">
                            <td className="px-3 py-1 font-medium text-gray-700">{lid}</td>
                            {(Object.keys(PARAM_LABELS) as LigneParamKey[]).map((k) => {
                              const constraint = LIGNE_CONSTRAINTS[k];
                              const modified = isLigneModified(lid, k);
                              return (
                                <td key={k} className="px-1 py-0.5">
                                  <input
                                    type="number"
                                    min={constraint.min}
                                    max={constraint.max}
                                    step={constraint.step}
                                    value={params[k]}
                                    disabled={constraint.fixed}
                                    onChange={(e) => handleLigneChange(lid, k, e.target.value)}
                                    className={`w-full px-1.5 py-1 text-center rounded border text-xs transition-colors ${
                                      constraint.fixed
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                                        : modified
                                        ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold"
                                        : "border-gray-200 text-gray-700"
                                    } focus:outline-none focus:ring-1 focus:ring-blue-400`}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-3 py-1 text-center font-mono text-gray-600">
                              {to.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Error message */}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={creating || !name.trim()}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {creating
              ? rule === "GA_OPTIMIZED"
                ? "Optimisation AG en cours..."
                : "Calcul en cours..."
              : "Créer le scénario"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          {(pdpChangeCount > 0 || lignesChangeCount > 0) && (
            <span className="text-xs text-blue-600 font-medium">
              {pdpChangeCount > 0 && `${pdpChangeCount} modif. PDP`}
              {pdpChangeCount > 0 && lignesChangeCount > 0 && " · "}
              {lignesChangeCount > 0 && `${lignesChangeCount} ligne${lignesChangeCount > 1 ? "s" : ""} modifiée${lignesChangeCount > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
