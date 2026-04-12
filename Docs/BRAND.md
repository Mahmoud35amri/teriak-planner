---
name: Teriak Planner — Brand & Design System
description: Complete UI design system: fonts, colors, tokens, component patterns, and aesthetic direction established in Phase 8 polish + frontend-design audit
type: project
---

## Aesthetic Direction: "Precision Industrial"

Pharmaceutical production planner for Laboratoires Teriak. Jury-facing hackathon app. Aesthetic mirrors lab instrumentation + aerospace control interfaces — precise, data-rich, credibly professional.

**Why:** Teal accent over blue = more distinctive, industrial/lean manufacturing feel. Dark sidebar = immediately elevates perceived quality, separates content from navigation. Oswald + DM Sans = character without being trendy.

**How to apply:** Never revert to generic blue-600 primary or white sidebar. All new pages must use the CSS design tokens defined below.

---

## Fonts (loaded in `src/app/layout.tsx`)

| Role | Font | Variable | Usage |
|------|------|----------|-------|
| Body | DM Sans | `--font-sans` | All UI text, labels, inputs |
| Display/Headings | Oswald | `--font-display` | Sidebar app name, section group labels, header title, card headings, KPI labels, button text |
| Data/Monospace | JetBrains Mono | `--font-mono` | KPI numbers (OTD%, tardiness, occupation%), lot IDs, numeric values |

Applied in `layout.tsx` via `next/font/google`. Body set via inline `style={{ fontFamily: "var(--font-sans), Arial, sans-serif" }}` on `<body>`.

---

## CSS Design Tokens (`src/app/globals.css` `:root`)

```css
/* Sidebar */
--sidebar-bg: #0f172a          /* deep slate/charcoal */
--sidebar-border: #1e293b      /* slate-800 */
--sidebar-text: #94a3b8        /* slate-400 */
--sidebar-text-active: #ffffff
--sidebar-active-bg: rgba(255,255,255,0.08)
--sidebar-hover-bg: rgba(255,255,255,0.05)

/* Accent (teal — replaces blue as primary) */
--accent: #0d9488              /* teal-600 */
--accent-hover: #0f766e        /* teal-700 */
--accent-light: #ccfbf1        /* teal-100 */
--accent-text: #0d9488

/* Page */
--background: #f8fafc          /* slate-50, slightly cooler than gray-50 */
--foreground: #0f172a          /* slate-900 */
```

---

## Sidebar (`src/components/layout/Sidebar.tsx`)

- **Background**: `var(--sidebar-bg)` (#0f172a)
- **Border**: `var(--sidebar-border)`
- **Logo**: 32×32 rounded-lg, `var(--accent)` background, white "T" in Oswald
- **App name**: "TERIAK PLANNER" in Oswald, white, tracking 0.02em
- **Nav groups**: Données / Planification / Gestion / Administration — Oswald uppercase labels in #475569, tracking 0.08em
- **Active link**: `var(--sidebar-active-bg)` + teal left border (2px), white text — applied via inline style + `onMouseEnter/Leave`
- **Hover**: `var(--sidebar-hover-bg)`, white text
- **Default nav**: `var(--sidebar-text)` (slate-400)
- **User footer**: white name, slate-400 email, teal glass role badge (`rgba(13,148,136,0.15)` bg + `var(--accent)` text)
- **Mobile**: `fixed z-30`, slides in with `translate-x`, `md:relative md:translate-x-0`
- **Scrollbar class**: `.sidebar-scroll` (darker thumb: #334155)

---

## Login Page (`src/app/login/page.tsx`)

Two-panel layout (desktop):
- **Left (dark)**: `var(--sidebar-bg)`, teal "T" logo, Oswald stacked "TERIAK / PLANNER" in white, feature list with teal bullet dots, slate-600 description text
- **Right (light)**: `bg-gray-50`, white card `rounded-2xl`, uppercase Oswald field labels, teal focus ring via `onFocus/onBlur` inline style, Oswald "SE CONNECTER" submit button in `var(--accent)`

Mobile: collapses to right panel only with centered logo.

---

## Header (`src/components/layout/Header.tsx`)

- Title rendered via `title.toUpperCase()` in Oswald, tracking 0.03em
- Hamburger (18×18 SVG) visible only `md:hidden`, slate-400 → gray-700 on hover
- Logout: `text-xs font-medium text-gray-400 hover:text-gray-700`, hover:bg-gray-100 pill

---

## KPI Dashboard (`src/app/kpi/KPIClient.tsx`)

KPI summary cards:
- `rounded-xl` (not rounded-lg)
- Label row: Oswald uppercase, tracking-wider, text-gray-400
- Value: JetBrains Mono, `text-4xl font-bold`
- Colors: green `#22C55E` (OTD≥90, 0 late lots), amber `#F59E0B` (OTD 70-89), red `#EF4444` (OTD<70, late>0)

---

## Plan de Charge (`src/app/planning/charge/ChargeClient.tsx`)

Occupation summary cards:
- `rounded-xl`
- Line label: Oswald uppercase, tracking-wider, text-gray-400 (just "A", "B"… not "Atelier A")
- Occupation value: JetBrains Mono, `text-2xl font-bold`

---

## Dashboard (`src/app/dashboard/DashboardClient.tsx`)

- Welcome label: Oswald uppercase teal "BIENVENUE" in teal accent, tracking-widest
- User name: Oswald, `text-xl font-bold`, `.toUpperCase()`
- Cards: `rounded-xl`, `border-t: 2px solid transparent` → teal on hover via `onMouseEnter/Leave`
- Card title: Oswald `.toUpperCase()`, hover:text-teal-700
- Hover shadow: `0 4px 16px -4px rgba(13,148,136,0.12)` (teal glow)

---

## Global CSS Utilities (`src/app/globals.css`)

```css
.font-data    /* JetBrains Mono — for numeric data */
.font-display /* Oswald — for headings/labels */
```

Focus ring: `focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`

Scrollbar: 5px wide, `#cbd5e1` thumb → `#94a3b8` hover (main); `.sidebar-scroll` has `#334155` → `#475569`

---

## What NOT to Do

- Do not use `bg-blue-600` for primary actions on new features — use `var(--accent)` / `bg-teal-600`
- Do not use white sidebar (`bg-white border-r border-gray-200`)
- Do not use Inter or Arial as the design font
- Do not use `rounded-lg` for KPI/metric cards — use `rounded-xl`
- Do not hardcode hex colors for occupation thresholds in new components — reuse the `occupationColor()` helper pattern
- Do not use `text-blue-700` for active states in sidebar — the dark sidebar uses white/teal inline styles
