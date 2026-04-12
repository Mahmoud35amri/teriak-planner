"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ALL_LINES, KPIResult, Schedule } from "@/lib/data/types";
import { ScenarioRecord } from "@/stores/scenarioStore";

const SCENARIO_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];

interface ParsedScenario {
  id: string;
  name: string;
  kpis: KPIResult;
  makespan: number;
}

function parseScenario(s: ScenarioRecord): ParsedScenario {
  const kpis = JSON.parse(s.kpis) as KPIResult;
  const schedule = JSON.parse(s.schedule) as Schedule;
  return { id: s.id, name: s.name, kpis, makespan: schedule.makespan };
}

// ---- KPI Delta Card ----

interface DeltaCardProps {
  label: string;
  baseValue: number;
  newValue: number;
  format: (v: number) => string;
  lowerIsBetter: boolean;
  scenarioName: string;
}

function DeltaCard({ label, baseValue, newValue, format, lowerIsBetter, scenarioName }: DeltaCardProps) {
  const diff = newValue - baseValue;
  const pctChange = baseValue !== 0 ? ((diff / Math.abs(baseValue)) * 100) : 0;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const unchanged = diff === 0;

  return (
    <div className={`p-3 rounded-lg border ${
      unchanged
        ? "bg-gray-50 border-gray-200"
        : improved
        ? "bg-green-50 border-green-200"
        : "bg-red-50 border-red-200"
    }`}>
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900">
        {format(baseValue)} → {format(newValue)}
      </div>
      <div className={`text-xs font-semibold mt-1 ${
        unchanged ? "text-gray-400" : improved ? "text-green-600" : "text-red-600"
      }`}>
        {unchanged ? (
          "= Identique"
        ) : (
          <>
            {diff > 0 ? "▲" : "▼"} {diff > 0 ? "+" : ""}{pctChange.toFixed(0)}%
          </>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-0.5 truncate" title={scenarioName}>
        vs {scenarioName}
      </div>
    </div>
  );
}

// ---- Main Component ----

interface Props {
  scenarios: ScenarioRecord[];
}

export default function ScenarioImpactCharts({ scenarios }: Props) {
  const parsed = useMemo(() => scenarios.map(parseScenario), [scenarios]);

  if (parsed.length < 2) return null;

  const base = parsed[0];
  const others = parsed.slice(1);

  // ---- Chart 1: Occupation par atelier (grouped bar chart) ----
  const occupationData = useMemo(() => {
    return ALL_LINES.map((lid) => {
      const entry: Record<string, string | number> = { line: lid };
      parsed.forEach((p) => {
        entry[p.name] = parseFloat((p.kpis.occupation[lid] ?? 0).toFixed(1));
      });
      return entry;
    });
  }, [parsed]);

  return (
    <div className="mt-6 space-y-6">
      {/* Chart 1: Occupation by line */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-4">
          Occupation par atelier (%)
        </h4>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={occupationData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="line" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                borderColor: "#e5e7eb",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={100}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{ value: "100%", position: "right", fill: "#ef4444", fontSize: 11 }}
            />
            {parsed.map((p, i) => (
              <Bar
                key={p.id}
                dataKey={p.name}
                fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: KPI Delta cards */}
      {others.map((other) => (
        <div key={other.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            Impact : <span className="text-blue-600">{other.name}</span> vs{" "}
            <span className="text-gray-500">{base.name}</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DeltaCard
              label="OTD (%)"
              baseValue={base.kpis.otd}
              newValue={other.kpis.otd}
              format={(v) => v.toFixed(1) + "%"}
              lowerIsBetter={false}
              scenarioName={base.name}
            />
            <DeltaCard
              label="Lots en retard"
              baseValue={Object.values(base.kpis.tardiness).filter((t) => t > 0).length}
              newValue={Object.values(other.kpis.tardiness).filter((t) => t > 0).length}
              format={(v) => v.toString()}
              lowerIsBetter={true}
              scenarioName={base.name}
            />
            <DeltaCard
              label="Makespan (h)"
              baseValue={base.makespan}
              newValue={other.makespan}
              format={(v) => Math.round(v).toString()}
              lowerIsBetter={true}
              scenarioName={base.name}
            />
            <DeltaCard
              label="Occupation max (%)"
              baseValue={Math.max(...Object.values(base.kpis.occupation))}
              newValue={Math.max(...Object.values(other.kpis.occupation))}
              format={(v) => v.toFixed(1) + "%"}
              lowerIsBetter={true}
              scenarioName={base.name}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
