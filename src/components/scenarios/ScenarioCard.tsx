"use client";

import { useState } from "react";
import { KPIResult, LignesOverrides, PDPOverrides, Schedule } from "@/lib/data/types";
import { ScenarioRecord } from "@/stores/scenarioStore";
import { countLignesChanges, countPDPChanges } from "@/lib/data/merge";

const RULE_LABELS: Record<string, string> = {
  SPT: "SPT — Plus court en premier",
  EDD: "EDD — Échéance la plus proche",
  CR: "CR — Ratio critique",
  LPT: "LPT — Plus long en premier",
  GA_OPTIMIZED: "GA — Algorithme génétique",
};

interface Props {
  scenario: ScenarioRecord;
  isSelected: boolean;
  isApplied: boolean;
  canManage: boolean;
  onToggleSelect: (id: string) => void;
  onApply: (id: string, schedule: Schedule, kpis: KPIResult) => void;
  onDelete: (id: string) => void;
  onClone: (id: string, newName: string) => void;
}

export default function ScenarioCard({
  scenario,
  isSelected,
  isApplied,
  canManage,
  onToggleSelect,
  onApply,
  onDelete,
  onClone,
}: Props) {
  const [cloning, setCloning] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const kpis = JSON.parse(scenario.kpis) as KPIResult;
  const schedule = JSON.parse(scenario.schedule) as Schedule;
  const lateCount = Object.values(kpis.tardiness).filter((t) => t > 0).length;
  const createdAt = new Date(scenario.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Override badges
  const pdpOv: PDPOverrides | null = scenario.pdpOverrides
    ? (JSON.parse(scenario.pdpOverrides) as PDPOverrides)
    : null;
  const lignesOv: LignesOverrides | null = scenario.lignesOverrides
    ? (JSON.parse(scenario.lignesOverrides) as LignesOverrides)
    : null;
  const pdpChangeCount = countPDPChanges(pdpOv);
  const lignesChangedLines = countLignesChanges(lignesOv);

  const handleApply = () => onApply(scenario.id, schedule, kpis);

  const handleCloneConfirm = () => {
    if (!cloneName.trim()) return;
    onClone(scenario.id, cloneName.trim());
    setCloning(false);
    setCloneName("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    onDelete(scenario.id);
  };

  return (
    <div
      className={`relative rounded-lg border-2 transition-colors p-4 ${
        isSelected
          ? "border-blue-400 bg-blue-50/40"
          : isApplied
          ? "border-green-400 bg-green-50/30"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Select checkbox */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(scenario.id)}
            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
          />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">{scenario.name}</h3>
            {scenario.description && (
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{scenario.description}</p>
            )}
          </div>
        </div>
        {isApplied && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
            Actif
          </span>
        )}
      </div>

      {/* Rule badge + GA improvement + Override badges */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-block text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
          {RULE_LABELS[scenario.schedulingRule] ?? scenario.schedulingRule}
        </span>
        {scenario.schedulingRule === "GA_OPTIMIZED" &&
          schedule.gaImprovement !== undefined &&
          schedule.gaImprovement > 0 && (
            <span className="inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">
              -{schedule.gaImprovement.toFixed(1)}% makespan
            </span>
          )}
        {pdpChangeCount > 0 && (
          <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
            PDP: {pdpChangeCount} modif.
          </span>
        )}
        {lignesChangedLines.length > 0 && (
          <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
            Lignes: {lignesChangedLines.join(", ")}
          </span>
        )}
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-base font-bold text-gray-900">{kpis.otd.toFixed(0)}%</div>
          <div className="text-xs text-gray-500">OTD</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-base font-bold text-gray-900">{Math.round(schedule.makespan)}</div>
          <div className="text-xs text-gray-500">Makespan (h)</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className={`text-base font-bold ${lateCount > 0 ? "text-red-600" : "text-green-600"}`}>
            {lateCount}
          </div>
          <div className="text-xs text-gray-500">En retard</div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">{createdAt}</p>

      {/* Clone input */}
      {cloning && (
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCloneConfirm()}
            placeholder="Nom du clone"
            autoFocus
            className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleCloneConfirm}
            disabled={!cloneName.trim()}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            OK
          </button>
          <button
            onClick={() => { setCloning(false); setCloneName(""); }}
            className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={handleApply}
          className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          Appliquer
        </button>
        {canManage && (
          <>
            <button
              onClick={() => { setCloning(true); setCloneName(`${scenario.name} (copie)`); }}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              Cloner
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1.5 text-xs border border-red-200 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
