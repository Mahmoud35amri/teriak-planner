# Teriak Planner — Progress Log

**Hackathon**: LeanX 1.0 — April 11-12, 2026  
**Last updated**: 2026-04-12  
**Build status**: Passing (`npx next build` — 0 type errors, 0 warnings)

---

## Phase Completion Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation (Next.js, Prisma, Auth, Shell) | **DONE** |
| 2 | Data Management (Excel import, CRUD, 3 tables) | **DONE** |
| 3 | Scheduling Engine (dispatcher, 4 heuristics, KPIs) | **DONE** |
| 4 | Visualizations (Gantt, KPI dashboard, load chart) | **DONE** |
| 5 | What-If Scenarios (create, compare, apply) | **DONE** |
| 6 | AI Optimizer (genetic algorithm) | **DONE** |
| 7 | Alerts, Proposals & Admin panel | **DONE** |
| 8 | Polish (theme, edge cases, responsive) | **DONE** |
| 9 | Pitch Prep (PPT + rehearsal) | TODO |

---

## Phase 1 Checklist — DONE

- [x] Init Next.js 15 + TypeScript strict + Tailwind 4 + Prisma 5
- [x] Dependencies installed: recharts, zustand, lucide-react, xlsx, bcryptjs, clsx
- [x] Database schema (Prisma) — 7 models: User, PDP, GammesProduits, OuvertureLignes, Scenario, Proposal, ActivityLog
- [x] Migration run: `prisma/migrations/20260411173701_init/migration.sql`
- [x] Seed run: 4 users seeded with bcrypt 12-round hashes
- [x] Auth system: login page, session cookie (httpOnly, base64 JSON), `/api/auth/login|logout|me`
- [x] App shell: Sidebar (role-aware nav), Header (title + logout), AppShell wrapper
- [x] Role permission utility: `can(role, permission)` in `src/lib/auth/roles.ts`
- [x] Zustand auth store with session restore on page refresh
- [x] Dashboard page with role-filtered quick-link cards
- [x] All domain TypeScript types in `src/lib/data/types.ts`
- [x] All default Teriak data in `src/lib/data/defaults.ts`

## Phase 2 Checklist — DONE

- [x] Excel parser (`src/lib/excel/parser.ts`) — handles PDP, Gammes (single-sheet and two-sheet), Lignes formats with flexible column name matching
- [x] Excel exporter (`src/lib/excel/exporter.ts`) — exports all 3 data tables to .xlsx
- [x] PDP page (`/data/pdp`) — editable 13×12 grid (products × months), row/column totals, read-only for non-Planificateur
- [x] Gammes page (`/data/gammes`) — 13×10 table with toggle between production/nettoyage views, empty cells shown as dashes
- [x] Lignes page (`/data/lignes`) — 10×5 table with live TO_j computed column and formula display
- [x] API route `GET/POST /api/pdp` — reads from DB, falls back to defaults; writes with canEditPDP check
- [x] API route `GET/POST /api/gammes` — reads from DB, falls back to defaults; writes with canManageGammes check
- [x] API route `GET/POST /api/lignes` — reads from DB, falls back to defaults; writes with canManageGammes check
- [x] All save/import actions logged to ActivityLog
- [x] Dirty state tracking ("Non enregistré" badge) on all 3 pages
- [x] Import + Export Excel buttons on all 3 pages (import hidden from read-only roles)

## Phase 3 Checklist — DONE

- [x] `src/lib/scheduler/heuristics.ts` — `sortLots()` implementing SPT, EDD, CR, LPT
- [x] `src/lib/scheduler/engine.ts` — `generateLots()`, `dispatch()`, `runScheduler()` entry point
- [x] `src/lib/scheduler/metrics.ts` — `computeKPIs()` computing all 4 KPIs, `computeTO()`, `computeCH()`
- [x] `POST /api/schedule` — auth-gated (canRunScheduler), reads DB with fallback to defaults, logs action
- [x] Lot generation: one lot per batch unit, operations filtered to lines where production > 0 (handles P8 empty gamme, P2 A:0)
- [x] Dispatcher: respects line non-overlap (including cleaning time), predecessor constraint within lot
- [x] Time origin: hours offset from Jan 1 2026 00:00 UTC; dueDate = last hour of month
- [x] GA_OPTIMIZED rule passthrough: pre-ordered lots bypass heuristic sorting (ready for Phase 6)

## Phase 6 Checklist — DONE

- [x] `src/lib/scheduler/genetic.ts` — `runGA()` implementing GA (pop=50, gen=100, OX crossover, tournament selection, swap mutation, elitism)
- [x] `Schedule` type extended with optional `gaImprovement?: number` field (% vs EDD baseline)
- [x] `/api/scenarios` POST: when rule=GA_OPTIMIZED, calls `runGA()` with EDD baseline comparison; saves improvement % into the schedule JSON
- [x] `ScenariosClient.tsx`: GA_OPTIMIZED added to rules dropdown; "Optimisation AG en cours..." loading label; amber warning note about computation time
- [x] `ScenarioCard.tsx`: shows green "-X.X% makespan" badge on GA scenarios when improvement > 0

## Phase 4 Checklist — DONE

- [x] `src/stores/scheduleStore.ts` — Zustand store holding schedule + KPIs; shared across all 3 views
- [x] `src/components/planning/SchedulerPanel.tsx` — rule selector + Planifier button (shared component, respects canRun prop)
- [x] `/planning/charge` — load plan view: CH vs TO bar chart per line (Recharts), 10 summary cards with occupation %, colored green/amber/red
- [x] `/planning/gantt` — Gantt chart: CSS/absolute-positioned, color-coded by product (13 colors), cleaning bars at 25% opacity, scrollable, hover tooltip
- [x] `/kpi` — KPI dashboard: OTD card, occupation bar chart, capacity bar chart (negative = red), tardiness table (top 20 late lots)
- [x] Occupation thresholds: green < 70%, amber 70–85%, red > 85%
- [x] Reference lines at 85% and 100% on occupation chart
- [x] Run once from any page — result persists in scheduleStore and is visible everywhere

## Phase 7 Checklist — DONE

- [x] `src/app/api/proposals/route.ts` — GET (list, role-filtered), POST (submit, Resp. Atelier), PATCH (approve/reject + apply changes to OuvertureLignes, Planificateur)
- [x] `src/app/api/admin/users/route.ts` — GET, POST (create + bcrypt hash), PATCH (role change), DELETE (Admin only; cannot self-delete or self-demote)
- [x] `src/app/api/admin/logs/route.ts` — paginated GET with user info (50/page)
- [x] `src/app/proposals/page.tsx` + `ProposalsClient.tsx` — dual-mode: Resp. Atelier submits proposals (workshop + param overrides + note); Planificateur sees all pending + approve/reject buttons
- [x] `src/app/admin/users/page.tsx` + `UsersClient.tsx` — user table + inline role dropdown + create form + delete button
- [x] `src/app/admin/logs/page.tsx` + `LogsClient.tsx` — paginated activity log with action labels, color-coded, timestamps
- [x] `src/components/alerts/OverloadAlert.tsx` — auto-detects lines with occupation > 100%, renders red banner listing each overloaded line
- [x] `ChargeClient.tsx` updated: OverloadAlert shown below SchedulerPanel
- [x] `KPIClient.tsx` updated: OverloadAlert + "Exporter Excel" button (client-side xlsx with 3 sheets: résumé, occupation, retards)
- [x] `Sidebar.tsx` updated: Proposals link visible to both canSubmitProposals (Resp. Atelier) and canApproveProposals (Planificateur) via anyPermission array

## Phase 8 Checklist — DONE

- [x] Mobile-responsive sidebar: fixed+slide-in on mobile, static on md+; `isOpen`/`onClose` props thread from AppShell → Sidebar
- [x] Hamburger button in Header (md:hidden) — opens/closes sidebar on mobile; nav link clicks close sidebar
- [x] Mobile backdrop overlay (black/40 fixed inset) closes sidebar on tap
- [x] Loading skeleton in AppShell: matches layout (sidebar skeleton + content placeholders with animate-pulse) replaces bare "Chargement..." text
- [x] `globals.css`: custom scrollbar (6px, gray thumb), antialiasing; removed dark mode regression
- [x] Login page: `px-4` mobile padding, improved subtitle copy
- [x] Edge cases already handled in engine.ts: zero-production lines filtered at `generateLots`, zero-quantity months skipped
- [x] `main` padding: `p-4 md:p-6` — tighter on mobile
- [x] Header `h-14` preserved; title truncates on narrow screens with `truncate`
- [x] Build: 0 type errors, 0 warnings, 20 routes

## Phase 5 Checklist — DONE

- [x] `src/app/api/scenarios/route.ts` — GET (list), POST (create + run scheduler), DELETE (by ?id=)
- [x] `src/app/api/scenarios/clone/route.ts` — POST (copy schedule/kpis without re-running)
- [x] `src/stores/scenarioStore.ts` — Zustand store: fetchScenarios, createScenario, deleteScenario, cloneScenario
- [x] `scheduleStore.ts` extended with `setResult(schedule, kpis)` for injecting scenario data into visualizations
- [x] `src/app/scenarios/page.tsx` — server wrapper, canManageScenarios guard
- [x] `src/app/scenarios/ScenariosClient.tsx` — create form, grid of scenario cards, selection-based comparison
- [x] `src/components/scenarios/ScenarioCard.tsx` — KPI summary, apply/clone/delete actions, inline clone input
- [x] `src/components/scenarios/ScenarioComparison.tsx` — side-by-side table for 2-3 scenarios, winner highlighting
- [x] Apply scenario: injects schedule+kpis into scheduleStore — Charge/Gantt/KPI pages immediately reflect it
- [x] Comparison metrics: Makespan, OTD%, lots en retard, retard moyen, retard max, occupation max
- [x] Activity logging: SCENARIO_CREATE + SCENARIO_CLONE actions

---

## All Files Created

### Configuration & Root
```
.env                                          # DATABASE_URL + SESSION_SECRET
CLAUDE.md                                     # Project instructions for Claude
prisma/schema.prisma                          # 7-model DB schema
prisma/seed.mjs                               # ESM seed (4 users + default data)
prisma/migrations/20260411173701_init/migration.sql
prisma/dev.db                                 # SQLite database file
```

### Source — Auth & Core
```
src/lib/db.ts                                 # Prisma singleton
src/lib/auth/roles.ts                         # Role types, Permission interface, can(), ROLE_LABELS
src/lib/auth/session.ts                       # getSession / createSession / destroySession (cookie-based)
src/stores/authStore.ts                       # Zustand auth store (AuthUser | null)
```

### Source — Domain Data
```
src/lib/data/types.ts                         # All domain types: ProductId, LineId, MonthKey, PDPData,
                                              #   GammesData, OuvertureLignesData, Lot, Operation,
                                              #   ScheduledLot, Schedule, KPIResult
src/lib/data/defaults.ts                      # DEFAULT_GAMMES, DEFAULT_OUVERTURE_LIGNES, DEFAULT_PDP
```

### Source — Scheduler Engine
```
src/lib/scheduler/heuristics.ts              # sortLots() — SPT, EDD, CR, LPT
src/lib/scheduler/engine.ts                  # generateLots(), dispatch(), runScheduler()
src/lib/scheduler/metrics.ts                 # computeKPIs(), computeTO(), computeCH()
```

### Source — Excel Utilities
```
src/lib/excel/parser.ts                       # parsePDPExcel, parseGammesExcel, parseLignesExcel
src/lib/excel/exporter.ts                     # exportPDPToExcel, exportGammesToExcel, exportLignesToExcel
```

### Source — Layout Components
```
src/components/layout/AppShell.tsx            # Authenticated page wrapper (session restore)
src/components/layout/Sidebar.tsx             # Role-aware nav sidebar
src/components/layout/Header.tsx              # Page title + logout button
src/components/planning/SchedulerPanel.tsx    # Rule selector + Planifier button (shared)
```

### Source — Zustand Stores
```
src/stores/authStore.ts                       # Current user/role state
src/stores/scheduleStore.ts                   # Current schedule + KPIs, runSchedule() action
```

### Source — App Pages
```
src/app/layout.tsx                            # Root layout
src/app/globals.css                           # Global styles (dark mode removed, form element base colors)
src/app/page.tsx                              # Root redirect (→ /dashboard or /login)
src/app/login/page.tsx                        # Login form (client component)
src/app/dashboard/page.tsx                    # Dashboard server wrapper
src/app/dashboard/DashboardClient.tsx         # Role-filtered quick-link cards
src/app/data/pdp/page.tsx                     # PDP server page (session + permissions check)
src/app/data/pdp/PDPClient.tsx                # PDP editable 13×12 grid
src/app/data/gammes/page.tsx                  # Gammes server page
src/app/data/gammes/GammesClient.tsx          # Gammes editable table (production/nettoyage toggle)
src/app/data/lignes/page.tsx                  # Lignes server page
src/app/data/lignes/LignesClient.tsx          # Lignes editable table with live TO_j column
src/app/planning/charge/page.tsx              # Load plan server page
src/app/planning/charge/ChargeClient.tsx      # CH vs TO bar chart, 10 occupation cards
src/app/planning/gantt/page.tsx               # Gantt server page
src/app/planning/gantt/GanttClient.tsx        # CSS Gantt — color by product, cleaning bars, tooltip
src/app/kpi/page.tsx                          # KPI dashboard server page
src/app/kpi/KPIClient.tsx                     # 4 KPI panels: OTD, occupation, capacity, tardiness
```

### Source — API Routes
```
src/app/api/auth/login/route.ts               # POST /api/auth/login
src/app/api/auth/logout/route.ts              # POST /api/auth/logout
src/app/api/auth/me/route.ts                  # GET /api/auth/me
src/app/api/pdp/route.ts                      # GET + POST /api/pdp
src/app/api/gammes/route.ts                   # GET + POST /api/gammes
src/app/api/lignes/route.ts                   # GET + POST /api/lignes
src/app/api/schedule/route.ts                 # POST /api/schedule — run heuristic scheduler
```

---

## Database State

**ORM**: Prisma 5 + SQLite  
**Migration**: `20260411173701_init` — applied, all 7 tables created  
**Seed command**: `node --env-file=.env prisma/seed.mjs`  
**Seed status**: Run successfully after `npx prisma migrate reset --force`

### Seeded Users
| Name | Email | Role | Password |
|------|-------|------|----------|
| Planificateur | planificateur@teriak.tn | PLANIFICATEUR | Teriak@2026! |
| Responsable Atelier | atelier@teriak.tn | RESPONSABLE_ATELIER | Teriak@2026! |
| Administrateur | admin@teriak.tn | ADMINISTRATEUR | Teriak@2026! |
| Direction | direction@teriak.tn | DIRECTION | Teriak@2026! |

### Seeded Data Records
- `GammesProduits`: 1 record — full DEFAULT_GAMMES (13 products, all lines)
- `OuvertureLignes`: 1 record — full DEFAULT_OUVERTURE_LIGNES (10 lines)
- `PDP`: 1 record — "PDP 2026" with all zeros (ready for user input)

---

## Decisions That Differ from the Plan

### 1. Prisma 5 instead of Prisma 7
**Plan said**: `"@prisma/client": "^6"` (which resolved to 7)  
**What we did**: Locked to Prisma 5 (`^5`)  
**Why**: Prisma 7 removed the `url` field from datasource blocks — it now requires a driver adapter. For a 24h hackathon with SQLite, the new adapter architecture adds zero value and significant complexity.

### 2. String fields instead of enums for Role and ProposalStatus
**Plan said**: `enum Role { ... }` and `enum ProposalStatus { ... }` in Prisma schema  
**What we did**: Stored as `String` fields with valid values documented in comments  
**Why**: SQLite does not support Prisma native enums. The type safety is preserved in TypeScript (`type Role = "PLANIFICATEUR" | ...`); only the DB column is untyped.

### 3. JSON data stored as String in Prisma schema
**Plan said**: `data Json` on PDP, GammesProduits, OuvertureLignes models  
**What we did**: `data String` with `JSON.stringify` / `JSON.parse` in API routes  
**Why**: Prisma 5 + SQLite does not support `Json` field type. The behavior is identical at runtime.

### 4. ESM seed file (`seed.mjs`) instead of TypeScript seed
**Plan said**: standard `prisma db seed` with ts-node  
**What we did**: `prisma/seed.mjs` (plain ESM), run with `node --env-file=.env prisma/seed.mjs`  
**Why**: ts-node on Windows fails to parse `--compiler-options '{"module":"CommonJS"}'` due to single-quote handling. ESM with `@prisma/client` native import works without any transpilation.

### 5. No separate ExcelImporter component
**Plan said**: `src/components/data/ExcelImporter.tsx` as a reusable component  
**What we did**: Import logic is inline in each `*Client.tsx` page  
**Why**: The import trigger, error handling, and state update are tightly coupled to each page's specific data type. A shared component would require complex generics with no DRY benefit.

### 6. No separate PDPTable / GammesTable / LignesTable components
**Plan said**: separate table components in `src/components/data/`  
**What we did**: Tables are embedded directly in `PDPClient.tsx`, `GammesClient.tsx`, `LignesClient.tsx`  
**Why**: Each table is used exactly once, has unique structure, and the Client component stays under 200 lines.

### 7. Session uses base64 JSON cookie, not iron-session
**Plan said**: `iron-session` or similar  
**What we did**: httpOnly cookie containing base64-encoded JSON  
**Why**: iron-session is installed but requires runtime configuration. A simple httpOnly cookie is sufficient for hackathon scope.

### 8. Gantt chart is CSS/absolute-positioned, not a Recharts component
**Plan said**: Recharts-based Gantt  
**What we did**: Pure HTML divs with absolute positioning in a scrollable container  
**Why**: Recharts has no native Gantt support. A custom Recharts Gantt requires complex workarounds; the CSS approach renders correctly, supports hover tooltips, and scrolls naturally.

### 9. CH/TO reconstruction from KPI values in ChargeClient
**Plan said**: Display CH_j and TO_j directly  
**What we did**: Derive TO_j = availableCapacity / (1 − occupation/100) from KPIResult fields  
**Why**: KPIResult does not store raw CH/TO hours. The derivation formula is mathematically exact for all occupation values ≠ 100%.

### 10. Dark mode removed from globals.css
**Plan said**: Default Tailwind dark mode support  
**What we did**: Removed `@media (prefers-color-scheme: dark)` block; added explicit `color: #111827` base for all form elements  
**Why**: The dark mode CSS variable was leaking grey foreground color into form inputs, making text invisible on white backgrounds. The app targets a fixed light theme.

---

## Bugs Found and Fixed

### Bug 1 — Next.js scaffold overwrote CLAUDE.md
**Fix**: Fully rewrote CLAUDE.md from conversation context.

### Bug 2 — Prisma 7 `url` field rejected in schema
**Fix**: Downgraded to Prisma 5.

### Bug 3 — Prisma 7 PrismaClient constructor requires adapter
**Fix**: Same as Bug 2.

### Bug 4 — SQLite enum error during migration
**Fix**: Converted `Role` and `ProposalStatus` from Prisma enum to `String` fields.

### Bug 5 — "Identifiants invalides" at login after seed
**Root cause**: `upsert` with `update: {}` left old hashes intact on re-seed.  
**Fix**: `npx prisma migrate reset --force` then re-seed.

### Bug 6 — `prisma.config.ts` breaking build
**Fix**: Deleted `prisma.config.ts` (Prisma 7 artifact).

### Bug 7 — TypeScript error in `login/page.tsx`
**Fix**: Imported `Role` type directly and cast `json.data.role as Role`.

### Bug 8 — Windows ts-node single-quote failure
**Fix**: Replaced with `prisma/seed.mjs` (ESM).

### Bug 9 — AppShell missing required `title` prop
**Symptom**: Build failed — `Property 'title' is missing` on ChargeClient, GanttClient, KPIClient.  
**Fix**: Added `title="..."` prop to all three AppShell usages.

### Bug 10 — Recharts Tooltip formatter type error
**Symptom**: `Type 'undefined' is not assignable to type 'number'` on formatter callbacks.  
**Fix**: Removed explicit `number` type annotation from formatter parameter (let TypeScript infer `ValueType`).

### Bug 11 — Object.fromEntries cast error in GanttClient
**Symptom**: `Conversion of type '{ [k: string]: never[] }' to type 'Record<LineId, GanttOp[]>'` type error.  
**Fix**: Changed to `Object.fromEntries(ALL_LINES.map((l) => [l, [] as GanttOp[]]))`.

### Bug 12 — Form inputs with invisible text
**Symptom**: Input and select text appeared near-invisible (very light grey) across all pages.  
**Root cause**: `@media (prefers-color-scheme: dark)` in globals.css set `--foreground: #ededed` which bled into form elements when OS was in dark mode.  
**Fix**: Removed dark mode media query; added `color: #111827` base rule for all form elements in globals.css; added explicit `text-gray-900` Tailwind class on every input/select element.

---

## Pending Fix — CH/TO Unit Mismatch (Plan de Charge)

### Problem

The Plan de Charge compares **annual charge** (CH) vs **monthly capacity** (TO), which produces inflated occupation rates when the PDP spans multiple months.

| Grandeur | Situation actuelle | Ce qu'il faudrait |
|----------|--------------------|-------------------|
| **CH** | Σ heures de TOUS les lots × TOUS les mois | Σ heures pour UN mois donné |
| **TO** | Capacité d'1 mois (`4.2 sem × ...`) | Capacité annuelle (× 12) ou mensuelle |
| **Résultat** | Taux d'occupation × N_mois si PDP multi-mois | Taux d'occupation cohérent |

**Exemple** : PDP avec 5 lots/mois × 12 mois pour P1, atelier I  
- CH_I = 60 × 95.09 = 5 705 h (annuel)  
- TO_I = 4.2 × 0.85 × 2 × 5 × 7 = 249.9 h (mensuel)  
- Occupation = **2 283%** au lieu de ~190%

### Plan de correction

**Option choisie** : Annualiser TO (× 12) dans `computeTO()` pour le Plan de Charge

**Fichiers à modifier** :

1. **`src/lib/scheduler/metrics.ts`** — `computeTO()`  
   Multiplier le résultat par 12 pour refléter l'horizon annuel du PDP :
   ```typescript
   result[line] = p.weeks * p.coeff * p.shifts * p.days * p.hours * 12;
   ```

2. **`src/app/data/lignes/LignesClient.tsx`** — colonne TO (h/mois)  
   La colonne affichée reste mensuelle (pour la page Lignes) — ne pas toucher.

3. **`src/components/layout/`** — aucun changement nécessaire.

**Formule TO affichée dans Lignes** : reste `semaines × coeff × postes × jours × heures` (mensuel).  
**Formule TO utilisée dans KPIs** : devient `× 12` pour comparer avec CH annuel.

### Impact attendu
- Taux d'occupation divisé par 12 — valeurs cohérentes (ex : 19% au lieu de 228%)
- CD (capacité disponible) correctement positif/négatif
- OTD inchangé (calcul séparé)
- Aucun changement de type TypeScript

### Statut : **DONE** — `computeTO()` gains optional `annualize` param (default `false`); `computeKPIs()` calls it with `annualize = true`. LignesClient unchanged (still shows monthly TO).

---

## Pending — Plan de Charge : Supprimer l'histogramme global, ajouter barre de navigation mensuelle

### Problème

L'histogramme global (taux d'occupation agrégé tous ateliers par mois) donne de fausses informations : un mois peut paraître vert globalement alors qu'un atelier individuel est en surcharge.

### Plan de correction

**Supprimer** `MonthlyOverviewChart.tsx` (plus utilisé).

**Modifier** `ChargeClient.tsx` :
- `useState<MonthKey | null>(null)` → `useState<MonthKey>("jan")`
- Supprimer `overviewData` useMemo et import `MonthlyOverviewChart`
- Supprimer la logique conditionnelle overview/drilldown
- Ajouter une barre de navigation mensuelle (12 boutons Jan–Déc, mois actif en bleu)
- Toujours afficher `<MonthDrilldownChart month={selectedMonth} />`

**Modifier** `MonthDrilldownChart.tsx` :
- Supprimer le bouton "Retour" et la prop `onBack`
- Simplifier le header

### Fichiers concernés
- `src/app/planning/charge/ChargeClient.tsx`
- `src/app/planning/charge/MonthDrilldownChart.tsx`
- `src/app/planning/charge/MonthlyOverviewChart.tsx` (à supprimer)

### Statut : **DONE** — `MonthlyOverviewChart.tsx` supprimé. `ChargeClient.tsx` : `selectedMonth` initialisé à `"jan"`, barre de navigation 12 boutons (mois actif en bleu), `MonthDrilldownChart` toujours affiché. `MonthDrilldownChart.tsx` : prop `onBack` et bouton "Retour" supprimés, header simplifié.

---

## Post-Phase Improvements — DONE (2026-04-12)

### Plan de Charge — Refonte complète
- **CH indépendant du scheduler** : `computeMonthlyCHFromPDP(pdp, gammes)` calcule la charge mensuelle par atelier directement depuis PDP × Gammes, sans lancer l'ordonnancement
- **Chargement automatique** : la page fetche `/api/pdp`, `/api/gammes`, `/api/lignes` au montage — affichage immédiat sans action préalable
- **Nouveaux fichiers** :
  - `src/app/planning/charge/MonthlyOverviewChart.tsx` — histogramme mensuel global (à supprimer, voir TODO ci-dessous)
  - `src/app/planning/charge/MonthDrilldownChart.tsx` — bullet chart par atelier pour un mois sélectionné
- **Nouvelles fonctions dans `metrics.ts`** : `computeMonthlyCH()`, `computeMonthlyTO()`, `computeMonthlyCHFromPDP()`
- **`MonthlyCHMap`** ajouté dans `types.ts`

### Scheduler Panel retiré de Plan de Charge et KPI
- Plan de Charge et Tableau KPI n'affichent plus le sélecteur de règle ni le bouton Planifier
- Diagramme Gantt = seul point d'entrée pour lancer l'ordonnancement

### Persistance du schedule (localStorage)
- `scheduleStore` utilise le middleware `persist` de Zustand — `schedule`, `kpis`, `rule` survivent aux rechargements de page
- La clé localStorage est `teriak-schedule`

### Synchronisation données → Plan de Charge
- `scheduleStore` étendu : `lastDataSavedAt: number | null` + `markDataSaved()`
- `PDPClient`, `GammesClient`, `LignesClient` appellent `markDataSaved()` après chaque sauvegarde réussie
- `ChargeClient` re-fetche automatiquement les données quand `lastDataSavedAt` change
