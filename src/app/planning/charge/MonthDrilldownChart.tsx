"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import { LineId, MonthKey, MONTH_LABELS } from "@/lib/data/types";
import { occupationColor } from "@/lib/ui/colors";

interface LineDatum {
  line: LineId;
  occupation: number;
  ch: number;
  to: number;
}

interface Props {
  month: MonthKey;
  data: LineDatum[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: LineDatum }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm px-3 py-2 text-xs text-gray-700">
      <p className="font-medium mb-1">Atelier {d.line}</p>
      <p>Occupation : <span className="font-semibold">{d.occupation.toFixed(1)}%</span></p>
      <p>CH : {d.ch.toFixed(1)} h</p>
      <p>TO : {d.to.toFixed(1)} h</p>
    </div>
  );
};

export default function MonthDrilldownChart({ month, data }: Props) {
  const maxOccupation = Math.max(...data.map((d) => d.occupation), 110);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-gray-700">
          {MONTH_LABELS[month]} — taux d&apos;occupation par atelier (%)
        </h2>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />

          {/* Qualitative scale bands */}
          <ReferenceArea x1={0} x2={70} fill="#22C55E" fillOpacity={0.06} />
          <ReferenceArea x1={70} x2={85} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea x1={85} x2={maxOccupation} fill="#EF4444" fillOpacity={0.06} />

          <XAxis
            type="number"
            domain={[0, maxOccupation]}
            tick={{ fontSize: 11 }}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="line"
            tick={{ fontSize: 12 }}
            width={30}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={100} stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 2" />

          <Bar dataKey="occupation" radius={[0, 3, 3, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell key={entry.line} fill={occupationColor(entry.occupation)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 justify-end">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          &lt; 70%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
          70–85%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          &gt; 85%
        </span>
      </div>
    </div>
  );
}
