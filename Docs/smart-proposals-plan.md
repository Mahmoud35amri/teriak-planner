# Plan: Smart Proposals — Auto-Detect Problems & Suggest Ouverture Lignes Changes

## Context

The current "Propositions de modification" page is a **manual form** — a Responsable Atelier picks a line, fills in new values, and submits. There's no intelligence: no detection of which lines are overloaded, no suggested values, no validation of constraints.

**Goal**: Make the system detect capacity problems automatically, suggest valid parameter changes for Ouverture Lignes, enforce hard constraints, and allow one-click application from the proposals interface.

---

## Hard Constraints (Ouverture Lignes)

| Parameter | Field | Min | Max | Step |
|-----------|-------|-----|-----|------|
| Semaines | `weeks` | 0.1 | 4.2 | 0.1 |
| Coeff. rendement | `coeff` | 0.01 | 1 | 0.01 |
| Postes/jour | `shifts` | 1 | 3 | 1 |
| Jours/semaine | `days` | 1 | 7 | 1 |
| Heures/poste | `hours` | 7 | 7 (fixed) | — |

- `hours` is always fixed at 7 — not editable
- All values must be > 0
- These constraints apply **everywhere**: proposals form, direct lignes editing, import, and API

---

## Changes

### 1. `src/lib/data/constraints.ts` — NEW shared constraint constants

```ts
export const LIGNE_CONSTRAINTS = {
  weeks: { min: 0.1, max: 4.2, step: 0.1, fixed: false },
  coeff: { min: 0.01, max: 1, step: 0.01, fixed: false },
  shifts: { min: 1, max: 3, step: 1, fixed: false },
  days:  { min: 1, max: 7, step: 1, fixed: false },
  hours: { min: 7, max: 7, step: 1, fixed: true },
} as const;

export function clampLigneParam(key, value): number { ... }
export function validateLigneParams(params): { valid: boolean; errors: string[] } { ... }
```

Single source of truth used by: proposals form, lignes editor, API validation, and suggestion engine.

### 2. `src/lib/scheduler/suggestions.ts` — NEW problem detection & suggestion engine

**Detection logic:**
- For each month × line: compute `occupation = CH / TO × 100` using PDP × Gammes × Lignes
- Flag any month×line where `occupation > 85%` (warning) or `> 100%` (critical)
- Group problems by line (a line overloaded in 3 months = 1 suggestion for that line)

**Suggestion logic** — for each overloaded line, compute the minimum TO needed:
1. Find the peak monthly CH for that line across all 12 months
2. Target: bring occupation down to ≤ 85%  →  target TO = peak CH / 0.85
3. Increment parameters in **priority order** (least disruptive first):
   - `shifts` (1→2→3) — just adding a shift
   - `days` (current→7) — add weekend days
   - `weeks` (current→4.2) — extend calendar
   - `coeff` (current→1.0) — improve efficiency
4. After each increment, recompute TO = weeks × coeff × shifts × days × hours
5. Stop as soon as TO ≥ target TO
6. Respect all hard constraints — never exceed max values

**Output type:**
```ts
interface Suggestion {
  line: LineId;
  severity: "warning" | "critical";
  peakMonth: MonthKey;
  peakOccupation: number;        // current %
  targetOccupation: number;      // after fix %
  currentParams: LigneParams;
  suggestedParams: LigneParams;
  currentTO: number;
  suggestedTO: number;
  affectedMonths: MonthKey[];    // months currently > 85%
}
```

### 3. `src/app/proposals/ProposalsClient.tsx` — Major enhancement

**A) Add problem detection panel (top of page):**
- Fetch PDP, Gammes, Lignes on mount (same pattern as KPI/Charge pages)
- Run `detectSuggestions()` client-side
- Display alert cards per overloaded line:
  - Severity badge (red "Critique" / amber "Attention")
  - Line name, peak occupation %, affected months
  - Current vs suggested values shown side-by-side in a compact table
  - **"Proposer cette modification"** button (for Responsable Atelier) → pre-fills proposal form
  - **"Appliquer directement"** button (for Planificateur with `canApprove`) → writes to `/api/lignes` immediately, skipping the proposal workflow
- If no problems: green banner "Aucune surcharge détectée — toutes les lignes sont sous 85%"

**B) Enhance the proposal form:**
- Add constraint validation on each input (min, max, step from `LIGNE_CONSTRAINTS`)
- Show real-time TO calculation as values change
- Disable `hours` field (fixed at 7)
- Show inline validation errors when constraints are violated
- Show current values for the selected line (so user sees what they're changing from)

**C) "Appliquer directement" on suggestions (Planificateur only):**
- Calls `POST /api/lignes` with the full updated lignes data (current data + suggested changes for that line)
- Calls `markDataSaved()` on scheduleStore so Plan de Charge / KPI refresh
- Shows success toast, re-fetches data, recalculates suggestions

### 4. `src/app/data/lignes/LignesClient.tsx` — Add constraint triggers

- Import `LIGNE_CONSTRAINTS` from shared constants
- Set `min`, `max`, `step` attributes on each `<input>` from constraints
- Clamp values on blur using `clampLigneParam()` — if user types 5 for shifts, it clamps to 3
- Disable the `hours` column inputs (fixed at 7, show as read-only)
- Show red border + tooltip on inputs exceeding constraints before clamping

### 5. `src/app/api/lignes/route.ts` — Add server-side validation

- Import `validateLigneParams` from constraints
- In POST: validate each line's params against constraints before saving
- Return 400 with specific error messages listing which params on which lines are invalid
- This catches any bypass of client-side validation (API-first security)

### 6. `src/app/api/proposals/route.ts` — Add constraint validation

- In POST: validate proposed changes against `LIGNE_CONSTRAINTS` before creating
- Reject proposals that exceed hard constraints (e.g. shifts=5 → 400 error)
- In PATCH/APPROVE: re-validate before applying to lignes data

---

## File Summary

| File | Action | ~Lines |
|------|--------|--------|
| `src/lib/data/constraints.ts` | CREATE | 40 |
| `src/lib/scheduler/suggestions.ts` | CREATE | 100 |
| `src/app/proposals/ProposalsClient.tsx` | MODIFY | +150 |
| `src/app/data/lignes/LignesClient.tsx` | MODIFY | +25 |
| `src/app/api/lignes/route.ts` | MODIFY | +15 |
| `src/app/api/proposals/route.ts` | MODIFY | +20 |

---

## User Flow

### Responsable Atelier
```
1. Visits "Propositions de modification"
2. Sees alert: "Atelier I — Critique (112%) — Mars, Avril"
   Current: shifts=1, days=5  →  Suggestion: shifts=2, days=7
3. Clicks "Proposer cette modification" → form pre-filled → submit
4. Planificateur approves → lignes updated automatically
```

### Planificateur
```
1. Visits "Propositions de modification"
2. Sees same alerts + pending proposals from Responsables
3. On a suggestion: clicks "Appliquer directement" → lignes updated instantly
4. Goes to Plan de Charge → occupation reduced, no more red bars
```

### Direct editing (any user with canManageGammes)
```
1. Visits "Ouverture des Lignes" data page
2. Tries to set shifts=5 → input clamps to 3 on blur
3. hours column is disabled (always 7)
4. Saves → API validates → success
```

---

## Verification

1. `npx next build` — 0 type errors
2. Proposals page: shows overload alerts for lines > 85% occupation
3. Suggestions show correct parameter changes that bring occupation ≤ 85%
4. "Proposer" pre-fills form respecting all constraints
5. "Appliquer directement" writes to lignes DB and triggers data refresh
6. Lignes editor: inputs clamped to constraints, hours disabled
7. API rejects values exceeding constraints (both lignes and proposals routes)
8. Form shows real-time TO calculation
