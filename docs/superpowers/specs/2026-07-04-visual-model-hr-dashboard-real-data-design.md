# Visual Model — HR Dashboard Real-Data Wiring — Design Spec

**Date:** 2026-07-04
**Module:** EMS Reports & Analysis → Visual Model (`hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`)
**Status:** Approved by user (data mapping confirmed via questions; visual polish confirmed via `dataviz` skill + `ui-ux-pro-max-skill` CLI research, validated below).

## Background

`VisualModelPage.jsx` has two unrelated sections behind a top switcher:
- **Projects SDP** — already real: sourced from `services/sdpProjectsData.js` (itself sourced from a CSV), with a live map, status/funding-agency breakdowns. **No changes in this spec.**
- **HR Dashboard** — entirely mock: `HR_DEPARTMENTS`, `HR_ATTENDANCE_MONTHS`/`HR_ATTENDANCE`, `HR_PAYROLL_MONTHS`/`HR_PAYROLL_TOTALS`, `HR_EMPLOYMENT_TYPES` are hardcoded module-level constants (lines 61–82); none of the app's real employee/attendance/payroll services are imported.

`LsgbDependencyPage.jsx` (the other Reports & Analysis page) is already fully real — no changes needed there either.

This spec covers wiring the **HR Dashboard** section to real data.

## Data source audit

- **Departments/gender**: `localEmployees.list()` (default excludes `status: 'Deleted'`) returns employees with `employment.department` (free-text string) and `gender` (`'Male'`/`'Female'`). No separate department catalog exists — "departments" are just the distinct values found on current employee records.
- **Attendance**: `localAttendance.listMonthlySummaries({ year, month })` returns one row per employee per month with `present_count`, `absent_count`, `leave_count`. Only months with an actual attendance import return rows — no fabricated fallback.
- **Payroll**: `localPayroll.js` has no monthly payroll ledger/history — only a salary-splitting utility and each employee's live `current_salary`. There is no real 6-month trend to show.
- **Employment type**: no field (`employment_type` or equivalent) exists anywhere on the employee record.

## Decisions (confirmed with user)

1. **Payroll widget** → replaced with a single stat tile: sum of `current_salary` across Active employees today, explicitly labeled as a current snapshot (not a trend). The 6-bar chart is removed.
2. **Employment Type donut** → removed entirely. No backing field exists; adding one is a separate, larger change to the Employee model/forms and out of scope here.
3. **Departments + gender + Attendance trend** → wired to real data (below).

## Section 1 — Departments card + bar chart

- Replace `HR_DEPARTMENTS` with a computed value: `localEmployees.list().filter(e => e.status === 'Active')`, grouped by `employment.department` (skip/bucket blank department as `'Unassigned'`), producing `{ name, headcount, male, female }` per group — same shape the existing `DeptBar` component already consumes, so `DeptBar` itself needs no change, only its input.
- `totalHeadcount`, `totalMale`, `totalFemale` (currently lines 370–374, reduced over the mock array) become reductions over this same real list.
- **Colors** (validated via `dataviz` skill's `validate_palette.js`, light mode, categorical): Male `#3b82f6`, Female `#ec4899` — this is the pair already in the current code (`VisualModelPage.jsx:242-243`); validation confirms it passes lightness band, chroma floor, CVD separation (ΔE 40.5/109.3/76.0), and contrast — **no change needed**, keep as-is.

## Section 2 — Attendance trend

- Replace the fixed `HR_ATTENDANCE_MONTHS = ['Jan'...'Jun']` with the **trailing 6 calendar months ending at the current month** (computed from `new Date()`, not hardcoded).
- For each of those 6 months, call `localAttendance.listMonthlySummaries({ year, month })`; average `present_count` / `absent_count` / `leave_count` across all rows returned for that month, converting to a percentage of `present + absent + leave` (matching the existing chart's 0–100% y-axis). A month with zero rows (no import happened yet) renders as `0`, not a fabricated/interpolated value — real gaps stay visible.
- **Color fix**: the "On Leave %" line currently uses `#f59e0b` (amber-500), which the validator flags with a contrast WARN against the light chart surface (2.09:1, below the 3:1 floor) when checked alongside the Present/Absent status colors. Swap to `#d97706` (amber-600) — re-validated, all three status colors (`#059669` present / `#ef4444` absent / `#d97706` leave) now pass lightness, chroma, CVD separation (ΔE 12.7/29.3/42.3), and contrast cleanly. This is a one-line color constant change with no other effect — the line chart already has a legend (3 series) satisfying the dataviz rule that ≥2 series must have a legend.

## Section 3 — Payroll stat tile

- Remove `HR_PAYROLL_MONTHS`, `HR_PAYROLL_TOTALS`, and the `PayrollBar` chart component entirely.
- Replace with a single KPI-style stat tile (reusing the existing `KpiCard` component already in this file, same pattern as the other top-row KPIs): label "Total Monthly Payroll (current)", value = `localEmployees.list().filter(e => e.status === 'Active').reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0)`, formatted with the existing `fmt`/`fmtCompact` currency helpers already in the file.
- This follows the dataviz principle directly: a single current figure with no time dimension is a stat tile, not a forced bar chart.

## Section 4 — Employment Type removal

- Remove `HR_EMPLOYMENT_TYPES`, `HR_EMPLOYMENT_COLORS`, and the `EmploymentDonut` component and its render call entirely. No replacement widget — the HR Dashboard's KPI row and remaining two charts (Departments, Attendance) fill the space.

## Non-goals

- Adding a real `employment_type` field to the Employee model (bigger, separate change).
- Building a persisted monthly payroll ledger/history (bigger, separate change — would enable a real Payroll trend later).
- Any change to the Projects SDP section or to `LsgbDependencyPage.jsx` — both are already real.
- Any change to chart library/stack — stays Chart.js via `@coreui/react-chartjs` per ADR-010, using the same `DeptBar`/`AttendanceTrend`/`KpiCard` component patterns already in this file.

## Data shape summary (for the implementation plan)

```
departments: Array<{ name: string, headcount: number, male: number, female: number }>
  — computed live from localEmployees.list(), replaces HR_DEPARTMENTS

attendanceTrend: { months: string[6], present: number[6], absent: number[6], leave: number[6] }
  — computed live from localAttendance.listMonthlySummaries(), replaces HR_ATTENDANCE_MONTHS/HR_ATTENDANCE

totalMonthlyPayroll: number
  — computed live from localEmployees, replaces HR_PAYROLL_MONTHS/HR_PAYROLL_TOTALS + PayrollBar

(removed): HR_EMPLOYMENT_TYPES, HR_EMPLOYMENT_COLORS, EmploymentDonut
```
