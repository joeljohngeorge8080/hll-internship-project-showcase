# Handoff — 2026-07-08/09 session (LSGB Revenue sourcing, Super Forecasting rebuild, CEO dashboard)

> Read this before touching `hma-template/emsv1/src/modules/ems/hr-pool/**`,
> `src/modules/ems/reports-analysis/SuperForecastingPage.jsx`, or
> `src/modules/ems/dashboard/**`. Background specs/plans:
> `docs/superpowers/specs/2026-07-08-expense-pool-lsgb-admin-share-revenue-sources-design.md`,
> `docs/superpowers/plans/2026-07-08-expense-pool-lsgb-admin-share-revenue-sources.md`,
> `docs/superpowers/specs/2026-07-08-super-forecasting-ceo-dashboard-design.md`,
> `docs/superpowers/plans/2026-07-08-super-forecasting-ceo-dashboard.md`.
>
> Note: this file replaces the previous handoff (ADR-036 scope narrowing,
> role removal, PA dashboard trim). That work is done and merged; its
> **unresolved open items are carried forward** near the bottom of this file
> so they aren't lost. Full detail for that session is still in git history
> (`git show <commit>` on the PMS/roles/permissions commits from 2026-07-08
> afternoon) if needed.

## What this session did

Five rounds of work, all in the EMS module.

### 1. LSGB Revenue + Admin 5% Share as new Expense Pool revenue sources
User asked: Expense Pools (HR/Admin/Core "Add Expense" forms) needed a third
revenue source, **LSGB Revenue**, plus a fourth, **Core-only** source,
**Admin 5% Share**, representing salaries actually funded by pulling from
Admin's own pool.
- `ExpensePoolCard.jsx`'s `RevenueSourceSelector` generalized from a
  hardcoded 2-source model (HR Revenue / Project Pool) to a configurable
  N-source one (2–4), reusing the file's existing proportional-redistribution
  algorithm (previously only used for splitting one expense across projects)
  for the revenue-source-percentage axis too. `BudgetCapAlert` extracted as
  its own component so Core's new Admin-Share row reuses the exact same
  over-budget warning Project Pool already had.
- LSGB Revenue: informational only (like HR Revenue) — its `lsgb_revenue_pct`
  is persisted per expense but never affects real budget math.
- Admin 5% Share: a **real cross-pool deduction** — `localOrgPool.js`'s
  `getMonthlyAdminPoolBudgetSummary`/`getProjectsMonthlyAdminRemaining` now
  also scan Core's expenses for `admin_pool`-tagged entries, so Admin's own
  budget correctly reflects money Core drew from it. No per-project
  allocation breakdown for this source (explicit scope cut, confirmed with
  user) — flat aggregate draw only.
- Verified via Playwright (dev-login HR): 3-way split renders/redistributes
  correctly on HR/Admin cards, 4-way (Admin Share) only appears on Core,
  percentage-sum validation blocks Add when invalid, badges show correctly
  on saved expenses.

### 2. "Profit / Loss vs LSGB" → "Super Forecasting" (renamed + rebuilt)
User asked: the forecasting page needed to (a) actually reflect the new
LSGB-tagged Expense Pool spending from round 1 (previously invisible to it —
it read a completely different data store), (b) add a reverse-calculator
answering "how much new project value do we need to cut LSGB borrowing by
10%?", (c) become a comprehensive, kid-simple CEO command-center covering
expenses/projects/HR health, and (d) be renamed.
- File renamed `LsgbDependencyPage.jsx` → `SuperForecastingPage.jsx` (route
  now `/ems/reports-analysis/super-forecasting`, nav label "Super
  Forecasting"). **This broke two widgets from a concurrently-developed
  teammate PR** — see "Cross-session friction" below, already fixed.
- `computeLsgbTotals(rangeStart, rangeEnd)` (still the same exported
  signature, still consumed by the Dashboard's Profit/Loss widget) now folds
  Expense Pools' HR/Admin/Core expenses into `expenses` via a new
  `poolExpenses: { totalAmount, lsgbTaggedAmount, count }` field (also
  returns `projectCount` now). `ownRevenue` is untouched — verdict formula
  (`lsgbNeed = max(0, expenses - ownRevenue)`) unchanged, so "more spending
  routed through LSGB-tagged entries = bigger shortfall = more likely loss"
  falls out naturally, no new branching logic.
- New exported pure function `computeLsgbReductionPlan(totals, targetPct)`:
  weighted-average pool-cut % across *real* active projects' own
  `admin_pct`/`hr_pct`/`core_pct` (not a hardcoded 15%), used to compute
  required new project value + approx project count to hit a target %
  reduction in LSGB borrowing (or growth in an existing surplus).
- Also extracted (previously page-only inline logic) as exported pure
  functions so the page and dashboard widgets share one source of truth:
  `computeHRRevenueBreakdown()`, `computeExpenseGlance(totals)`,
  `computeHRHealth(rangeStart, rangeEnd, hrRevenueTotal)`, `poolHealth(summary)`.
- Kid-simple language throughout: "Total Expenses"→"Money We Spent", "Own
  Revenue"→"Money We Earned", "LSGB Need"→"Money We Had to Borrow"; the old
  7-column month-by-month table cut to 4 plain columns.
- **All emoji removed from this page** per explicit user follow-up (verdict
  icon dropped, month-table status column uses plain "Covered"/"Borrowed"
  badges instead of ✅/⚠️).
- Verified via Playwright (dev-login CEO): rename/route/nav all correct,
  verdict banner + new Expense-Pools line in "Money We Spent" breakdown,
  calculator's zero-active-project fallback (no crash/NaN), all three new
  glance sections render with real data, simplified table, Dashboard's
  Profit/Loss widget still renders correctly post-rename.

### 3. Verified two teammates' merged PRs (no code changes, verification only)
User asked to confirm friends' pushes to `master2` merged correctly. Found
(already merged, clean, no conflict markers):
- `f17eba7`/`b6ce276` (prathyusha71, "ceo dashboard changes v1") — 8 new
  dashboard widgets (`OrgHealthWidget`, `MonthAtGlanceWidget`,
  `ProjectStatusWidget`, `BudgetAlertsWidget`, `MoneyFlowWidget`,
  `ConsolidatedBudgetWidget`, `RevenueVsSpendWidget`, `TopProjectsWidget`,
  `UpcomingDeadlinesWidget`, `InstallmentStatusWidget`) + a `Dashboard.jsx`
  overhaul reordering the widget catalog into a CEO-friendly flow.
- `f02ecc5`/`6b4a408` (Sridd, "recurring tasks…") — new "divide tasks
  equally across months" section in PMS's `MonthlyPlanPanel.jsx`. Confirmed
  this session's earlier `ActualExpenseCard` feature (added before this
  handoff's session) survived the merge intact.
- **Cross-session friction, already resolved:** prathyusha71's branch was
  cut before round 2's file rename, so her new `OrgHealthWidget.jsx` and
  `RevenueVsSpendWidget.jsx` imported `computeLsgbTotals` from the
  now-deleted `LsgbDependencyPage` path. Sridd caught and fixed both
  (`5c13675`, pushed directly to `master2`) shortly after the merges landed.
  Confirmed via `grep -rn "LsgbDependencyPage" src/` — zero remaining
  references anywhere. **If this file moves/renames again, grep the whole
  repo for both `LsgbDependencyPage` and `computeLsgbTotals` imports first**
  — it's now consumed by five widgets, not one.
- `npm run build` clean after the merges; browser-verified as CEO.

### 4. Dashboard-wide professional polish (ui-ux-pro-max skill)
User asked to use the `ui-ux-pro-max` skill to make the EMS Dashboard more
professional. Queried the skill's style/UX/typography search
(`python3 src/ui-ux-pro-max/scripts/search.py`, lives at
`hma-template/emsv1/plugins/ui-ux-pro-max-skill/`) — confirmed the existing
Fira Code + Fira Sans pairing already matches its recommended "Dashboard
Data" font pairing, so typography was left alone. What changed, across all
13 dashboard files (`Dashboard.jsx`, `DashboardGrid.jsx`, and 11 widget
files):
- Every emoji (🟢🚀✅🏆🔍📅💸👥🍩📊💼🎯⏰💳🚨⛔⚠️🎉🥇🥈🥉 etc.) replaced with
  CoreUI line icons (`cilCheckCircle`, `cilWarning`, `cilXCircle`,
  `cilBriefcase`, `cilMediaPlay`, `cilCheckAlt`, `cilSearch`, `cilTask`,
  `cilBellExclamation`, `cilChartPie`, `cilBarChart`, `cilChartLine`,
  `cilWallet`, `cilBank`, `cilClock`, `cilAlarm`, `cilCalendar`, `cilCash`,
  `cilPeople`, `cilBuilding`, `cilSettings`, `cilLocationPin`, etc.).
- Exclamatory/informal copy toned down: "All Done!"→"Completed", "Plenty
  left"→"Healthy", "All clear!"→"All Clear", rank medals (🥇🥈🥉)→styled
  #1/#2/#3 with gold/silver/bronze text color, alert severity now shown as
  text ("OVER BUDGET · General Expenses") instead of an emoji prefix.
- `ProfitLossWidget.jsx` wording aligned with the newer widgets' "Govt
  Grants (LSGB)" phrasing.
- Layout, colors, and all data/computation logic untouched — purely a
  presentation pass. Verified via before/after full-page Playwright
  screenshots (light + dark); `npm run build`/lint clean (only the
  pre-existing repo-wide `react-hooks/set-state-in-effect` baseline
  remained, confirmed by diffing against each file's pre-session lint
  output — not a regression).

### 5. Three Super Forecasting sections brought onto the CEO dashboard
User asked to surface more of Super Forecasting's content on the main
dashboard, "in the front." Added as a new row immediately after Budget
Alerts (both in `ALL_WIDGETS` and `CEO_DEFAULT_IDS`, so active by default
and near the top):
- **`LsgbReductionWidget.jsx`** ("Cut LSGB Borrowing") — dashboard version
  of the reverse-calculator, fixed at a 10% target (read-only; open the full
  Super Forecasting page to try a different %).
- **`ExpenseHealthWidget.jsx`** ("Expense Health Check") — operating
  contract / Expense Pool entry / projects-with-a-plan counts, plus
  OK/Watch/Over Budget/No Data badges for HR/Admin/Core this month.
- **`HRPerformanceWidget.jsx`** ("How Is HR Doing?") — HR revenue vs HR's
  own cost as a coverage %, plus the recruitment/training/internship
  breakdown.
- All three call the functions extracted in round 2
  (`computeExpenseGlance`, `computeHRHealth`, `computeHRRevenueBreakdown`,
  reused alongside the already-shared `computeLsgbTotals`/
  `computeLsgbReductionPlan`) — single source of truth between the page and
  the dashboard, no duplicated logic.
- Verified via Playwright: all three render with correct empty-state
  fallbacks (0 active projects → "Add at least one active project…", 0 HR
  cost → "HR has no recorded cost this period"), dashboard header correctly
  updates to "18 of 26 widgets active."

## Verified this session

- `npm run build` — clean, every round (5 separate verifications).
- `npm run lint` — no *new* errors introduced in any round; every reported
  error was diffed against that same file's pre-change lint output to
  confirm it was pre-existing baseline (the repo-wide
  `react-hooks/set-state-in-effect` pattern — this file's own effects, and
  now every widget touched this session, already had it before these
  changes).
- Live browser verification (Playwright via a scratch npm prefix — same
  `.npmrc` workaround noted in the previous handoff, still not fixed, still
  out of scope) for every round, with dev-login as HR (round 1) and CEO
  (rounds 2, 3, 5): screenshots confirm correct rendering, correct data,
  and correct empty-state handling throughout.
- All commits pushed to `origin/master2`.

## Open items for next session

**New from this session:**
1. **`localAdminExpenses` (vendor contracts, "Forecast Expense" tab) and
   `localOrgPool`'s HR/Admin/Core expenses (Expense Pools cards) are two
   disconnected data stores** with no cross-reference — they may
   double-record the same real-world expense. Not solved this session
   (explicitly out of scope, flagged to user, documented in the Super
   Forecasting design spec) — worth a real reconciliation pass if the
   organization is actually double-entering the same costs in both places.
2. **The Admin 5% Share source has no per-project allocation breakdown**
   (flat aggregate draw against Admin's budget only) — explicit scope cut,
   confirmed with user. Revisit if the CEO later needs to know *which*
   project's admin-cut money funded a specific Core salary.
3. **LSGB Revenue's "available" figure is non-cumulative** — it only checks
   the current expense being entered against `localLsgb.getSummary().remaining`,
   not previously-logged LSGB-tagged expenses in the same period (matches
   HR Revenue's existing behavior, deliberately not stricter). If the CEO
   wants a running/cumulative LSGB draw check, that's a design change, not
   a bug.
4. **Watch for other widgets importing from `SuperForecastingPage.jsx`** if
   it moves/renames again — see the "Cross-session friction" note in round 3
   above. Currently imported by: `ProfitLossWidget.jsx`, `OrgHealthWidget.jsx`,
   `RevenueVsSpendWidget.jsx`, `LsgbReductionWidget.jsx`,
   `ExpenseHealthWidget.jsx`, `HRPerformanceWidget.jsx`.
5. **`.npmrc`/global npm prefix is still broken** in this environment (same
   note as last handoff — untouched, pre-existing, workaround is
   `npm_config_prefix=<scratch-dir>` per command).

**Carried forward from the previous (2026-07-08 ADR-036) handoff, still
unresolved — none of this session's work touched these:**
6. `/pms/dashboard` is still an empty page (0 widgets) — PA/PO already
   default elsewhere so it may be low-impact, but still unresolved.
7. `PROJECT_TODO.md` P4.1.6/P4.2.6 still show ⬜ despite being done in code.
8. Confirmed-dead code still in place (hide-don't-delete convention):
   `src/modules/pms/daily-reports/**`, 6 orphaned dashboard widget
   components (`ProjectKPIsWidget`, `ProjectValueWidget`,
   `DailyReportsSummaryWidget`, `FieldPersonnelWidget`,
   `ProjectsByPhaseWidget`, `RecentProjectsWidget`, `SettlementsWidget`),
   `DEMO_APPROVALS` in `ProjectDetailPage.jsx`.
9. `MODULE.PMS_SETTLEMENTS` still grants HR edit access with no nav path to
   reach it.

## Files touched this session (all under `hma-template/emsv1/src/`, plus specs/plans under `docs/superpowers/`)

```
components/dashboard/DashboardGrid.jsx
modules/ems/_nav.jsx
modules/ems/dashboard/Dashboard.jsx
modules/ems/dashboard/widgets/BudgetAlertsWidget.jsx
modules/ems/dashboard/widgets/ConsolidatedBudgetWidget.jsx
modules/ems/dashboard/widgets/ExpenseHealthWidget.jsx          (new)
modules/ems/dashboard/widgets/HRPerformanceWidget.jsx          (new)
modules/ems/dashboard/widgets/InstallmentStatusWidget.jsx
modules/ems/dashboard/widgets/LsgbReductionWidget.jsx          (new)
modules/ems/dashboard/widgets/MoneyFlowWidget.jsx
modules/ems/dashboard/widgets/MonthAtGlanceWidget.jsx
modules/ems/dashboard/widgets/OrgHealthWidget.jsx
modules/ems/dashboard/widgets/ProfitLossWidget.jsx
modules/ems/dashboard/widgets/ProjectStatusWidget.jsx
modules/ems/dashboard/widgets/RevenueVsSpendWidget.jsx
modules/ems/dashboard/widgets/TopProjectsWidget.jsx
modules/ems/dashboard/widgets/UpcomingDeadlinesWidget.jsx
modules/ems/hr-pool/ExpensePoolCard.jsx
modules/ems/hr-pool/GlobalHRPoolPage.jsx
modules/ems/reports-analysis/LsgbDependencyPage.jsx            (deleted — renamed)
modules/ems/reports-analysis/SuperForecastingPage.jsx          (new — renamed from above)
routes/ems.routes.js
services/localOrgPool.js
```

Not touched by me this session but merged into `master2` during it (see
round 3): `modules/pms/project-associate/MonthlyPlanPanel.jsx` (Sridd's
recurring-tasks feature), plus the 8 new dashboard widget files from
prathyusha71's PR (all subsequently edited by round 4's polish pass, listed
above).
