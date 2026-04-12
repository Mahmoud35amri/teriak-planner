"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ScenarioCard from "@/components/scenarios/ScenarioCard";
import ScenarioComparison from "@/components/scenarios/ScenarioComparison";
import ScenarioCreateForm from "@/components/scenarios/ScenarioCreateForm";
import ScenarioImpactCharts from "@/components/scenarios/ScenarioImpactCharts";
import { useScenarioStore } from "@/stores/scenarioStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { KPIResult, Schedule } from "@/lib/data/types";

interface Props {
  canManage: boolean;
}

export default function ScenariosClient({ canManage }: Props) {
  const { scenarios, loading, fetchScenarios, createScenario, deleteScenario, cloneScenario } =
    useScenarioStore();
  const setResult = useScheduleStore((s) => s.setResult);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);

  // Selection and comparison state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  useEffect(() => { void fetchScenarios(); }, [fetchScenarios]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 3) { next.add(id); }
      return next;
    });
  };

  const handleApply = (id: string, schedule: Schedule, kpis: KPIResult) => {
    setResult(schedule, kpis);
    setAppliedId(id);
    setApplyMessage("Scénario appliqué — les pages Analyse de Faisabilité, Gantt et KPI sont mises à jour.");
    setTimeout(() => setApplyMessage(null), 4000);
  };

  const handleDelete = async (id: string) => {
    await deleteScenario(id);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (appliedId === id) setAppliedId(null);
  };

  const handleClone = async (id: string, newName: string) => {
    await cloneScenario(id, newName);
  };

  const selectedScenarios = scenarios.filter((s) => selectedIds.has(s.id));

  return (
    <AppShell title="Scénarios What-If">
      {/* Apply notification */}
      {applyMessage && (
        <div className="mb-4 p-3 rounded-md text-sm border bg-green-50 border-green-200 text-green-700">
          {applyMessage}
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {scenarios.length} scénario{scenarios.length !== 1 ? "s" : ""} enregistré{scenarios.length !== 1 ? "s" : ""}
        </p>
        {canManage && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            + Nouveau scénario
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && canManage && (
        <ScenarioCreateForm
          createScenario={createScenario}
          onCreated={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Comparison notice */}
      {selectedIds.size >= 2 && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          {selectedIds.size} scénario{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""} — tableau de comparaison et graphiques ci-dessous
        </div>
      )}
      {selectedIds.size === 1 && (
        <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
          Sélectionnez 2 ou 3 scénarios pour les comparer.
        </div>
      )}

      {/* Scenario grid */}
      {loading && scenarios.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">Chargement...</div>
      ) : scenarios.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-lg">
          Aucun scénario. Créez le premier scénario via le bouton ci-dessus.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              isSelected={selectedIds.has(s.id)}
              isApplied={appliedId === s.id}
              canManage={canManage}
              onToggleSelect={handleToggleSelect}
              onApply={handleApply}
              onDelete={handleDelete}
              onClone={handleClone}
            />
          ))}
        </div>
      )}

      {/* Comparison table */}
      {selectedIds.size >= 2 && (
        <>
          <ScenarioComparison scenarios={selectedScenarios} />
          <ScenarioImpactCharts scenarios={selectedScenarios} />
        </>
      )}
    </AppShell>
  );
}
