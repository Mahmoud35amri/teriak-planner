# Plan: What-If Simulation + Impact Analysis

## Two Spec Requirements

1. **Simulation de scénarios de type what-if** — vary PDP quantities and/or Lignes capacity per scenario, not just the scheduling rule
2. **Analyse de l'impact des scénarios sur la charge et les délais** — comparison table shows impact on occupation (charge) and delivery delays (délais)

---

## What Exists vs What's Missing

| Feature | Status |
|---------|--------|
| Create scenario with different scheduling rule | DONE |
| Compare KPIs (OTD, makespan, tardiness) | DONE |
| **Modify PDP per scenario** (what-if quantities) | MISSING |
| **Modify Lignes per scenario** (what-if capacity) | MISSING |
| **Show charge impact** (occupation %) in comparison | MISSING |
| **Show délais impact** (late lots, tardiness) in comparison | PARTIAL (exists but incomplete) |
| See what parameters differ between scenarios | MISSING |

---

## Implementation Steps

### Step 1: Schema + Data Layer

**`prisma/schema.prisma`** — add 2 nullable fields to Scenario:
```diff
model Scenario {
   ...
+  pdpOverrides    String?
+  lignesOverrides String?
   createdAt       DateTime @default(now())
}
```
Then run `npx prisma db push`. Nullable = backward compatible, existing scenarios unaffected.

**`src/lib/data/types.ts`** — add override types:
```ts
export type PDPOverrides = Partial<Record<ProductId, Partial<Record<MonthKey, number>>>>;
export type LignesOverrides = Partial<Record<LineId, Partial<LigneParams>>>;
```

**`src/lib/data/merge.ts`** — NEW file (~50 lines):
```ts
// Immutable merge: base + sparse overrides → full data
export function mergePDP(base: PDPData, overrides: PDPOverrides | null): PDPData
export function mergeLignes(base: OuvertureLignesData, overrides: LignesOverrides | null): OuvertureLignesData

// Extract only changed cells (for storage)
export function diffPDP(base: PDPData, modified: PDPData): PDPOverrides
export function diffLignes(base: OuvertureLignesData, modified: OuvertureLignesData): LignesOverrides

// Count changes (for badges)
export function countPDPChanges(overrides: PDPOverrides | null): number
export function countLignesChanges(overrides: LignesOverrides | null): string[]  // returns changed line IDs
```

### Step 2: API Changes

**`src/app/api/scenarios/route.ts`** — POST accepts overrides:
```
Current:  POST { name, description, rule }
New:      POST { name, description, rule, pdpOverrides?, lignesOverrides? }
```
- Fetch base PDP + Gammes + Lignes from DB
- Merge with overrides: `effectivePdp = mergePDP(basePdp, pdpOverrides)`
- Run scheduler with effective data
- Compute KPIs with effective lignes
- Save scenario with overrides fields

Add PATCH handler for rename:
```
PATCH { id, name, description }  → update scenario name/description
```

**`src/app/api/scenarios/clone/route.ts`** — copy `pdpOverrides` and `lignesOverrides` from source.

**`src/stores/scenarioStore.ts`** — update `ScenarioRecord` type to include `pdpOverrides: string | null` and `lignesOverrides: string | null`. Add `renameScenario()` method.

### Step 3: Scenario Creation Form (What-If UI)

**`src/components/scenarios/ScenarioCreateForm.tsx`** — NEW component (~220 lines)

The form has 3 sections:

**Section 1 — Base** (always visible):
```
Nom: [_______________]  Description: [_______________]
Règle: [EDD ▼]
```

**Section 2 — PDP** (collapsible, collapsed by default):
```
[▶ Modifier le PDP pour ce scénario]

When expanded:
┌──────┬─────┬─────┬─────┬─────┬───┐
│      │ Jan │ Fév │ Mar │ Avr │...│
├──────┼─────┼─────┼─────┼─────┼───┤
│ P1   │  5  │  3  │ [15]│  4  │   │  ← blue = modified
│ P2   │  2  │  4  │  3  │  2  │   │
│ ...  │     │     │     │     │   │
└──────┴─────┴─────┴─────┴─────┴───┘
```
- Pre-filled with current base PDP from `/api/pdp`
- Modified cells turn blue
- Only the diff is sent to API

**Section 3 — Lignes** (collapsible, collapsed by default):
```
[▶ Modifier les ouvertures de lignes]

When expanded:
┌──────┬──────┬───────┬────────┬─────────┬──────────┬────────┐
│ Ligne│ Sem. │ Coeff │Post/j  │ Jours/s │ Heures/p │ TO     │
├──────┼──────┼───────┼────────┼─────────┼──────────┼────────┤
│  A   │ 4.2  │  1    │   1    │    7    │   7      │ 205.8  │
│  I   │ 4.2  │  1    │  [2]   │    7    │   7      │ 411.6  │ ← blue
└──────┴──────┴───────┴────────┴─────────┴──────────┴────────┘
```
- Pre-filled with current base Lignes from `/api/lignes`
- Constraints enforced: weeks≤4.2, coeff≤1, shifts≤3, days≤7, hours=7 (disabled)
- Live TO calculation per line
- Modified cells turn blue
- Only the diff is sent to API

**Create button** → POST to `/api/scenarios` with rule + pdpOverrides + lignesOverrides

### Step 4: Scenario Cards — Override Badges

**`src/components/scenarios/ScenarioCard.tsx`** — add badges showing what was changed:

```
┌─────────────────────────────────┐
│ ☐ Rush P1 Mars                  │
│   EDD — Échéance la plus proche │
│   [PDP: 1 modif.] [Lignes: I]  │  ← NEW badges
│                                 │
│   95%    4200    2              │
│   OTD    Makespan  En retard   │
│                                 │
│   [Appliquer] [Cloner] [Suppr] │
└─────────────────────────────────┘
```

- "PDP: N modif." badge (blue) if pdpOverrides is not null
- "Lignes: I, J" badge (blue) listing modified lines if lignesOverrides is not null
- No badge if no overrides (baseline scenario)

### Step 5: Impact Analysis — Enhanced Comparison Table + Charts

**`src/components/scenarios/ScenarioComparison.tsx`** — add charge + délais rows:

Current rows:
- Makespan (h)
- OTD (%)
- Lots en retard
- Retard moyen (h)
- Retard max (h)
- Occupation max (%)

**Add these new rows:**

| Row | Source | Measures |
|-----|--------|----------|
| **Occupation max (%)** | `max(kpis.occupation)` | Charge impact — already exists |
| **Ligne goulot** | line with max occupation | Which line is the bottleneck |
| **Capacité min (h)** | `min(TO_j - CH_j)` across lines | Most constrained line's remaining hours |
| **Modifications PDP** | pdpOverrides | "P1 Mar: 5→15" or "Base" |
| **Modifications Lignes** | lignesOverrides | "I: shifts 1→2" or "Base" |

The **winner highlighting** logic:
- Occupation max: lower is better (green)
- Capacité min: higher is better (green)
- Modifications rows: no winner (informational)

**Add export button**: exports comparison table to Excel using `xlsx`.

### Step 6: Visual Impact Charts

**`src/components/scenarios/ScenarioImpactCharts.tsx`** — NEW component (~150 lines)

Rendered below the comparison table when 2+ scenarios are selected. Uses Recharts.

**Chart 1 — Occupation par atelier (grouped bar chart):**
- X axis: lines A–J
- Y axis: occupation %
- One bar group per line, one colored bar per scenario
- Reference line at 100% (red dashed)
- Legend shows scenario names + colors
- Instantly shows which lines get worse/better across scenarios

```
  %
140│            ┌─┐
120│            │R│
100│- - - - - - │-│- - - - - - -  ← 100% threshold
 80│   ┌─┐     │u│ ┌─┐
 60│   │B│ ┌─┐ │s│ │B│
 40│   │a│ │B│ │h│ │a│
 20│   │s│ │a│ └─┘ │s│
  0└───┴─┴─┴─┴─────┴─┴────
      A    B    I    J
```

**Chart 2 — KPI Delta cards (before/after):**
- Shows the first selected scenario as "Base" and others as deltas
- 4 compact cards in a row:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ OTD          │ │ Retards      │ │ Makespan     │ │ Occ. max     │
│ 98% → 71%   │ │ 1 → 8        │ │ 4200 → 5800  │ │ 82% → 134%   │
│ ▼ -27%  RED  │ │ ▲ +7   RED   │ │ ▲ +38%  RED  │ │ ▲ +52%  RED  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

- Arrow up/down + percentage change
- Green if improved (OTD up, others down), Red if degraded
- If 3 scenarios selected: shows delta cards for each non-base scenario

**Props:**
```ts
interface ScenarioImpactChartsProps {
  scenarios: ParsedScenario[];  // 2-3 selected scenarios
}
```

**Behavior:**
- First scenario in the selection = reference ("Base")
- Charts compare all others against the base
- If only 1 scenario selected: no charts (need at least 2)
- Occupation data comes from `kpis.occupation` (per-line %)
- KPI deltas computed inline

### Step 6: Wire It Together

**`src/app/scenarios/ScenariosClient.tsx`**:
- Replace inline creation form with `<ScenarioCreateForm />`
- Pass `onCreated` callback to refetch scenarios
- Fetch base PDP + Lignes on mount (needed for the form's pre-fill)
- Rest stays the same (scenario grid, comparison, apply)

---

## File Summary

| File | Action | ~Lines |
|------|--------|--------|
| `prisma/schema.prisma` | MODIFY | +2 |
| `src/lib/data/types.ts` | MODIFY | +4 |
| `src/lib/data/merge.ts` | CREATE | ~50 |
| `src/app/api/scenarios/route.ts` | MODIFY | +45 |
| `src/app/api/scenarios/clone/route.ts` | MODIFY | +4 |
| `src/stores/scenarioStore.ts` | MODIFY | +15 |
| `src/components/scenarios/ScenarioCreateForm.tsx` | CREATE | ~220 |
| `src/app/scenarios/ScenariosClient.tsx` | MODIFY | -80/+20 |
| `src/components/scenarios/ScenarioCard.tsx` | MODIFY | +20 |
| `src/components/scenarios/ScenarioComparison.tsx` | MODIFY | +50 |
| `src/components/scenarios/ScenarioImpactCharts.tsx` | CREATE | ~150 |

---

## Example: Full What-If Flow

```
Planificateur wants to answer:
"Can we handle a rush order of 15 batches P1 in March?"

Step 1: Create "Baseline EDD"
  → Rule: EDD, no overrides
  → Result: OTD 98%, occupation max 82% (line I), 1 lot late

Step 2: Create "Rush P1 Mars"
  → Rule: EDD
  → PDP override: P1 March = 15 (was 5)
  → Result: OTD 71%, occupation max 134% (line I), 8 lots late

Step 3: Create "Rush P1 + 2e poste I"
  → Rule: EDD
  → PDP override: P1 March = 15
  → Lignes override: Line I shifts = 2
  → Result: OTD 95%, occupation max 78% (line I), 2 lots late

Step 4: Select all 3 → Comparison table:

┌─────────────────┬──────────┬──────────────┬───────────────────┐
│ Indicateur      │ Baseline │ Rush P1 Mars │ Rush + 2e poste   │
├─────────────────┼──────────┼──────────────┼───────────────────┤
│ OTD (%)         │ 98.0% ✓  │ 71.0%        │ 95.0%             │
│ Lots en retard  │ 1 ✓      │ 8            │ 2                 │
│ Makespan (h)    │ 4200 ✓   │ 5800         │ 4500              │
│ Retard max (h)  │ 12.0 ✓   │ 340.0        │ 24.0              │
│ Occupation max  │ 82% ✓    │ 134%         │ 78% ✓             │
│ Capacité min    │ 38h ✓    │ -72h         │ 45h ✓             │
│ Modif. PDP      │ Base     │ P1 Mar: 5→15 │ P1 Mar: 5→15      │
│ Modif. Lignes   │ Base     │ Base         │ I: shifts 1→2     │
└─────────────────┴──────────┴──────────────┴───────────────────┘

Conclusion: Rush is feasible with 2nd shift on line I.
Apply "Rush + 2e poste" → updates Gantt + KPI.
```

---

## Implementation Order

1. Schema migration + merge utility + types
2. API: POST with overrides, PATCH rename, clone with overrides
3. ScenarioCreateForm (PDP grid + Lignes table)
4. ScenarioCard badges
5. ScenarioComparison new rows + export
6. ScenarioImpactCharts (occupation bar chart + KPI delta cards)
7. ScenariosClient integration
8. Build + test

---

## Verification

1. `npx prisma db push` — migration succeeds
2. `npx next build` — 0 type errors
3. Create scenario with no overrides → same behavior as before
4. Create scenario with PDP override (change P1 March) → different KPIs
5. Create scenario with Lignes override (change shifts on I) → different occupation
6. Override badges appear on cards
7. Comparison table shows charge rows (occupation, capacity) + override info
8. Clone preserves overrides
9. Export comparison to Excel works
10. Lignes constraints enforced (shifts≤3, etc.)
11. Occupation bar chart shows grouped bars per line for selected scenarios
12. KPI delta cards show before/after with green/red arrows
