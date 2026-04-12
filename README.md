# Teriak Production Load Planner

Application web de planification de production pour **Laboratoires Teriak** : ordonnancement Job Shop, analyse de faisabilite, tableaux de bord KPI et scenarios What-If.

Projet developpe dans le cadre du hackathon **LeanX 1.0** (24h, 11-12 avril 2026).

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Base de donnees | Prisma ORM 5 + SQLite |
| Etat client | Zustand |
| Graphiques | Recharts |
| Excel I/O | xlsx + exceljs |
| Authentification | bcryptjs + iron-session (cookies) |

---

## Installation

```bash
# 1. Installer les dependances
npm install

# 2. Initialiser la base de donnees
npx prisma generate
npx prisma db push

# 3. Peupler les donnees initiales (utilisateurs, PDP, gammes, lignes)
node prisma/seed.mjs

# 4. Lancer le serveur de developpement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

### Comptes initiaux

| Role | Email | Mot de passe |
|------|-------|-------------|
| Planificateur | planificateur@teriak.tn | Teriak@2026! |
| Responsable Atelier | atelier@teriak.tn | Teriak@2026! |
| Administrateur | admin@teriak.tn | Teriak@2026! |
| Direction | direction@teriak.tn | Teriak@2026! |

---

## Fonctionnalites

### Gestion des donnees
- **PDP** (Plan Directeur de Production) : lots par produit (P1-P13) par mois, import/export Excel
- **Gammes Produits** : temps de production et nettoyage par produit par atelier (A-J), import/export Excel
- **Ouverture Lignes** : parametres de capacite par atelier (semaines, coefficient, postes, jours, heures), import/export Excel

### Ordonnancement
- 5 regles de priorite : SPT, EDD, CR, LPT, GA (algorithme genetique)
- Diagramme de Gantt interactif avec legende produits, barres de nettoyage, tooltips et marqueur makespan
- KPI en temps reel : OTD, lots en retard, makespan, retard max

### Analyse de faisabilite
- Taux d'occupation par atelier par mois (CH/TO x 100)
- Detection automatique des surcharges (> 100%)
- Propositions de modification des parametres de lignes
- Graphique detaille par mois avec seuils visuels

### Tableaux de bord KPI
- 4 KPI : OTD, Occupation, Retard, Capacite disponible
- Vue mensuelle detaillee par atelier
- Export Excel des resultats

### Scenarios What-If
- Creation de scenarios avec differentes regles d'ordonnancement
- Comparaison de 2-3 scenarios cote a cote
- Graphiques d'impact (charge, KPI)
- Application d'un scenario au plan courant

### Administration
- Gestion des utilisateurs (CRUD, attribution des roles)
- Journaux d'activite avec filtrage et pagination

---

## Roles et permissions

| Permission | Planificateur | Resp. Atelier | Administrateur | Direction |
|-----------|:---:|:---:|:---:|:---:|
| Editer PDP | x | | | |
| Editer Gammes/Lignes | x | | | |
| Lancer l'ordonnancement | x | | | |
| Gerer les scenarios | x | | | |
| Approuver les propositions | x | | | |
| Soumettre une proposition | | x | | |
| Voir les donnees metier | x | x | | x |
| Voir les KPI | x | x | | x |
| Exporter les rapports | x | x | | x |
| Gerer les utilisateurs | | | x | |
| Voir les journaux | | | x | |

---

## Modeles de donnees

### PDP
```json
{ "P1": { "jan": 1, "feb": 1, "mar": 1, ... }, "P2": { ... }, ... }
```
Nombre de lots par produit par mois.

### Gammes Produits
```json
{ "P1": { "production": { "A": 6, "B": 26, "I": 95.09 }, "cleaning": { "A": 1.33, "B": 2.67, "I": 0 } }, ... }
```
Temps en heures par produit par atelier. Chaque produit a sa propre gamme (tous ne passent pas par les 10 ateliers).

### Ouverture Lignes
```json
{ "A": { "weeks": 4.2, "coeff": 1.0, "shifts": 1, "days": 7, "hours": 7 }, ... }
```
Capacite mensuelle : TO = weeks x coeff x shifts x days x hours.

---

## Formules KPI

| KPI | Formule | Description |
|-----|---------|-------------|
| OTD | count(Ci <= di) / N x 100 | Taux de livraison a temps (%) |
| Occupation | CH_j / TO_j x 100 | Taux d'occupation par atelier (%) |
| Retard | max(0, Ci - di) | Retard par lot (heures) |
| Capacite disponible | TO_j - CH_j | Heures restantes par atelier |

---

## Structure du projet

```
src/
  app/                    # Pages Next.js (App Router)
    api/                  # Routes API (schedule, pdp, gammes, lignes, scenarios, proposals, auth, admin)
    dashboard/            # Tableau de bord
    data/                 # Pages de donnees (PDP, Gammes, Lignes)
    planning/             # Analyse de faisabilite + Gantt
    kpi/                  # Tableau de bord KPI
    scenarios/            # Scenarios What-If
    proposals/            # Propositions de modification
    admin/                # Utilisateurs + Journaux
    login/                # Authentification
  components/             # Composants React
    layout/               # AppShell, Sidebar, Header
    planning/             # SchedulerPanel, ProposalsPanel
    scenarios/            # ScenarioCard, ScenarioComparison, ScenarioCreateForm, ScenarioImpactCharts
  lib/
    scheduler/            # Moteur d'ordonnancement (engine, heuristics, genetic, metrics)
    data/                 # Types + donnees par defaut
    auth/                 # Session + roles + permissions
    excel/                # Import/export Excel
  stores/                 # Zustand (authStore, scheduleStore, scenarioStore)
prisma/
  schema.prisma           # Schema de base de donnees
  seed.mjs                # Script de peuplement initial
```

---

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de developpement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | Linter ESLint |
| `node prisma/seed.mjs` | Peupler la base de donnees |
| `npx prisma studio` | Interface graphique pour la BDD |

---

## Licence

Projet interne Laboratoires Teriak.
