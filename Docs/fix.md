# Plan: Eliminate Page Redundancy Across Planning Pages

## Context

The 4 planning pages (Plan de Charge, Gantt, KPI, Scenarios) have accumulated significant redundancy through iterative development:
- KPI 2 occupation chart is an **exact duplicate** of the Plan de Charge chart
- Scheduler controls exist on both Gantt and KPI pages
- PDP/Gammes/Lignes fetching is copy-pasted between KPI and Charge pages
- `occupationColor()` is defined 3 times
- Monthly nav bar is duplicated on KPI and Charge pages

**Goal**: Each page gets a unique, non-overlapping responsibility.

---

## New Page Responsibilities

| Page | Purpose | Data Source |
|------|---------|-------------|
| **Plan de Charge** | Detailed capacity analysis (occupation + available capacity charts) | PDP x Gammes (no scheduler) |
| **Gantt** | Run scheduler + visualize timeline + quick KPI summary | scheduleStore |
| **KPI** | Performance summary dashboard (4 KPI cards + tardiness table + export) | scheduleStore + PDP for KPI 2/4 summaries |
| **Scenarios** | Compare scheduling strategies (unchanged) | scenarioStore |

---

## Changes Per File

### 1. `src/app/planning/charge/ChargeClient.tsx` — Add KPI 4 capacity chart

- **Add** annual available capacity bar chart (CD = TO x 12 - CH annual) below the MonthDrilldownChart
- Move this chart from KPIClient (lines 401-421) — it belongs with capacity analysis
- Import recharts components: `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell`
- Compute `capacityData` from existing `monthlyCH` + `monthlyTO` (same formula already in KPIClient lines 168-178)
- Import `occupationColor` from new shared module

### 2. `src/app/planning/charge/MonthDrilldownChart.tsx` — Use shared color util

- Replace local `occupationColor()` (line 30) with import from `src/lib/ui/colors.ts`

### 3. `src/app/planning/gantt/GanttClient.tsx` — Add compact KPI summary row

- Read `kpis` from `useScheduleStore()` (currently only reads `schedule`)
- Compute `lateLots` count from `schedule.lots`
- After `SchedulerPanel`, when `schedule && kpis`: render a 4-column grid of compact cards:
  - OTD % (color-coded)
  - Lots en retard (count)
  - Makespan (hours)
  - Retard max (hours)
- This gives immediate feedback after clicking "Planifier" without navigating away

### 4. `src/app/kpi/KPIClient.tsx` — Major simplification

**Remove entirely:**
- Recharts imports (lines 3-15) and all chart JSX
- Rule selector + Planifier button (lines 221-239)
- Auto-run scheduler on mount (lines 135-141)
- Monthly nav bar (lines 332-347)
- KPI 2 occupation chart (lines 357-399) — now exclusive to Plan de Charge
- KPI 4 capacity chart (lines 401-421) — moved to Plan de Charge
- Overload alert (lines 254-268) — lives on Plan de Charge only
- `selectedMonth` state, `occupationData`, `capacityData`, `overloadedLines` computations
- `CustomTooltipOcc`, `occupationColor`, `RULES` constant
- `canRun` prop, `rule`, `loading`, `error`, `runSchedule` from store

**Keep:**
- 4 summary cards (KPI 1: OTD, KPI 3: late count + avg/max tardiness)
- Tardiness table (top 20 late lots)
- Export Excel button + `exportKPIs` function
- `useScheduleStore` for reading `schedule` and `kpis` (read-only)

**Add (replace KPI 2/4 charts with compact summary cards):**
- Fetch PDP/Gammes/Lignes (keep existing fetch) to compute:
  - **KPI 2 card**: Max occupation value across all lines and months (e.g. "94.2% — Atelier I, Mars")
  - **KPI 4 card**: Count of bottleneck lines (annual CH > TO x 12) — e.g. "3 ateliers en surcharge"
- Info line: "Dernier ordonnancement: {rule} — {date}" from `schedule.generatedAt`
- The 4 KPI cards become: OTD | Occupation max | Retards | Goulots (all 4 always visible)

### 5. `src/app/kpi/page.tsx` — Remove canRun

- Remove `canRun` computation and prop passing
- Just render `<KPIClient />`

### 6. `src/lib/ui/colors.ts` — New shared utility

- Extract `occupationColor(pct: number): string` used by 3 files
- Single source of truth

### 7. `src/components/alerts/OverloadAlert.tsx` — Delete (dead code)

- Never imported anywhere (confirmed by grep — only in docs)

---

## Resulting User Flow

```
1. Edit PDP/Gammes/Lignes (data pages)
2. Plan de Charge → see capacity instantly (no scheduler needed)
   - Monthly occupation chart + annual capacity chart + overload alerts
3. Gantt → select rule → Planifier → see Gantt + quick KPI cards
   - OTD, late count, makespan, max tardiness visible immediately
4. KPI → see 4 summary cards + tardiness breakdown + export
   - All 4 KPIs as compact cards (no duplicate charts)
5. Scenarios → create/compare different rules → apply best one
```

---

## Verification

1. `npx next build` — 0 type errors
2. Plan de Charge: loads occupation chart + capacity chart, no scheduler needed
3. Gantt: after clicking Planifier, 4 KPI summary cards appear above the Gantt
4. KPI: shows 4 summary cards (KPI 2/4 from PDP data, KPI 1/3 from scheduler or "—")
5. KPI: no monthly nav bar, no occupation/capacity charts, no scheduler controls
6. Scenarios: unchanged, "Appliquer" still updates Gantt + KPI views
