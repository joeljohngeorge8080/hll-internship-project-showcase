# Add HR Expense Form Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bill No field, an Expense-picker dropdown (sourced from General Expenses' HR division), a per-project allocation checklist, and an HR Revenue draw-down display to the "Add New HR Expense" form in the Global HR Pool page.

**Architecture:** All UI changes live in one file, `GlobalHRPoolPage.jsx` (a single-page component with local `useState`). One shared-service function, `localOrgPool.computeAllocations`, gains a backward-compatible third parameter. No new files, no new backend/service modules, no data-model migrations.

**Tech Stack:** React 19 + CoreUI React 5.x (`@coreui/react`), Vite 8, localStorage-backed service modules (no backend yet — see `docs/CLAUDE.md`).

## Global Constraints

- Frontend working directory for all commands below: `hma-template/emsv1/` (cd there first).
- No semicolons, single quotes, 2-space indent — this repo uses Prettier via ESLint; run `npx eslint --fix <file>` after every edit, then `npx eslint <file>` must report zero errors.
- **This repo has no test runner** (`grep -i jest\|vitest package.json` → nothing; no `*.test.js` files exist). Per-task verification is therefore: (1) `npx eslint <file>` clean, (2) `npx vite build` succeeds, and (3) for anything user-visible, a manual browser check via the Playwright MCP tools. Do not introduce a test framework as part of this plan — that would be an unrelated architectural change.
- Manual browser QA login: navigate to the dev server root, click the **"Dev HR"** quick-login button on the login page (grants the HR role, which the RBAC table in `docs/CLAUDE.md` lists as Edit-access for HR Pool / General Expenses), then navigate to `/#/ems/hr-pool/global` (HashRouter — note the `#`).
- Spec: `docs/superpowers/specs/2026-07-04-hr-pool-add-expense-enhancements-design.md` — every section of that spec maps to exactly one task below (Section 1→Task 2, Section 2→Task 3, Section 3→Tasks 1+4, Section 4→Task 5).

---

### Task 1: `localOrgPool.computeAllocations` accepts an optional project filter

**Files:**
- Modify: `hma-template/emsv1/src/services/localOrgPool.js:496-505`

**Interfaces:**
- Produces: `computeAllocations(pool: 'hr'|'core', amount: number, allowedProjectIds?: string[]) => Array<{ projectId, projectName, installmentId, sharePct, amountCharged }>` — the third parameter is new and optional; all four existing call sites (`addCoreExpense`, `updateHRExpense`, `updateCoreExpense`, and `GlobalHRPoolPage.jsx`'s live-preview effect) keep compiling unchanged.

- [ ] **Step 1: Read the current implementation to confirm line numbers haven't shifted**

Run: `sed -n '490,510p' hma-template/emsv1/src/services/localOrgPool.js`

Expected output (current code):
```js
  computeAllocations(pool, amount) {
    const budgets = this.getActiveProjectMonthlyBudgets(pool)
    return budgets.map((b) => ({
      projectId: b.projectId,
      projectName: b.projectName,
      installmentId: b.installmentId,
      sharePct: b.sharePct,
      amountCharged: Math.round(amount * (b.sharePct / 100) * 100) / 100,
    }))
  },
```

- [ ] **Step 2: Replace it with the filtered version**

Replace that exact block with:
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
  },
```

- [ ] **Step 3: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint src/services/localOrgPool.js`
Expected: no output (clean).

Run: `npx vite build`
Expected: `✓ built in` with no errors (warnings about chunk size are pre-existing and fine).

- [ ] **Step 4: Verify the math is unchanged for the no-filter case and correct for the filtered case**

This repo has no test runner, so verify with a throwaway browser check instead of a unit test — `computeAllocations` is exercised for real in Task 4's manual QA once the checklist UI calls it with a real subset. For now, confirm by inspection: when `allowedProjectIds` is `undefined`, `budgets` is the full array from `getActiveProjectMonthlyBudgets(pool)` and `total` sums the same `monthlyBudget` values that function already used internally to produce `b.sharePct` — so the recomputed `sharePct` here is numerically identical to the old `b.sharePct`. Confirm this by re-reading `getActiveProjectMonthlyBudgets` (`localOrgPool.js:250-254`): `sharePct: total > 0 ? Math.round((b.monthlyBudget / total) * 10000) / 100 : 0` — same formula, same `total` (sum of the same full `budgets` array). Note this confirmation in your task summary.

- [ ] **Step 5: Commit**

```bash
git add hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: allow computeAllocations to restrict allocation to a project subset"
```

---

### Task 2: Bill No field on the Add HR Expense form

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
- Modify: `hma-template/emsv1/src/services/localOrgPool.js` (`addHRExpense`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `form.bill_no: string` in `GlobalHRPoolPage`'s Add-form state; `addHRExpense`'s persisted record gains `bill_no: string`.

- [ ] **Step 1: Add `bill_no` to the Add form's initial state**

In `GlobalHRPoolPage.jsx`, find (around line 614):
```js
  const [form, setForm] = useState({
    vendor: '',
    label: '',
    frequency: 'Monthly',
    yearly_price: '',
    amount: '',
    expenseMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    notes: '',
  })
```
Replace with:
```js
  const [form, setForm] = useState({
    vendor: '',
    label: '',
    frequency: 'Monthly',
    yearly_price: '',
    amount: '',
    expenseMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    notes: '',
    bill_no: '',
  })
```

- [ ] **Step 2: Reset it in `resetAddForm`**

Find (around line 654):
```js
  const resetAddForm = () => {
    setForm({
      vendor: '', label: '', frequency: 'Monthly', yearly_price: '', amount: '',
      expenseMonth: new Date().toISOString().slice(0, 7),
      notes: '',
    })
```
Replace with:
```js
  const resetAddForm = () => {
    setForm({
      vendor: '', label: '', frequency: 'Monthly', yearly_price: '', amount: '',
      expenseMonth: new Date().toISOString().slice(0, 7),
      notes: '',
      bill_no: '',
    })
```

- [ ] **Step 3: Add the input field, right after the existing 5-column `CRow`**

Find the closing of the first form `CRow` (around line 956):
```js
                <CCol xs={6} md={2}>
                  <CInputGroup size="sm">
                    <CInputGroupText>₹</CInputGroupText>
                    <CFormInput
                      type="number"
                      min="0"
                      placeholder="Monthly Cut *"
                      value={form.amount}
                      onChange={(e) => handleMonthlyCutChange(e.target.value, false)}
                    />
                  </CInputGroup>
                </CCol>
              </CRow>
```
Replace the closing `</CRow>` line with a new row right after it:
```js
                <CCol xs={6} md={2}>
                  <CInputGroup size="sm">
                    <CInputGroupText>₹</CInputGroupText>
                    <CFormInput
                      type="number"
                      min="0"
                      placeholder="Monthly Cut *"
                      value={form.amount}
                      onChange={(e) => handleMonthlyCutChange(e.target.value, false)}
                    />
                  </CInputGroup>
                </CCol>
              </CRow>

              <CRow className="g-2 mb-2">
                <CCol xs={12} md={4}>
                  <CFormInput
                    size="sm"
                    placeholder="Bill No (optional)"
                    value={form.bill_no}
                    onChange={(e) => setForm((f) => ({ ...f, bill_no: e.target.value }))}
                  />
                </CCol>
              </CRow>
```

- [ ] **Step 4: Pass it through on save**

Find in `handleAdd` (around line 794):
```js
    localOrgPool.addHRExpense(
      {
        ...form,
        date: form.expenseMonth, // store as YYYY-MM for month-based filtering
        revenue_sources: revSources,
        hr_revenue_pct: hrRevPct,
        project_pool_pct: projPoolPct,
        project_allocations: allocsToSave.length > 0 ? allocsToSave : undefined,
      },
      'global',
    )
```
`{...form}` already spreads `bill_no` — no change needed here. Confirm this by reading the block; do not edit it.

- [ ] **Step 5: Persist `bill_no` in `localOrgPool.addHRExpense`**

In `localOrgPool.js`, find (around line 594):
```js
    const newExp = {
      id: uid(),
      label: expense.label || '',
      vendor: expense.vendor || '',
      frequency: expense.frequency || 'Monthly',
      yearly_price: parseFloat(expense.yearly_price) || 0,
      amount: totalAmt,
      date: expense.date || '',
      notes: expense.notes || '',
      entered_by_project_id: enteredByProjectId,
```
Replace with:
```js
    const newExp = {
      id: uid(),
      label: expense.label || '',
      vendor: expense.vendor || '',
      frequency: expense.frequency || 'Monthly',
      yearly_price: parseFloat(expense.yearly_price) || 0,
      amount: totalAmt,
      date: expense.date || '',
      notes: expense.notes || '',
      bill_no: expense.bill_no || '',
      entered_by_project_id: enteredByProjectId,
```

- [ ] **Step 6: Show it in the expense list row**

Find (around line 1291):
```js
                      <div className="text-body-secondary small mb-1">
                        {fmtDate(exp.date)} {exp.notes && ` · ${exp.notes}`}
                      </div>
```
Replace with:
```js
                      <div className="text-body-secondary small mb-1">
                        {fmtDate(exp.date)} {exp.notes && ` · ${exp.notes}`}
                        {exp.bill_no && ` · Bill #${exp.bill_no}`}
                      </div>
```

- [ ] **Step 7: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/hr-pool/GlobalHRPoolPage.jsx src/services/localOrgPool.js && npx eslint src/modules/ems/hr-pool/GlobalHRPoolPage.jsx src/services/localOrgPool.js`
Expected: no output.

Run: `npx vite build`
Expected: succeeds.

- [ ] **Step 8: Manual browser check**

Using the Playwright MCP tools:
1. `browser_navigate` to the dev server root (start it first with `npm start` if not already running; note the printed port).
2. Click the "Dev HR" quick-login button.
3. `browser_navigate` to `.../#/ems/hr-pool/global`.
4. Click "Add New HR Expense".
5. `browser_snapshot` — confirm a "Bill No (optional)" text input is visible.
6. Type a value into it, fill Category/Description and Monthly Cut with any values, click "Add & Distribute Expense".
7. `browser_snapshot` — confirm the new list row shows `· Bill #<value>` you typed.

- [ ] **Step 9: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx hma-template/emsv1/src/services/localOrgPool.js
git commit -m "feat: add optional Bill No field to Add HR Expense form"
```

---

### Task 3: Expense dropdown sourced from General Expenses (HR division)

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`

**Interfaces:**
- Consumes: `localGeneralExpenses.expenses.list({ category_id, page_size })` from `hma-template/emsv1/src/services/localGeneralExpenses.js` (existing, unchanged — returns `{ items, total, total_pages, page }` where each item has `id, expense_name, planned_amount, actual_amount, remarks`).
- Produces: `hrGeneralExpenses` state (array of those items) and `handleExpensePick(id)`, used only within this file.

- [ ] **Step 1: Import `localGeneralExpenses` and add the category constant**

Find the top of `GlobalHRPoolPage.jsx`:
```js
import { localOrgPool } from '../../../services/localOrgPool'
```
Replace with:
```js
import { localOrgPool } from '../../../services/localOrgPool'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'

// Outsourced Services — same category DivisionsSummary.jsx treats as the HR division.
const HR_DIVISION_CATEGORY_ID = 'cat-00000000-0012'
```

- [ ] **Step 2: Add `hrGeneralExpenses` state and load it in `reload()`**

Find (around line 631):
```js
  const [allExpenses, setAllExpenses] = useState([])
```
Replace with:
```js
  const [allExpenses, setAllExpenses] = useState([])
  const [hrGeneralExpenses, setHrGeneralExpenses] = useState([])
```

Find `reload`'s body (around line 641):
```js
  const reload = () => {
    setAllExpenses(localOrgPool.getHRExpenses())
```
Replace with:
```js
  const reload = () => {
    setAllExpenses(localOrgPool.getHRExpenses())
    setHrGeneralExpenses(
      localGeneralExpenses.expenses.list({
        category_id: HR_DIVISION_CATEGORY_ID,
        page_size: 500,
      }).items,
    )
```

- [ ] **Step 3: Add the pick handler**

Add this function right after `resetAddForm` (around line 666, after its closing `}`):
```js
  const handleExpensePick = (expenseId) => {
    if (!expenseId) return
    const picked = hrGeneralExpenses.find((e) => e.id === expenseId)
    if (!picked) return
    const amt = picked.actual_amount > 0 ? picked.actual_amount : picked.planned_amount
    const vendorMatch = /^Vendor:\s*(.+)$/i.exec(picked.remarks || '')
    setForm((f) => ({
      ...f,
      label: picked.expense_name,
      amount: String(amt),
      yearly_price: amt ? String(Math.round(amt * 12 * 100) / 100) : '',
      vendor: vendorMatch ? vendorMatch[1] : f.vendor,
    }))
  }
```

- [ ] **Step 4: Render the dropdown as the first row of the Add form**

Find the start of the Add form body (around line 903):
```js
              <CRow className="g-2 mb-2">
                <CCol xs={12} md={3}>
                  <CFormInput
                    size="sm"
                    placeholder="Vendor / Payee *"
```
Insert a new row immediately before it:
```js
              <CRow className="g-2 mb-2">
                <CCol xs={12} md={6}>
                  <CFormSelect
                    size="sm"
                    onChange={(e) => handleExpensePick(e.target.value)}
                    defaultValue=""
                  >
                    <option value="">— Select an expense (optional) —</option>
                    {hrGeneralExpenses.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.expense_name}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>
              <CRow className="g-2 mb-2">
                <CCol xs={12} md={3}>
                  <CFormInput
                    size="sm"
                    placeholder="Vendor / Payee *"
```

- [ ] **Step 5: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/hr-pool/GlobalHRPoolPage.jsx && npx eslint src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: no output.

Run: `npx vite build`
Expected: succeeds.

- [ ] **Step 6: Manual browser check**

1. `browser_navigate` to the dev server, dev-login as HR, navigate to `.../#/ems/hr-pool/global`, click "Add New HR Expense".
2. `browser_snapshot` — confirm an "Expense" dropdown is visible above Vendor/Category, listing entries such as "Housekeeping Salary", "My City Salary", "Security Salary" (seeded HR-division General Expenses).
3. Select "Housekeeping Salary".
4. `browser_snapshot` — confirm Category/Description now reads "Housekeeping Salary" and Monthly Cut is populated with a non-zero value.
5. Manually edit the Monthly Cut value — confirm it's still a plain editable input (not locked).

- [ ] **Step 7: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "feat: add Expense dropdown sourced from General Expenses HR division"
```

---

### Task 4: Project checklist for allocation

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`

**Interfaces:**
- Consumes: `localOrgPool.computeAllocations(pool, amount, allowedProjectIds)` from Task 1.
- Produces: `selectedProjectIds: string[]` state, used only within this file.

- [ ] **Step 1: Add `selectedProjectIds` state**

Find (around line 635):
```js
  const [activeProjects, setActiveProjects] = useState([])
```
Replace with:
```js
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProjectIds, setSelectedProjectIds] = useState([])
```

- [ ] **Step 2: Default it to "all active projects" in `reload()`**

Find (around line 643):
```js
    const ap = localOrgPool.getActiveProjectMonthlyBudgets('hr')
    setActiveProjects(ap)
    setSelectedProjectId((prev) => prev || (ap[0]?.projectId ?? ''))
```
Replace with:
```js
    const ap = localOrgPool.getActiveProjectMonthlyBudgets('hr')
    setActiveProjects(ap)
    setSelectedProjectId((prev) => prev || (ap[0]?.projectId ?? ''))
    setSelectedProjectIds(ap.map((p) => p.projectId))
```

- [ ] **Step 3: Reset it in `resetAddForm`**

Find (around line 663, inside `resetAddForm`, after the fields already reset in Task 2's Step 2):
```js
    setPreviewAllocs([])
    setCustomAllocs(null)
    setDraftAmounts({})
  }
```
Replace with:
```js
    setPreviewAllocs([])
    setCustomAllocs(null)
    setDraftAmounts({})
    setSelectedProjectIds(activeProjects.map((p) => p.projectId))
  }
```

- [ ] **Step 4: Pass the filter into the live-preview computation**

Find the live-preview `useEffect` (around line 675):
```js
  useEffect(() => {
    const amt = parseFloat(form.amount) || 0
    const hasPool = revSources.includes('project_pool')
    if (amt > 0 && hasPool) {
      const poolAmt = Math.round(amt * (projPoolPct / 100) * 100) / 100
      const computed = localOrgPool.computeAllocations('hr', poolAmt)
      setPreviewAllocs(computed)
      setCustomAllocs(null) // reset custom overrides when base changes
      setDraftAmounts({})  // clear drafts when base recalculates
    } else {
      setPreviewAllocs([])
      setCustomAllocs(null)
      setDraftAmounts({})
    }
  }, [form.amount, projPoolPct, revSources])
```
Replace with:
```js
  useEffect(() => {
    const amt = parseFloat(form.amount) || 0
    const hasPool = revSources.includes('project_pool')
    if (amt > 0 && hasPool) {
      const poolAmt = Math.round(amt * (projPoolPct / 100) * 100) / 100
      const computed = localOrgPool.computeAllocations('hr', poolAmt, selectedProjectIds)
      setPreviewAllocs(computed)
      setCustomAllocs(null) // reset custom overrides when base changes
      setDraftAmounts({})  // clear drafts when base recalculates
    } else {
      setPreviewAllocs([])
      setCustomAllocs(null)
      setDraftAmounts({})
    }
  }, [form.amount, projPoolPct, revSources, selectedProjectIds])
```

- [ ] **Step 5: Add the toggle handler**

Add right after the `handleExpensePick` function added in Task 3 (or, if Task 3 wasn't done first, right after `resetAddForm`):
```js
  const toggleSelectedProject = (projectId) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }
```

- [ ] **Step 6: Render the checklist**

Find the Budget Cap Alert block's closing and the Allocation Preview block's opening (around line 1017-1020):
```js
              })()}

              {/* ── Allocation Preview (editable) ── */}
              {hasPool && displayAllocs.length > 0 && (
```
Insert the checklist between them:
```js
              })()}

              {/* ── Project Checklist — choose which active projects this expense applies to ── */}
              {hasPool && (
                <div className="mb-3 p-3 rounded border" style={{ fontSize: '0.85rem' }}>
                  <div className="fw-semibold mb-2" style={{ fontSize: '0.82rem' }}>
                    Apply to Projects
                  </div>
                  {activeProjects.length === 0 ? (
                    <div className="text-body-secondary small">No active projects in the pool.</div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {activeProjects.map((p) => (
                        <div key={p.projectId} className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            id={`proj-chk-${p.projectId}`}
                            checked={selectedProjectIds.includes(p.projectId)}
                            onChange={() => toggleSelectedProject(p.projectId)}
                            style={{ width: 15, height: 15, cursor: 'pointer' }}
                          />
                          <label
                            htmlFor={`proj-chk-${p.projectId}`}
                            className="mb-0"
                            style={{ cursor: 'pointer' }}
                          >
                            {p.projectName}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeProjects.length > 0 && selectedProjectIds.length === 0 && (
                    <div className="text-danger small mt-2">
                      Select at least one project, or remove Project Pool as a revenue source.
                    </div>
                  )}
                </div>
              )}

              {/* ── Allocation Preview (editable) ── */}
              {hasPool && displayAllocs.length > 0 && (
```

- [ ] **Step 7: Block Add when Project Pool is active but nothing is selected**

Find the Add button's `disabled` expression (around line 1188):
```js
                  disabled={!form.label || !form.amount || !isSplitValid() || (
                    displayAllocs.length > 0 &&
                    Math.abs(displayAllocs.reduce((s, a) => s + a.sharePct, 0) - 100) > 0.5
                  ) || (() => {
```
Replace with:
```js
                  disabled={!form.label || !form.amount || !isSplitValid() ||
                    (hasPool && activeProjects.length > 0 && selectedProjectIds.length === 0) || (
                    displayAllocs.length > 0 &&
                    Math.abs(displayAllocs.reduce((s, a) => s + a.sharePct, 0) - 100) > 0.5
                  ) || (() => {
```

- [ ] **Step 8: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/hr-pool/GlobalHRPoolPage.jsx && npx eslint src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: no output.

Run: `npx vite build`
Expected: succeeds.

- [ ] **Step 9: Manual browser check — this is the real end-to-end test of Task 1's math**

Requires at least two active-in-pool projects to be meaningful. If the seeded data doesn't have two, note this in your task summary and test with whatever active projects exist (even one project still confirms unchecking removes it entirely and re-checking restores it):
1. Dev-login as HR, navigate to `.../#/ems/hr-pool/global`, click "Add New HR Expense".
2. Enter a Monthly Cut amount (e.g. `10000`), leave Project Pool as a revenue source.
3. `browser_snapshot` — confirm the "Apply to Projects" checklist appears with all active projects checked, and confirm the Allocation Preview total is 100%.
4. Uncheck one project.
5. `browser_snapshot` — confirm that project disappears from the Allocation Preview and the remaining projects' percentages sum back to 100%.
6. Uncheck all projects — confirm the danger message appears and "Add & Distribute Expense" becomes disabled.
7. Re-check one project — confirm the button re-enables.

- [ ] **Step 10: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "feat: add per-project checklist to control HR expense allocation"
```

---

### Task 5: HR Revenue total display with draw-down

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`

**Interfaces:**
- Consumes: `localRecruitments.list({ activity_type })` from `hma-template/emsv1/src/services/localRecruitments.js` and `localInternships.list()` from `hma-template/emsv1/src/services/localInternships.js` (both existing, unchanged; each item has `amount_received: number`).
- Produces: `hrRevenueTotal` prop passed into `RevenueSourceSelector`.

- [ ] **Step 1: Import the two services**

Find the import added in Task 3:
```js
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
```
Add two more lines after it:
```js
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
```
(If Task 3 was skipped, add all three imports after the existing `localOrgPool` import instead.)

- [ ] **Step 2: Compute `hrRevenueTotal` once, near the top of the component**

Find the start of the `GlobalHRPoolPage` component body (around line 613):
```js
const GlobalHRPoolPage = () => {
  const [form, setForm] = useState({
```
Replace with:
```js
const GlobalHRPoolPage = () => {
  const hrRevenueTotal = (() => {
    const recruitmentRevenue = localRecruitments
      .list({ activity_type: 'recruitment' })
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const trainingRevenue = localRecruitments
      .list({ activity_type: 'training' })
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const internshipRevenue = localInternships
      .list()
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    return recruitmentRevenue + trainingRevenue + internshipRevenue
  })()

  const [form, setForm] = useState({
```

- [ ] **Step 3: Pass it into `RevenueSourceSelector`**

Find where `RevenueSourceSelector` is rendered (around line 959):
```js
              <RevenueSourceSelector
                revSources={revSources}
                setRevSources={setRevSources}
                hrRevPct={hrRevPct}
                setHrRevPct={setHrRevPct}
                projPoolPct={projPoolPct}
                setProjPoolPct={setProjPoolPct}
                totalAmount={form.amount}
              />
```
Replace with:
```js
              <RevenueSourceSelector
                revSources={revSources}
                setRevSources={setRevSources}
                hrRevPct={hrRevPct}
                setHrRevPct={setHrRevPct}
                projPoolPct={projPoolPct}
                setProjPoolPct={setProjPoolPct}
                totalAmount={form.amount}
                hrRevenueTotal={hrRevenueTotal}
              />
```

- [ ] **Step 4: Accept the new prop and render the draw-down line**

Find the `RevenueSourceSelector` function signature (around line 410):
```js
const RevenueSourceSelector = ({
  revSources, setRevSources,
  hrRevPct, setHrRevPct,
  projPoolPct, setProjPoolPct,
  totalAmount,
}) => {
```
Replace with:
```js
const RevenueSourceSelector = ({
  revSources, setRevSources,
  hrRevPct, setHrRevPct,
  projPoolPct, setProjPoolPct,
  totalAmount,
  hrRevenueTotal,
}) => {
```

Find this exact block (around lines 533-539) — the end of the HR Revenue row's inner flex `<div>` immediately followed by the outer `<div style={rowStyle}>`'s own closing `</div>`:
```js
            {hasHR && !bothSelected && total > 0 && (
              <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
                100% — {fmt(total)}
              </span>
            )}
          </div>
        </div>
```
Replace with:
```js
            {hasHR && !bothSelected && total > 0 && (
              <span className="text-body-secondary ms-auto" style={{ fontSize: '0.78rem' }}>
                100% — {fmt(total)}
              </span>
            )}
          </div>
          {hasHR &&
            (() => {
              const drawn = bothSelected ? hrAmt : total
              const remaining = (hrRevenueTotal || 0) - drawn
              const isOver = remaining < 0
              return (
                <div
                  className={`small mt-1 ${isOver ? 'text-danger fw-semibold' : 'text-body-secondary'}`}
                  style={{ fontSize: '0.74rem' }}
                >
                  Available: {fmt(hrRevenueTotal || 0)} &nbsp;−{fmt(drawn)} this expense &nbsp;→&nbsp;
                  {fmt(remaining)} remaining
                </div>
              )
            })()}
        </div>
```
The inner flex `<div>` still closes exactly where it did before (line with just `</div>`); the new draw-down block is added as its sibling, still inside the outer `rowStyle` div, which then closes exactly where it did before (the final `</div>` in this snippet). No other JSX in the file changes shape.

- [ ] **Step 5: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/hr-pool/GlobalHRPoolPage.jsx && npx eslint src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`
Expected: no output. If JSX balance broke in Step 4, ESLint/the Vite build will fail loudly with a parse error pointing at the line — fix the extra/missing `</div>` there.

Run: `npx vite build`
Expected: succeeds.

- [ ] **Step 6: Manual browser check**

1. Dev-login as HR, navigate to `.../#/ems/hr-pool/global`, click "Add New HR Expense".
2. Enter a Monthly Cut amount.
3. In the Revenue Source section, check "HR Revenue" (leave "Project Pool" unchecked, or check both — either way `hasHR` is true).
4. `browser_snapshot` — confirm a line reading `Available: ₹<total> −₹<amount> this expense → ₹<remaining> remaining` appears under the HR Revenue row.
5. Increase the Monthly Cut to something larger than the available total — confirm the line turns red/bold (over-drawn state) but the Add button is **not** disabled by this alone (informational only, per spec Section 4).

- [ ] **Step 7: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx
git commit -m "feat: show live HR Revenue total and draw-down in Add HR Expense form"
```
