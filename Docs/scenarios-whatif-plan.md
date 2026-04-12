# Plan: Scénarios What-If — Full Implementation

## Context

The spec requires: **"Simulation de scénarios de type what-if"** + **"Analyse de l'impact des scénarios sur la charge et les délais"** + **"Comparaison de plusieurs scénarios d'ordonnancement"**.

### What's Already Built
- Create scenario (name + rule) → runs scheduler → saves schedule + KPIs
- Scenario cards with 3 KPI metrics (OTD, Makespan, Late count)
- Select 2-3 for comparison table (6 metrics, winner highlighting)
- Clone, Delete, Apply (pushes to scheduleStore → updates Gantt/KPI)
- GA optimizer integration
- Zustand store + API routes

### What's Missing (the "What-If" part)
Currently, scenarios only vary the **scheduling rule**. A true What-If system needs to answer:

1. **"What if we change the scheduling rule?"** → already works
2. **"What if we change PDP quantities?"** → e.g. what if we produce 10 batches of P1 in March instead of 5?
3. **"What if we change line capacity?"** → e.g. what if we add a 2nd shift on line I?

Without #2 and #3, the system is just a rule comparison tool, not a What-If simulator.

Also missing:
- No way to see **which parameters differ** between scenarios
- No **rename/edit** after creation
- No **export** of comparison results
- Scenario cards don't show capacity/charge impact (only scheduler KPIs)
- No visual diff of what changed between scenarios

---

## Design

### Scenario Data Model

Add two optional override fields to Scenario:

```
model Scenario {
  id             String   @id @default(cuid())
  name           String
  description    String?
  pdpId          String
  schedulingRule String
  schedule       String          // JSON: Schedule
  kpis           String          // JSON: KPIResult
  pdpOverrides   String?         // JSON: Partial<PDPData> — only changed cells (NEW)
  lignesOverrides String?        // JSON: Partial<OuvertureLignesData> — only changed params (NEW)
  createdAt      DateTime @default(now())
}
```

- `pdpOverrides`: stores only the cells that differ from the base PDP. e.g. `{"P1": {"mar": 10}}` means "P1 March changed from 5 to 10"
- `lignesOverrides`: stores only the params that differ from the base Lignes. e.g. `{"I": {"shifts": 2}}` means "Line I shifts changed from 1 to 2"
- `null` = no overrides (use base data as-is)

When creating a scenario, the API merges base data + overrides → runs scheduler → stores result.

---

## Changes

### 1. `prisma/schema.prisma` — Add override fields

```diff
model Scenario {
  ...
+ pdpOverrides    String?
+ lignesOverrides String?
  createdAt       DateTime @default(now())
}
```

Run `npx prisma db push` after.

### 2. `src/lib/data/types.ts` — Add override types

```ts
// Sparse override types — only changed values
export type PDPOverrides = Partial<Record<ProductId, Partial<Record<MonthKey, number>>>>;
export type LignesOverrides = Partial<Record<LineId, Partial<LigneParams>>>;
```

### 3. `src/lib/data/merge.ts` — NEW merge utility

```ts
export function mergePDP(base: PDPData, overrides: PDPOverrides | null): PDPData { ... }
export function mergeLignes(base: OuvertureLignesData, overrides: LignesOverrides | null): OuvertureLignesData { ... }
export function diffPDP(base: PDPData, modified: PDPData): PDPOverrides { ... }
export function diffLignes(base: OuvertureLignesData, modified: OuvertureLignesData): LignesOverrides { ... }
```

Immutable deep merge. `diffPDP` extracts only changed cells (for storage efficiency).

### 4. `src/app/api/scenarios/route.ts` — Accept overrides in POST

**Current**: `POST { name, description, rule }` → fetches base data → runs scheduler
**New**: `POST { name, description, rule, pdpOverrides?, lignesOverrides? }` → fetches base → merges overrides → runs scheduler → saves overrides to DB

```ts
// POST handler changes:
const pdpOverrides = body.pdpOverrides ?? null;
const lignesOverrides = body.lignesOverrides ?? null;

const basePdp = ...; // from DB
const baseLignes = ...; // from DB
const effectivePdp = mergePDP(basePdp, pdpOverrides);
const effectiveLignes = mergeLignes(baseLignes, lignesOverrides);

// Run scheduler with effective data
const schedule = runScheduler(effectivePdp, gammes, rule);
const kpis = computeKPIs(schedule, effectiveLignes);

// Save scenario with overrides
await prisma.scenario.create({
  data: {
    ...
    pdpOverrides: pdpOverrides ? JSON.stringify(pdpOverrides) : null,
    lignesOverrides: lignesOverrides ? JSON.stringify(lignesOverrides) : null,
  },
});
```

### 5. `src/app/api/scenarios/clone/route.ts` — Clone includes overrides

Copy `pdpOverrides` and `lignesOverrides` from source scenario.

### 6. `src/stores/scenarioStore.ts` — Update types

```ts
export interface ScenarioRecord {
  id: string;
  name: string;
  description: string | null;
  pdpId: string;
  schedulingRule: string;
  schedule: string;
  kpis: string;
  pdpOverrides: string | null;     // NEW
  lignesOverrides: string | null;  // NEW
  createdAt: string;
}
```

Add `renameScenario(id, name, description)` method.

### 7. `src/app/scenarios/ScenariosClient.tsx` — Major enhancement

**A) Enhanced creation form with What-If parameters:**

Replace the simple name+rule form with a multi-step flow:

**Step 1 — Base config** (always visible):
- Name, Description, Scheduling Rule (same as now)

**Step 2 — PDP Overrides** (collapsible section):
- "Modifier le PDP pour ce scénario" toggle
- When expanded: compact grid showing all products × months
- Pre-filled with current base PDP values
- Changed cells highlighted in blue
- User edits cells to create what-if quantities
- Only the diff is saved as overrides

**Step 3 — Lignes Overrides** (collapsible section):
- "Modifier les ouvertures de lignes" toggle
- When expanded: table of lines A-J with 5 params each
- Pre-filled with current base values
- Changed cells highlighted in blue
- Constraint validation (same as smart-proposals-plan: weeks≤4.2, coeff≤1, shifts≤3, days≤7, hours=7)
- Only the diff is saved as overrides

**"Créer" button** → sends rule + pdpOverrides + lignesOverrides to API

**B) Scenario cards — show override badges:**

On each ScenarioCard, if the scenario has overrides:
- Badge: "PDP modifié" (with count of changed cells)
- Badge: "Lignes modifiées" (with list of changed lines)
- These help users understand what's different about each scenario

**C) Rename support:**
- Double-click scenario name to edit inline
- PATCH API to update name/description

### 8. `src/components/scenarios/ScenarioCard.tsx` — Show overrides

- Parse `pdpOverrides` and `lignesOverrides` from scenario record
- Show override badges below the rule badge
- Clicking a badge shows a tooltip/popover with the specific changes

### 9. `src/components/scenarios/ScenarioComparison.tsx` — Enhanced comparison

**Add new rows to comparison table:**
- "PDP modifié" row: shows which products/months changed (or "Base" if no overrides)
- "Lignes modifiées" row: shows which lines changed (or "Base" if no overrides)
- Add "Occupation max %" row using KPI occupation data (already there)
- Add "Capacité min (h)" row: min(CD_j) across all lines

**Add export button:**
- Export comparison table to Excel (xlsx)

### 10. `src/components/scenarios/ScenarioCreateForm.tsx` — NEW component

Extract the creation form from ScenariosClient into its own component to keep file sizes manageable.

Contains:
- Step 1: Name + Rule
- Step 2: PDP override grid (collapsible)
- Step 3: Lignes override table (collapsible)
- Real-time TO calculation for lignes changes
- Submit handler

### 11. `src/app/api/scenarios/route.ts` — Add PATCH for rename

```ts
export async function PATCH(req: NextRequest) {
  // Auth check
  const { id, name, description } = body;
  await prisma.scenario.update({
    where: { id },
    data: { name, description },
  });
  return NextResponse.json({ success: true });
}
```

---

## File Summary

| File | Action | ~Lines |
|------|--------|--------|
| `prisma/schema.prisma` | MODIFY | +2 |
| `src/lib/data/types.ts` | MODIFY | +4 |
| `src/lib/data/merge.ts` | CREATE | ~60 |
| `src/app/api/scenarios/route.ts` | MODIFY | +40 (overrides in POST, add PATCH) |
| `src/app/api/scenarios/clone/route.ts` | MODIFY | +4 |
| `src/stores/scenarioStore.ts` | MODIFY | +20 (update types, add rename) |
| `src/components/scenarios/ScenarioCreateForm.tsx` | CREATE | ~200 |
| `src/app/scenarios/ScenariosClient.tsx` | MODIFY | -80/+30 (extract form to component) |
| `src/components/scenarios/ScenarioCard.tsx` | MODIFY | +25 (override badges) |
| `src/components/scenarios/ScenarioComparison.tsx` | MODIFY | +40 (new rows, export) |

---

## User Flow

### Basic (already works)
```
1. Go to Scenarios → Create "EDD Baseline" with rule EDD → see KPIs
2. Create "SPT Test" with rule SPT → see different KPIs
3. Select both → comparison table → see winner per metric
4. Apply best one → Gantt + KPI pages updated
```

### New: What-If PDP
```
1. Create "Rush P1 Mars" scenario
2. Toggle "Modifier le PDP" → change P1 March from 5 to 15
3. Pick rule EDD → Create
4. Compare with baseline → see impact: OTD drops, occupation goes up
5. Conclusion: "Rush production of P1 in March causes overload on line I"
```

### New: What-If Lignes
```
1. Create "Double shift Line I" scenario
2. Toggle "Modifier les ouvertures" → Line I: shifts 1→2
3. Pick rule EDD → Create
4. Compare with baseline → occupation on I drops from 112% to 56%
5. Conclusion: "Adding 2nd shift on line I resolves the bottleneck"
```

### New: Combined What-If
```
1. Create "Rush P1 + Extra capacity" scenario
2. Modify PDP: P1 March = 15
3. Modify Lignes: Line I shifts = 2
4. Compare with "Rush P1 Mars" (no extra capacity) → see that added shift absorbs the rush
```

---

## Implementation Order

1. Schema migration + merge utility (foundation)
2. API changes (POST with overrides, PATCH rename, clone with overrides)
3. ScenarioCreateForm component (the main new UI)
4. ScenarioCard override badges
5. ScenarioComparison enhancements
6. ScenariosClient integration
7. Build verification

---

## Verification

1. `npx prisma db push` — migration succeeds
2. `npx next build` — 0 type errors
3. Create scenario with no overrides → works as before (backward compatible)
4. Create scenario with PDP override → KPIs differ from baseline
5. Create scenario with Lignes override → occupation changes
6. Clone scenario → overrides are preserved
7. Comparison table shows override info + new rows
8. Override badges visible on scenario cards
9. Rename scenario works
10. Constraint validation on lignes overrides (shifts ≤ 3, etc.)
