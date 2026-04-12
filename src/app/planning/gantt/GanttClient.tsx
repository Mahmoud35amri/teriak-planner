"use client";

import { useState } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import SchedulerPanel from "@/components/planning/SchedulerPanel";
import AppShell from "@/components/layout/AppShell";
import { ALL_LINES, LineId, MonthKey, ProductId } from "@/lib/data/types";

interface Props {
  canRun: boolean;
}

const PRODUCT_COLORS: Record<ProductId, string> = {
  P1: "#3B82F6", P2: "#10B981", P3: "#F59E0B", P4: "#EF4444",
  P5: "#8B5CF6", P6: "#06B6D4", P7: "#EC4899", P8: "#84CC16",
  P9: "#F97316", P10: "#14B8A6", P11: "#6366F1", P12: "#F43F5E",
  P13: "#EAB308",
};

const MONTH_MARKS: { label: string; hours: number }[] = [
  { label: "Jan", hours: 0 },
  { label: "Fév", hours: 744 },
  { label: "Mar", hours: 1416 },
  { label: "Avr", hours: 2160 },
  { label: "Mai", hours: 2880 },
  { label: "Jun", hours: 3624 },
  { label: "Jul", hours: 4344 },
  { label: "Aoû", hours: 5088 },
  { label: "Sep", hours: 5832 },
  { label: "Oct", hours: 6552 },
  { label: "Nov", hours: 7296 },
  { label: "Déc", hours: 8016 },
  { label: "Fin", hours: 8760 },
];

const PIXELS_PER_HOUR = 0.5;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 56;

interface GanttOp {
  lotId: string;
  productId: ProductId;
  lineId: LineId;
  startTime: number;
  endTime: number;
  cleaningTime: number;
}

interface TooltipState {
  x: number;
  y: number;
  op: GanttOp;
}

export default function GanttClient({ canRun }: Props) {
  const { schedule, kpis } = useScheduleStore();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const makespan = schedule?.makespan ?? 0;
  const chartWidth = Math.max(800, makespan * PIXELS_PER_HOUR);
  const chartHeight = ALL_LINES.length * ROW_HEIGHT;

  // Compute late lots count
  const lateLots = schedule
    ? schedule.lots.filter((sl) => sl.completionTime > sl.lot.dueDate).length
    : 0;

  // Flatten all ops with product info, grouped by line
  const opsByLine = Object.fromEntries(
    ALL_LINES.map((l) => [l, [] as GanttOp[]])
  ) as Record<LineId, GanttOp[]>;

  if (schedule) {
    for (const sl of schedule.lots) {
      for (const op of sl.scheduledOps) {
        opsByLine[op.lineId].push({
          lotId: sl.lot.id,
          productId: sl.lot.productId,
          lineId: op.lineId,
          startTime: op.startTime,
          endTime: op.endTime,
          cleaningTime: op.cleaningTime,
        });
      }
    }
  }

  const toX = (hours: number) => hours * PIXELS_PER_HOUR;

  const visibleMonths = MONTH_MARKS.filter(
    (m, i) => i === 0 || m.hours <= makespan + 24
  );

  return (
    <AppShell title="Diagramme de Gantt">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Diagramme de Gantt</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ordonnancement des lots par atelier dans le temps
          </p>
        </div>

        <SchedulerPanel canRun={canRun} />

        {/* Compact KPI summary — visible after scheduling */}
        {schedule && kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">OTD</p>
              <p
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-mono)", color: kpis.otd >= 90 ? "#22C55E" : kpis.otd >= 70 ? "#F59E0B" : "#EF4444" }}
              >
                {kpis.otd.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Lots en retard</p>
              <p
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-mono)", color: lateLots === 0 ? "#22C55E" : "#EF4444" }}
              >
                {lateLots}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Makespan</p>
              <p className="text-2xl font-bold text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>
                {Math.round(schedule.makespan)} h
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Retard max</p>
              <p
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-mono)", color: kpis.maxTardiness > 0 ? "#EF4444" : "#22C55E" }}
              >
                {kpis.maxTardiness.toFixed(1)} h
              </p>
            </div>
          </div>
        )}

        {!schedule && (
          <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            Aucun plan calculé. Sélectionnez une règle et cliquez sur Planifier.
          </div>
        )}

        {schedule && schedule.lots.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            Le PDP ne contient aucun lot à planifier.
          </div>
        )}

        {schedule && schedule.lots.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Product legend */}
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100">
              {(Object.keys(PRODUCT_COLORS) as ProductId[])
                .filter((p) => schedule.lots.some((sl) => sl.lot.productId === p))
                .map((p) => (
                  <span key={p} className="flex items-center gap-1 text-xs text-gray-600">
                    <span
                      className="w-3 h-3 rounded-sm inline-block"
                      style={{ backgroundColor: PRODUCT_COLORS[p] }}
                    />
                    {p}
                  </span>
                ))}
            </div>

            {/* Scrollable Gantt */}
            <div className="overflow-x-auto">
              <div style={{ display: "flex", minWidth: chartWidth + LABEL_WIDTH }}>
                {/* Line labels column */}
                <div style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
                  {/* Header spacer */}
                  <div style={{ height: 28 }} />
                  {ALL_LINES.map((line, i) => (
                    <div
                      key={line}
                      style={{ height: ROW_HEIGHT }}
                      className={`flex items-center justify-center text-xs font-medium text-gray-600 border-b border-gray-100 ${
                        i % 2 === 0 ? "bg-gray-50" : "bg-white"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>

                {/* Chart area */}
                <div style={{ flex: 1, minWidth: chartWidth, position: "relative" }}>
                  {/* Month header */}
                  <div style={{ height: 28, position: "relative", borderBottom: "1px solid #E5E7EB" }}>
                    {visibleMonths.map((m) => (
                      <span
                        key={m.label}
                        style={{
                          position: "absolute",
                          left: toX(m.hours),
                          fontSize: 10,
                          color: "#9CA3AF",
                          transform: "translateX(-50%)",
                          top: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>

                  {/* Rows */}
                  {ALL_LINES.map((line, i) => (
                    <div
                      key={line}
                      style={{ height: ROW_HEIGHT, position: "relative" }}
                      className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                    >
                      {/* Month vertical guides */}
                      {visibleMonths.slice(1).map((m) => (
                        <div
                          key={m.label}
                          style={{
                            position: "absolute",
                            left: toX(m.hours),
                            top: 0,
                            bottom: 0,
                            width: 1,
                            backgroundColor: "#F3F4F6",
                          }}
                        />
                      ))}

                      {/* Operations */}
                      {opsByLine[line].map((op, idx) => {
                        const left = toX(op.startTime);
                        const prodWidth = Math.max(2, toX(op.endTime - op.startTime));
                        const cleanWidth = Math.max(0, toX(op.cleaningTime));
                        const color = PRODUCT_COLORS[op.productId];
                        return (
                          <div key={idx}>
                            {/* Production bar */}
                            <div
                              title={`${op.lotId} — Atelier ${op.lineId}\nDébut: ${op.startTime.toFixed(1)}h  Fin: ${op.endTime.toFixed(1)}h\nDurée prod: ${(op.endTime - op.startTime).toFixed(1)}h`}
                              style={{
                                position: "absolute",
                                left,
                                top: 6,
                                width: prodWidth,
                                height: ROW_HEIGHT - 14,
                                backgroundColor: color,
                                borderRadius: 3,
                                cursor: "pointer",
                                opacity: 0.85,
                              }}
                              onMouseEnter={(e) =>
                                setTooltip({ x: e.clientX, y: e.clientY, op })
                              }
                              onMouseMove={(e) =>
                                setTooltip({ x: e.clientX, y: e.clientY, op })
                              }
                              onMouseLeave={() => setTooltip(null)}
                            />
                            {/* Cleaning bar */}
                            {cleanWidth > 1 && (
                              <div
                                style={{
                                  position: "absolute",
                                  left: left + prodWidth,
                                  top: 6,
                                  width: cleanWidth,
                                  height: ROW_HEIGHT - 14,
                                  backgroundColor: color,
                                  opacity: 0.25,
                                  borderRadius: "0 3px 3px 0",
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Vertical makespan marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: toX(makespan),
                      top: 28,
                      bottom: 0,
                      width: 1,
                      backgroundColor: "#EF4444",
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              Barre claire = nettoyage — Ligne rouge = makespan ({Math.round(makespan)} h)
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded px-3 py-2 pointer-events-none shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-medium">{tooltip.op.lotId}</p>
          <p>Atelier: {tooltip.op.lineId}</p>
          <p>Début: {tooltip.op.startTime.toFixed(1)} h</p>
          <p>Fin prod: {tooltip.op.endTime.toFixed(1)} h</p>
          <p>Nettoyage: {tooltip.op.cleaningTime.toFixed(1)} h</p>
        </div>
      )}
    </AppShell>
  );
}
