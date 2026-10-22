# Add HR Expense Form Enhancements — Design Spec

**Date:** 2026-07-04
**Module:** EMS Global HR Pool (`hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`)
**Status:** Approved by user (confirmed the dropdown, project checklist, and added the HR Revenue total requirement in Section 4 below). Sequencing: CSV import (see Non-goals) happens first as a separate task, then this spec's Sections 1–4 are implemented via a plan.

## Background

`GlobalHRPoolPage.jsx` has an "Add New HR Expense" form (`adding` state) that captures Vendor, Category/Description, Frequency, Yearly Price/Monthly Cut, and a Revenue Source split (HR Revenue vs. Project Pool). When the Project Pool source is used, `localOrgPool.computeAllocations('hr', poolAmt)` (in `localOrgPool.js`) spreads the pool portion across **every** currently-active-in-pool project (`getActiveProjectMonthlyBudgets('hr')`), weighted by each project's monthly HR budget share — there is no way today to exclude a project from one specific expense.

Separately, General Expenses (`localGeneralExpenses.js`) already has an established "HR division" concept: `DivisionsSummary.jsx` hardcodes `HR_CATEGORY_IDS = new Set(['cat-00000000-0012'])`, the "Outsourced Services" category (seeded with Housekeeping Salary, My City Salary, Security Salary). This is the natural source for the new "Expense" dropdown — no new category/division field is needed.

The user asked for three additions to the Add HR Expense form:
1. An optional **Bill No** field.
2. An **Expense** dropdown sourced from General Expenses' HR division, to fill the form instead of typing Vendor/Category from scratch.
3. A **project checklist** (check/uncheck) so a given expense can be allocated to a subset of active projects instead of always all of them.

## Non-goals (explicitly out of scope for this spec)

- Importing `docs/hr and admin expenses - Sheet1.csv` into General Expenses — separate, simpler follow-on task, not a design-level change.
- Adding Bill No to the **Edit** expense form — only the Add form was requested. Editing an expense that already has a `bill_no` preserves it (via the existing `{...exp}` spread into `editForm`); there is just no UI to change it yet.
- Permanently linking an HR Pool expense to its source General Expense record. Picking from the dropdown copies values in at add-time only; the two records are independent afterward, same as if you'd typed them by hand.

## Section 1 — Bill No field

- Add `bill_no: ''` to the Add form's state (`GlobalHRPoolPage.jsx`, the `form` `useState` around line 614) and to `resetAddForm()`.
- Render a new `CFormInput` (placeholder `Bill No (optional)`, no `required`) in the form.
- Pass `bill_no: form.bill_no` through in `handleAdd()`'s call to `localOrgPool.addHRExpense(...)`.
- In `localOrgPool.addHRExpense(expense, enteredByProjectId)`, add `bill_no: expense.bill_no || ''` to the `newExp` object it builds and persists.
- Display it in the expense list row (next to the date/notes line) only when present, e.g. `· Bill #{exp.bill_no}`.

## Section 2 — Expense dropdown sourced from General Expenses (HR division)

- `GlobalHRPoolPage.jsx` imports `localGeneralExpenses` from `../../../services/localGeneralExpenses`.
- New constant `HR_DIVISION_CATEGORY_ID = 'cat-00000000-0012'` (matches `DivisionsSummary.jsx`'s `HR_CATEGORY_IDS` — same Outsourced Services category).
- On mount (alongside the existing `reload()`), fetch `localGeneralExpenses.expenses.list({ category_id: HR_DIVISION_CATEGORY_ID, page_size: 500 }).items` into a new state, `hrGeneralExpenses`.
- Render a `CFormSelect` labeled "Expense" as the **first** field in the Add form, above the existing Vendor/Category row:
  - Options: `— Select an expense (optional) —` plus one `<option>` per `hrGeneralExpenses` item, value = `id`, label = `expense_name`.
- `onChange` handler (`handleExpensePick`):
  - Look up the selected record from `hrGeneralExpenses`.
  - Set `form.label` ← `expense_name`.
  - Set `form.amount` (Monthly Cut) ← `actual_amount > 0 ? actual_amount : planned_amount`, and re-derive `form.yearly_price` ← `amount * 12` (reuse the existing `handleMonthlyCutChange` math so the yearly/monthly fields stay consistent).
  - Set `form.vendor` ← best-effort extraction from `remarks` via `/^Vendor:\s*(.+)$/i`; empty string if no match (seed data uses this `Vendor: X` convention, e.g. `_makeExp`'s remarks in `localGeneralExpenses.js`).
  - All three fields (Vendor, Category/Description, Monthly Cut) remain plain editable inputs afterward — picking from the dropdown is a starting point, not a lock.
- Selecting the placeholder option is a no-op (does not clear already-typed values).

## Section 3 — Project checklist for allocation

**Problem today:** `computeAllocations(pool, amount)` always uses *every* budget returned by `getActiveProjectMonthlyBudgets(pool)`. There's no parameter to restrict which projects participate.

**Change to `localOrgPool.js`:**

```js
computeAllocations(pool, amount, allowedProjectIds) {
  let budgets = this.getActiveProjectMonthlyBudgets(pool)
  if (allowedProjectIds) {
    budgets = budgets.filter((b) => allowedProjectIds.includes(b.projectId))
  }
  const total = budgets.reduce((s, b) => s + b.monthlyBudget, 0)
  return budgets.map((b) => {
    const sharePct = total > 0 ? Math.round((b.monthlyBudget / total) * 10000) / 100 : 0
    return {
      projectId: b.projectId,
      projectName: b.projectName,
      installmentId: b.installmentId,
      sharePct,
      amountCharged: Math.round(amount * (sharePct / 100) * 100) / 100,
    }
  })
}
```

When `allowedProjectIds` is omitted (every other call site: `addCoreExpense`, `updateHRExpense`, `updateCoreExpense`), `total` is computed over the same full budget set as before, so `sharePct` values are numerically identical to today — this is a strictly additive, backward-compatible change.

**Change to `GlobalHRPoolPage.jsx`:**

- New state: `const [selectedProjectIds, setSelectedProjectIds] = useState([])`.
- In `reload()`, after `setActiveProjects(ap)`, add `setSelectedProjectIds(ap.map((p) => p.projectId))` — default is **all active projects checked**, matching current behavior exactly until the user unchecks something.
- In `resetAddForm()`, reset `selectedProjectIds` back to `activeProjects.map((p) => p.projectId)`.
- The live-preview `useEffect` (currently calling `localOrgPool.computeAllocations('hr', poolAmt)`) becomes `localOrgPool.computeAllocations('hr', poolAmt, selectedProjectIds)`, with `selectedProjectIds` added to its dependency array.
- `handleAdd()`'s allocations-to-save line (`localOrgPool.addHRExpense(..., project_allocations: allocsToSave...)`) needs no change — `previewAllocs`/`customAllocs` already flow from the filtered computation.
- New UI: a checklist card, rendered when `hasPool` is true, placed between the Budget Cap Alert and the Allocation Preview block. One row per `activeProjects` entry: a checkbox (`checked={selectedProjectIds.includes(p.projectId)}`) plus the project name. Toggling adds/removes the id from `selectedProjectIds`.
- **Validation:** if `hasPool` is true and `selectedProjectIds.length === 0`, show an inline warning ("Select at least one project, or remove Project Pool as a revenue source") and add this condition to the existing `disabled` expression on the "Add & Distribute Expense" button.

## Section 4 — HR Revenue total display (with draw-down)

**Source of truth:** there is already a live "HR Revenue" total computed elsewhere in the app — `RevenuePage.jsx`:
```js
const recruitmentRevenue = localRecruitments.list({ activity_type: 'recruitment' })
  .reduce((s, r) => s + (r.amount_received || 0), 0)
const trainingRevenue = localRecruitments.list({ activity_type: 'training' })
  .reduce((s, r) => s + (r.amount_received || 0), 0)
const internshipRevenue = localInternships.list()
  .reduce((s, r) => s + (r.amount_received || 0), 0)
const hrRevenueTotal = recruitmentRevenue + trainingRevenue + internshipRevenue
```
This is the real figure — `localOrgPool.getHRRevenueBalance()` (reads `pool.hr_revenue_balance`) is an unused stub that nothing ever writes to, and is **not** used for this feature.

**Change to `GlobalHRPoolPage.jsx` / `RevenueSourceSelector`:**
- Import `localRecruitments` and `localInternships`, compute `hrRevenueTotal` the same way as above (once, on mount — this figure doesn't need to be live-reactive within the form session).
- Pass `hrRevenueTotal` into `RevenueSourceSelector` as a prop.
- In the "HR Revenue" row, once the checkbox is checked, show the available total and the draw-down for this expense, e.g.:
  ```
  Available: ₹86,207   −₹10,000 this expense   →   ₹76,207 remaining
  ```
  where the deducted amount is `hrAmt` (already computed in the component as `total * (hrRevPct / 100)`) and remaining = `hrRevenueTotal - hrAmt`.
- If `hrAmt > hrRevenueTotal`, style the remaining figure as a warning (reuse the same red/warning treatment as the existing Project Pool budget-cap alert) — this is informational only, not a hard block, since HR Revenue isn't a budget-capped pool like the project pool is.

## Data shape summary (for the implementation plan)

`localOrgPool.addHRExpense` persisted record gains one field:
```
{ ...existing fields..., bill_no: string }
```

`GlobalHRPoolPage` Add-form state gains two fields:
```
form: { ...existing, bill_no: '' }
selectedProjectIds: string[]  // subset of activeProjects[].projectId
```

No changes to `localGeneralExpenses.js` — Section 2 only reads from it.
