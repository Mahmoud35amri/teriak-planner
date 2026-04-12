# Plan: Move Proposals Into Plan de Charge (Conditional)

## Concept

The Plan de Charge page shows occupation per line per month. When the user sees a line is **overloaded (> 100%)**, they should be able to **fix it right there** — not navigate to a separate page.

**Flow:**
```
Plan de Charge → user selects a month → sees occupation chart
  → Line I is at 112% (RED, > 100%) = NON FEASIBLE
  → A button appears: "Proposer une modification"
  → User clicks it → proposals panel slides open below the chart
  → User can submit a proposal to change Ouverture Lignes for that line
  → (Planificateur can also approve/reject existing proposals here)
```

If **all lines are ≤ 100%** for the selected month → no button, no proposals panel. The solution is feasible.

---

## Changes

### 1. `src/app/planning/charge/ChargeClient.tsx` — Main changes

**DELETE:**
- The entire "Capacité disponible annuelle par atelier (heures)" section (the annual capacity bar chart + its `capacityData` computation + Recharts imports for it: `ReferenceLine`, `Cell`)
- Remove `capacityData` useMemo
- Remove unused Recharts imports (keep only what MonthDrilldownChart needs — but MonthDrilldownChart handles its own imports, so ChargeClient may not need any Recharts imports at all)

**ADD:**
- Compute `overloadedLines` for the **selected month**: lines where `occupation > 100%`
- If `overloadedLines.length > 0`: show a red alert banner + "Proposer une modification" button
- State: `showProposals: boolean` (toggled by the button)
- When `showProposals` is true: render `<ProposalsPanel />` below the chart
- Pass `overloadedLines` and `selectedMonth` to the panel so it can pre-select the worst line

**Result — ChargeClient structure:**
```
AppShell
  ├── Header (title + subtitle)
  ├── Overload alert (annual, if any lines > 100% in any month)
  ├── Monthly nav bar (12 buttons)
  ├── MonthDrilldownChart (occupation per line for selected month)
  ├── [IF overload in selected month] Red banner + "Proposer une modification" button
  └── [IF showProposals] ProposalsPanel (inline, not a separate page)
```

### 2. `src/components/planning/ProposalsPanel.tsx` — NEW component

Extracted from `ProposalsClient.tsx` but adapted for inline use:

**Props:**
```ts
interface ProposalsPanelProps {
  canSubmit: boolean;
  canApprove: boolean;
  defaultWorkshop?: LineId;        // pre-select the overloaded line
  onApplied?: () => void;          // callback when a proposal is approved → refetch data
}
```

**Contains:**
- Submit form (same as current ProposalsClient form)
  - Workshop pre-selected to `defaultWorkshop` (the overloaded line)
  - All 5 Ouverture Lignes params with constraint validation
  - Justification field
  - Submit button
- List of existing proposals (filtered to relevant workshop or all)
- Approve/Reject buttons for Planificateur
- When a proposal is approved → calls `onApplied()` so ChargeClient can refetch data and recalculate occupation

**Differences from current ProposalsClient:**
- No AppShell wrapper (it's embedded in ChargeClient's AppShell)
- Collapsible with a close button
- More compact layout (no full-page padding)
- Pre-selected workshop based on the overloaded line

### 3. `src/app/planning/charge/page.tsx` — Pass canSubmit/canApprove props

Currently only passes nothing to ChargeClient. Need to check session role and pass proposal permissions.

```ts
export default async function ChargePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "canViewBusinessData")) redirect("/dashboard");

  const canSubmit = can(session.role, "canSubmitProposals");
  const canApprove = can(session.role, "canApproveProposals");

  return <ChargeClient canSubmit={canSubmit} canApprove={canApprove} />;
}
```

### 4. `src/app/proposals/ProposalsClient.tsx` — Refactor to use shared panel

Two options:
- **Option A**: Keep the `/proposals` page as-is (it still works independently) and extract shared logic into ProposalsPanel
- **Option B**: The `/proposals` page just renders `<ProposalsPanel />` inside an AppShell

**Go with Option B** — the ProposalsPanel is the single source of truth. The `/proposals` page becomes a thin wrapper:

```tsx
// proposals/ProposalsClient.tsx
export default function ProposalsClient({ canSubmit, canApprove }: Props) {
  return (
    <AppShell title="Propositions de modification">
      <ProposalsPanel canSubmit={canSubmit} canApprove={canApprove} />
    </AppShell>
  );
}
```

### 5. `src/app/planning/charge/ChargeClient.tsx` — Detection logic

```ts
// For selected month: which lines are overloaded?
const overloadedInMonth = useMemo(() => {
  if (!monthlyCH || !monthlyTO) return [];
  return ALL_LINES.filter((line) => {
    const ch = monthlyCH[selectedMonth][line];
    const to = monthlyTO[line];
    return to > 0 && (ch / to) * 100 > 100;
  });
}, [selectedMonth, monthlyCH, monthlyTO]);

// Worst overloaded line (for pre-selecting in proposals)
const worstLine = useMemo(() => {
  if (!monthlyCH || !monthlyTO || overloadedInMonth.length === 0) return undefined;
  let worst: LineId = overloadedInMonth[0];
  let worstPct = 0;
  for (const line of overloadedInMonth) {
    const pct = (monthlyCH[selectedMonth][line] / monthlyTO[line]) * 100;
    if (pct > worstPct) { worstPct = pct; worst = line; }
  }
  return worst;
}, [selectedMonth, monthlyCH, monthlyTO, overloadedInMonth]);
```

---

## File Summary

| File | Action | ~Lines |
|------|--------|--------|
| `src/app/planning/charge/ChargeClient.tsx` | MODIFY | -30 (delete capacity chart) / +40 (overload detection + button + panel toggle) |
| `src/app/planning/charge/page.tsx` | MODIFY | +6 (add canSubmit/canApprove props) |
| `src/components/planning/ProposalsPanel.tsx` | CREATE | ~180 (extracted from ProposalsClient) |
| `src/app/proposals/ProposalsClient.tsx` | MODIFY | -200/+10 (thin wrapper around ProposalsPanel) |

---

## UI Mockup

### When feasible (all lines ≤ 100%):
```
┌──────────────────────────────────────────────┐
│  Plan de Charge                              │
│  Taux d'occupation par atelier               │
│                                              │
│  [Jan] [Fév] [Mar] [Avr] ...  [Déc]         │
│                                              │
│  ┌─ Mars — taux d'occupation par atelier ──┐ │
│  │  A  ████████████ 72%                    │ │
│  │  B  █████████████████ 85%               │ │
│  │  C  ████████ 55%                        │ │
│  │  ...                                    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  (no button — everything is feasible)        │
└──────────────────────────────────────────────┘
```

### When NON feasible (line > 100%):
```
┌──────────────────────────────────────────────┐
│  Plan de Charge                              │
│                                              │
│  [Jan] [Fév] [Mar▼] [Avr] ...               │
│                                              │
│  ┌─ Mars — taux d'occupation par atelier ──┐ │
│  │  A  ████████████ 72%                    │ │
│  │  I  ██████████████████████████ 112% RED │ │
│  │  ...                                    │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─ ALERT (red) ──────────────────────────┐  │
│  │  Solution non réalisable — Atelier I   │  │
│  │  dépasse 100% en Mars (112%)           │  │
│  │                                        │  │
│  │  [Proposer une modification]  (button) │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ Propositions (expanded) ──────────────┐  │
│  │  Atelier: [I ▼]                        │  │
│  │  Semaines: [4.2]  Coeff: [1]           │  │
│  │  Postes/jour: [2]  Jours/sem: [7]      │  │
│  │  Heures/poste: [7] (fixe)              │  │
│  │                                        │  │
│  │  Justification: [____________]         │  │
│  │  [Soumettre la proposition]            │  │
│  │                                        │  │
│  │  ── Propositions existantes ──         │  │
│  │  Atelier I — shifts:2 — En attente     │  │
│  │    [Approuver] [Rejeter]               │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## Verification

1. `npx next build` — 0 type errors
2. Plan de Charge: annual capacity chart is GONE
3. Select a month where all lines ≤ 100% → no button, no proposals
4. Select a month where a line > 100% → red alert + button appears
5. Click button → proposals panel opens with overloaded line pre-selected
6. Submit proposal → appears in the list
7. Planificateur approves → data refreshes → occupation recalculated
8. `/proposals` page still works independently (thin wrapper)
9. Responsable Atelier sees submit form, Planificateur sees approve/reject
