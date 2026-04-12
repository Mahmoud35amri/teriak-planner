# LeanX 1.0 Hackathon - Teriak Production Load Planner

## Context

**What**: Build a full production load planning platform for Laboratoires Teriak, a pharmaceutical company running a Job Shop production system with 13 products across 10 workshop steps (A-J).

**Why**: Win the LeanX 1.0 hackathon (24h, April 11-12, 2026). The jury is composed of industry specialists and Teriak representatives. They want an innovative, feasible solution to a real industrial challenge.

**Team**: 1 software engineer + 3 industrial engineers
**Tech**: Next.js + React + TypeScript + Tailwind + SQLite (Prisma 5)
**Deliverable**: Working web app + 5-min pitch (PPT/PDF)

---

## Production Standards

This is a real-life production application, not a demo or prototype.

- **No demo data** in the UI — no placeholder credentials, no test-mode banners, no sample account hints visible to users
- **No emojis** anywhere in the interface
- **All text in French** — every user-facing label, error message, and heading
- **Strong passwords** — bcrypt with 12 rounds; initial seed password `Teriak@2026!` is for first-login only and must be changed
- **No hardcoded secrets** — all credentials and secrets via environment variables
- **Activity logging** — all login/logout and data mutations are recorded in ActivityLog
- The app is presented to Teriak representatives as a production-grade tool, not a hackathon prototype

---

## 3 Input Data Sources

| File | Structure | Content |
|------|-----------|---------|
| **PDP** (Plan Directeur de Production) | Rows: 13 products (P1-P13), Columns: 12 months (Jan-Dec) | Planned batch quantities per product per month |
| **Gammes Produits** | Rows: 13 products, Columns: Steps A-J x2 (production time + cleaning time) | Production hours and cleaning/changeover hours per product per step |
| **Ouverture Lignes** | Rows: parameters, Columns: Steps A-J | Weeks, efficiency coeff, shifts/day, days/week, hours/shift per line |

**Data entry**: Each file can be **imported as Excel** OR **created/edited directly in the platform**.
**Persistence**: Database-backed so data is saved and exportable.

---

## 4 Roles & Permissions

### Planificateur / Responsable Production (Central Actor)
- **Full CRUD** on PDP (create, modify, validate)
- **Run** load plan calculation + manual adjustments
- **Run** scheduling: automatic (heuristics, GA optimizer) and manual
- **Create, compare, apply** what-if scenarios
- **Manage** technical params: gammes produits, cleaning times, line openings
- **Receive** overload alerts
- **View** all 4 KPIs in detail
- **Generate & export** performance reports
- **Approve/reject** modification proposals from Responsable Atelier

### Responsable Atelier (Read-only + Limited Action)
- **View** PDP, load plan, Gantt, technical params (no edit)
- **Receive** overload alerts
- **View** all 4 KPIs in detail
- **Export** reports
- **Submit** modification proposals on line openings for their workshop (requires Planificateur approval)

### Administrateur (Technical Only)
- **No access** to business data (PDP, load plan, gammes, params, KPIs)
- **Create/delete** user accounts
- **Modify** roles and permissions
- **View** activity logs (traceability & security)

### Direction (Read-only Strategic)
- **View** PDP and load plan (global vision)
- **View** all 4 KPIs
- **Generate & export** performance reports
- **No action rights** on planning, scheduling, or technical params

---

## 4 KPIs (Exactly as Defined)

### 1. Taux de respect du PDP (OTD - On-Time Delivery)
```
OTD = count(C_i <= d_i) / N x 100
```
- C_i = actual finish date of lot i (scheduling output)
- d_i = due date from PDP (end of the planned month)
- N = total number of lots

### 2. Taux d'occupation par atelier
```
tau_j = CH_j / TO_j x 100
```
- CH_j = total planned charge on workshop j = sum of (p_ij + x_ij) for all lots passing through j
- TO_j = opening time of workshop j (from Ouverture Lignes)
- For j = A, B, C, D, E, F, G, H, I, J

### 3. Tardiness par lot
```
T_i = max(0, C_i - d_i)
```
- C_i = actual finish date of lot i
- d_i = PDP due date
- Shown per lot (table) + summary stats (avg, max)

### 4. Capacite disponible (CD)
```
CD_j = TO_j - CH_j
```
- TO_j = Nbre_sem x Nbre_postes/j x Nbre_j/sem x Heures/poste x Coeff_rendement
- CH_j = sum of (p_ij + x_ij) for all lots i passing through j (excludes wait time)
- CD_j > 0: workshop can absorb more. CD_j < 0: bottleneck/overload.

### Data Flow
```
PDP (quantities/month)
  + Gammes Produits (production + cleaning times)
  + Ouverture Lignes (capacity params)
       |
       v
  CH_j = sum(p_ij + x_ij)          -->  tau_j = CH_j / TO_j x 100
                                         CD_j = TO_j - CH_j
       |
       v
  Scheduling engine (ordering)      -->  C_i per lot
                                         OTD = count(C_i <= d_i) / N x 100
                                         T_i = max(0, C_i - d_i)
```

---

## Architecture

```
teriak-planner/
├── prisma/
│   └── schema.prisma              # DB schema (users, roles, products, orders, scenarios)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # Landing / Dashboard (role-aware)
│   │   ├── layout.tsx             # App shell with sidebar nav
│   │   ├── login/page.tsx         # Auth login page
│   │   ├── data/
│   │   │   ├── pdp/page.tsx       # PDP management (import Excel / edit in-app)
│   │   │   ├── gammes/page.tsx    # Gammes Produits management
│   │   │   └── lignes/page.tsx    # Ouverture Lignes management
│   │   ├── planning/
│   │   │   ├── charge/page.tsx    # Load plan view (charge vs capacity)
│   │   │   └── gantt/page.tsx     # Gantt chart view
│   │   ├── scenarios/page.tsx     # What-if scenario manager
│   │   ├── kpi/page.tsx           # KPI Dashboard (4 KPIs)
│   │   ├── reports/page.tsx       # Report generation & export
│   │   ├── admin/
│   │   │   ├── users/page.tsx     # User management (Admin only)
│   │   │   └── logs/page.tsx      # Activity logs (Admin only)
│   │   ├── proposals/page.tsx     # Line opening modification proposals
│   │   └── api/
│   │       ├── auth/route.ts      # Authentication
│   │       ├── pdp/route.ts       # PDP CRUD
│   │       ├── gammes/route.ts    # Gammes CRUD
│   │       ├── lignes/route.ts    # Ouverture Lignes CRUD
│   │       ├── schedule/route.ts  # Run heuristic scheduler
│   │       ├── optimize/route.ts  # Run GA optimizer
│   │       ├── scenarios/route.ts # Scenario CRUD
│   │       ├── proposals/route.ts # Proposal submit/approve/reject
│   │       ├── users/route.ts     # User management
│   │       └── export/route.ts    # Report export (PDF/Excel)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx        # Role-aware navigation
│   │   │   └── Header.tsx         # User info, notifications, alerts
│   │   ├── data/
│   │   │   ├── ExcelImporter.tsx  # Upload & parse Excel files
│   │   │   ├── PDPTable.tsx       # Editable PDP grid (products x months)
│   │   │   ├── GammesTable.tsx    # Editable gammes table
│   │   │   └── LignesTable.tsx    # Editable line opening params
│   │   ├── gantt/
│   │   │   ├── GanttChart.tsx     # Interactive Gantt visualization
│   │   │   ├── GanttBar.tsx       # Individual task bar
│   │   │   └── TimelineHeader.tsx # Time axis
│   │   ├── dashboard/
│   │   │   ├── OTDCard.tsx        # KPI 1: On-Time Delivery
│   │   │   ├── OccupationChart.tsx# KPI 2: Bar chart per line (color-coded)
│   │   │   ├── TardinessTable.tsx # KPI 3: Per-lot tardiness
│   │   │   ├── CapacityChart.tsx  # KPI 4: Available capacity per line
│   │   │   └── KPICard.tsx        # Reusable KPI summary card
│   │   ├── scenarios/
│   │   │   ├── ScenarioCard.tsx
│   │   │   ├── ScenarioCompare.tsx# Side-by-side KPI comparison
│   │   │   └── ScenarioEditor.tsx
│   │   └── alerts/
│   │       └── OverloadAlert.tsx  # Surcharge notification
│   ├── lib/
│   │   ├── data/
│   │   │   ├── products.ts        # Default P1-P13 data (fallback)
│   │   │   ├── lines.ts           # Default line capacities (fallback)
│   │   │   └── types.ts           # All TypeScript interfaces
│   │   ├── scheduler/
│   │   │   ├── engine.ts          # Core scheduling dispatcher
│   │   │   ├── heuristics.ts      # SPT, EDD, CR, LPT priority rules
│   │   │   ├── genetic.ts         # Genetic algorithm optimizer
│   │   │   └── metrics.ts         # KPI calculations (all 4)
│   │   ├── auth/
│   │   │   ├── session.ts         # Session management
│   │   │   └── roles.ts          # Role definitions & permission checks
│   │   ├── excel/
│   │   │   ├── parser.ts          # Parse uploaded Excel files
│   │   │   └── exporter.ts        # Export to Excel/PDF
│   │   └── utils/
│   │       └── time.ts            # Time conversion helpers
│   └── stores/
│       ├── scenarioStore.ts       # Zustand store for scenarios
│       └── authStore.ts           # Current user/role state
├── Docs/                          # Existing hackathon docs
└── package.json
```

---

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String   // hashed
  role      Role     @default(RESPONSABLE_ATELIER)
  logs      ActivityLog[]
  proposals Proposal[]
}

enum Role {
  PLANIFICATEUR
  RESPONSABLE_ATELIER
  ADMINISTRATEUR
  DIRECTION
}

model PDP {
  id        String   @id @default(cuid())
  name      String   // "PDP Q1 2026"
  data      Json     // { P1: {jan: 5, feb: 3, ...}, P2: {...}, ... }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model GammesProduits {
  id              String @id @default(cuid())
  data            Json   // { P1: { production: {A:6,B:26,...}, cleaning: {A:1.33,...} }, ... }
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model OuvertureLignes {
  id        String @id @default(cuid())
  data      Json   // { A: {weeks:4.2, coeff:1, shifts:1, days:7, hours:7}, ... }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Scenario {
  id            String   @id @default(cuid())
  name          String
  description   String?
  pdpId         String
  schedulingRule String  // SPT, EDD, CR, LPT, GA_OPTIMIZED
  schedule      Json     // computed schedule (operations array)
  kpis          Json     // computed KPIs (4 values)
  createdAt     DateTime @default(now())
}

model Proposal {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  workshop    String   // A-J
  changes     Json     // proposed changes to line opening params
  status      ProposalStatus @default(PENDING)
  createdAt   DateTime @default(now())
}

enum ProposalStatus {
  PENDING
  APPROVED
  REJECTED
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String   // "PDP_UPDATED", "SCHEDULE_RUN", "USER_CREATED", etc.
  details   String?
  createdAt DateTime @default(now())
}
```

---

## Scheduling Algorithm

### Heuristic Dispatcher (Core)
1. Read PDP → generate list of all production lots (product, quantity, due date = end of month)
2. For each lot, expand into operations based on its gamme (route through steps A-J)
3. For each operation, track dependencies (previous step must finish first)
4. At each decision point, pick next operation using the selected priority rule:
   - **SPT** (Shortest Processing Time): shortest job first → minimizes avg completion
   - **EDD** (Earliest Due Date): most urgent first → minimizes lateness
   - **CR** (Critical Ratio): (due - now) / remaining time → balances urgency
   - **LPT** (Longest Processing Time): longest first → better utilization
5. Assign to earliest available slot on the line, accounting for:
   - Line must be free (no overlap)
   - Cleaning time from previous batch
   - All predecessor operations complete

### Genetic Algorithm Optimizer (AI/ML)
1. **Chromosome**: permutation of all operations (scheduling order)
2. **Fitness**: makespan (lower = better)
3. **Selection**: tournament selection
4. **Crossover**: Order crossover (OX)
5. **Mutation**: swap two random operations
6. **Population**: 50 individuals, 100 generations
7. **Decode**: feed operation order into heuristic dispatcher
8. Output: best schedule found, with % improvement over baseline heuristic

---

## Implementation Phases

### PHASE 1: Foundation (2.5h)
- [ ] Init Next.js + TypeScript + Tailwind + Prisma
- [ ] Install deps: recharts, zustand, lucide-react, xlsx, shadcn/ui
- [ ] Set up database schema (Prisma) + run migrations
- [ ] Auth system: login page, session management, role-based middleware
- [ ] App shell: role-aware sidebar navigation
- [ ] Role permission utility (`canAccess(role, feature) → boolean`)

### PHASE 2: Data Management (3h)
- [ ] Excel importer component (upload .xlsx, parse with `xlsx` library)
- [ ] PDP page: import Excel OR edit in-app grid (products x months)
- [ ] Gammes Produits page: import Excel OR edit table (products x steps x production/cleaning)
- [ ] Ouverture Lignes page: import Excel OR edit table (params x steps)
- [ ] CRUD API routes for all 3 data sources
- [ ] Export to Excel for all 3 tables
- [ ] Validate imported data (correct structure, no missing fields)

### PHASE 3: Scheduling Engine (2.5h)
- [ ] TypeScript types for all domain objects
- [ ] Encode default Teriak data as fallback (from existing Excel)
- [ ] Build core scheduling dispatcher (engine.ts)
- [ ] Implement 4 heuristic rules (SPT, EDD, CR, LPT)
- [ ] KPI calculation module (all 4 KPIs)
- [ ] Load plan calculation: CH_j per line from PDP + gammes
- [ ] API route: POST /api/schedule → run scheduler → return schedule + KPIs

### PHASE 4: Visualizations (3h)
- [ ] **Load Plan view**: bar chart showing CH_j vs TO_j per line (overload in red)
- [ ] **Gantt chart**: X=time, Y=lines A-J, color-coded bars per product, cleaning as striped sections
- [ ] **KPI Dashboard**:
  - OTD card (percentage with trend)
  - Occupation rate bar chart per line (green < 70%, yellow 70-85%, red > 85%)
  - Tardiness table (per lot) with avg/max summary
  - Capacity available bar chart per line (negative = red)
- [ ] Hover tooltips, zoom, responsive layout

### PHASE 5: What-If Scenarios (2h)
- [ ] Create scenario (choose PDP + scheduling rule)
- [ ] Save scenario to DB with computed schedule + KPIs
- [ ] Clone existing scenario with modifications
- [ ] Side-by-side comparison view (2-3 scenarios)
- [ ] Comparison table: all 4 KPIs per scenario
- [ ] Highlight winner per metric

### PHASE 6: AI Optimizer (2h)
- [ ] Genetic algorithm implementation (genetic.ts)
- [ ] API route: POST /api/optimize → run GA → return optimized schedule
- [ ] Progress indicator (generation count, best fitness)
- [ ] "Optimize" button on scenario page
- [ ] Show improvement % vs heuristic baseline
- [ ] Save optimized result as new scenario

### PHASE 7: Alerts, Proposals & Admin (1.5h)
- [ ] Overload alerts: auto-detect lines where tau_j > 100%, notify Planificateur + Resp. Atelier
- [ ] Proposal system: Resp. Atelier submits line opening changes → Planificateur approves/rejects
- [ ] Admin panel: user CRUD, role assignment
- [ ] Activity log: record all actions, viewable by Admin
- [ ] Report generation: export KPIs + schedule as PDF/Excel

### PHASE 8: Polish (2h)
- [ ] UI theme: professional industrial look (green tones matching hackathon branding)
- [ ] Loading states, empty states, error handling
- [ ] App branding/logo
- [ ] Edge cases: products with zero-time steps, empty PDP months
- [ ] Mobile-responsive layout

### PHASE 9: Pitch Prep (2h)
- [ ] PPT/PDF presentation (industrial engineers lead):
  - Slide 1: Problem (Teriak's challenge)
  - Slide 2: Solution overview + architecture
  - Slide 3: Live demo screenshots (data import, Gantt, KPIs, scenarios)
  - Slide 4: AI optimization results (before/after)
  - Slide 5: Role-based access & security
  - Slide 6: Business impact & scalability
- [ ] Rehearse 5-min pitch + prepare for Q&A

---

## Role Assignment

| Person | Role | Focus |
|--------|------|-------|
| **You (Software Eng)** | Lead Developer | Build entire app: frontend, backend, scheduling engine, DB |
| **Industrial Eng 1** | Data Validator + Algorithm Advisor | Verify product data, validate schedule logic, define realistic test scenarios |
| **Industrial Eng 2** | Tester + UX Feedback | Create production order sets, test all roles, suggest UI improvements |
| **Industrial Eng 3** | Presentation Lead | Build PPT, prepare pitch script, handle Q&A prep |

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "recharts": "^2.15",
    "zustand": "^5",
    "lucide-react": "latest",
    "@prisma/client": "^6",
    "xlsx": "^0.18",
    "bcryptjs": "^2.4",
    "tailwindcss": "^4",
    "class-variance-authority": "latest",
    "clsx": "latest"
  },
  "devDependencies": {
    "prisma": "^6",
    "typescript": "^5"
  }
}
```

---

## Verification Plan

1. **Data import**: Upload each of the 3 Excel files → verify data displays correctly in tables
2. **Data edit**: Modify a value in-app → verify it persists after refresh
3. **Load calculation**: For line A, manually compute CH_A = sum of (production + cleaning) for all lots → compare with app
4. **KPIs**:
   - tau_j: manually verify for one line
   - CD_j: verify TO_j - CH_j matches
   - OTD & Tardiness: schedule one simple case, verify dates
5. **Scheduling**: Schedule single product P1 → verify correct step sequence and times in Gantt
6. **Scenarios**: Create 2 scenarios with different rules → verify KPIs differ in comparison view
7. **GA Optimizer**: Run optimizer → verify makespan <= heuristic makespan
8. **Roles**: Login as each role → verify correct features visible/hidden
9. **Proposals**: Resp. Atelier submits proposal → Planificateur sees it → approves → verify line params updated
10. **Export**: Generate report → verify PDF/Excel downloads correctly
