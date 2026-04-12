"use client";

import { useScheduleStore } from "@/stores/scheduleStore";
import { SchedulingRule } from "@/lib/data/types";

const RULES: { value: SchedulingRule; label: string }[] = [
  { value: "SPT", label: "SPT — Temps le plus court en premier" },
  { value: "EDD", label: "EDD — Date d'échéance la plus proche" },
  { value: "CR",  label: "CR — Ratio critique" },
  { value: "LPT", label: "LPT — Temps le plus long en premier" },
  { value: "GA_OPTIMIZED", label: "GA — Algorithme génétique (optimiseur IA)" },
];

interface Props {
  canRun: boolean;
}

export default function SchedulerPanel({ canRun }: Props) {
  const { rule, loading, error, schedule, setRule, runSchedule } =
    useScheduleStore();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="text-sm font-medium text-gray-700 shrink-0">
        Règle d'ordonnancement:
      </span>
      <select
        value={rule}
        onChange={(e) => setRule(e.target.value as SchedulingRule)}
        disabled={loading || !canRun}
        className="text-sm text-gray-900 border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[280px] disabled:opacity-50"
      >
        {RULES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {canRun && (
        <button
          onClick={() => void runSchedule()}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
        >
          {loading ? "Calcul en cours..." : "Planifier"}
        </button>
      )}

      {error && <span className="text-sm text-red-600">{error}</span>}

      {schedule && !loading && (
        <span className="text-xs text-gray-500 ml-auto">
          {schedule.lots.length} lots planifiés — makespan:{" "}
          {Math.round(schedule.makespan)} h
        </span>
      )}
    </div>
  );
}
