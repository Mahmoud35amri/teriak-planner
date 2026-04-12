# Teriak Production Load Planner

Hackathon app for Laboratoires Teriak: Job Shop scheduling, load planning, KPI dashboards.
Goal: Win LeanX 1.0 hackathon (24h, April 11-12 2026).

## Production Standards

- This is a real-life production application — no demo data, no placeholder content, no hardcoded credentials shown in the UI
- No emojis anywhere in the UI
- All seed data uses strong passwords (bcrypt rounds=12); initial password `Teriak@2026!` is for first-login only
- No "demo accounts" hints or test-mode banners visible to users
- All user-facing text is in French

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Prisma ORM 5 + SQLite
- **State**: Zustand for client state
- **Charts**: Recharts
- **Excel I/O**: xlsx library
- **Auth**: bcryptjs + session cookies

## Key Paths

- `src/app/` — Next.js pages (App Router)
- `src/components/` — React components (layout, data, gantt, dashboard, scenarios, alerts)
- `src/lib/scheduler/` — Scheduling engine (engine, heuristics, genetic, metrics)
- `src/lib/data/` — Types + default Teriak data
- `src/lib/auth/` — Session + role permissions
- `src/lib/excel/` — Excel parser + exporter
- `src/stores/` — Zustand stores
- `prisma/schema.prisma` — DB schema
- `Docs/PLAN.md` — Full detailed plan

## 3 Data Models

- **PDP**: `{ P1: {jan:5, feb:3, ...}, P2: {...}, ... }` — batches per product per month
- **GammesProduits**: `{ P1: {production: {A:6,B:26,...}, cleaning: {A:1.33,...}}, ... }`
- **OuvertureLignes**: `{ A: {weeks:4.2, coeff:1, shifts:1, days:7, hours:7}, ... }`

## 4 KPIs (Exact Formulas)

1. **OTD** = count(C_i <= d_i) / N x 100 — on-time delivery %
2. **Occupation** tau_j = CH_j / TO_j x 100 — charge vs capacity per line A-J
3. **Tardiness** T_i = max(0, C_i - d_i) — delay per lot (hours)
4. **Available Capacity** CD_j = TO_j - CH_j — remaining hours per line (negative = bottleneck)

Where:
- TO_j = weeks x coeff x shifts/day x days/week x hours/shift
- CH_j = sum(p_ij + x_ij) for all lots through line j (no wait time)

## 4 Roles

- **Planificateur**: Full CRUD on PDP, run scheduler/optimizer, manage scenarios, manage gammes/lignes, approve proposals, view KPIs, export reports
- **Responsable Atelier**: Read-only on all business data, submit line opening proposals (needs approval), view KPIs, export reports
- **Administrateur**: No business data access. User CRUD, role management, activity logs only
- **Direction**: Read-only on PDP/load plan/KPIs, export reports. No action rights

## 5 Scheduling Rules

- **SPT**: Shortest Processing Time first — minimizes avg completion
- **EDD**: Earliest Due Date first — minimizes lateness
- **CR**: Critical Ratio (due-now)/remaining — balances urgency
- **LPT**: Longest Processing Time first — better utilization
- **GA**: Genetic algorithm (pop=50, gen=100, OX crossover) — optimizes makespan

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Foundation (Next.js, Prisma, Auth, Shell) | DONE |
| 2 | Data Management (Excel import, CRUD, 3 tables) | DONE |
| 3 | Scheduling Engine (dispatcher, 4 heuristics, KPIs) | DONE |
| 4 | Visualizations (Gantt, KPI dashboard, load chart) | DONE |
| 5 | What-If Scenarios (create, compare, apply) | DONE |
| 6 | AI Optimizer (genetic algorithm) | DONE |
| 7 | Alerts, Proposals & Admin panel | DONE |
| 8 | Polish (theme, edge cases, responsive) | DONE |
| 9 | Pitch Prep (PPT + rehearsal) | TODO |

## Coding Rules

- TypeScript strict mode, no `any`
- Prisma for all DB access
- Zustand for client-side state
- Immutable data patterns (new objects, no mutation)
- No emojis in UI
- No demo data, test banners, or placeholder credentials in UI
- Commit after each phase
- /compact after each phase to manage context
- Files < 400 lines, functions < 50 lines
