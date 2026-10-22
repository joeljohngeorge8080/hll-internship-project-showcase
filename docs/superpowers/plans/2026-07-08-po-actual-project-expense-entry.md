# PO Self-Service Actual Project Expense Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Project Officer log actual Project-pool spend against the planned monthly amount, directly in the PMS Expense tab, replacing the Tasks card with a plain three-field entry (Date, Description, Amount) — no badges, no color-coded variance, no multi-step flow.

**Architecture:** One new `pool: 'project'` value on the existing `localProjectExpenses` localStorage service (already generic over pool/month/amount/label). One new small React component (`ActualExpenseCard`) inside `MonthlyPlanPanel.jsx`, swapped into the slot the Tasks card currently occupies inside `ExpensePanel`. One small read-wiring change in the existing `ActualSpendPanel` table to stop hardcoding "not yet tracked" for the Project column.

**Tech Stack:** React 19 (function components + hooks), CoreUI React components (`@coreui/react`), plain `localStorage`-backed services (no backend, no DB). No test runner is configured in this repo (`package.json` has no test script, no Jest/Vitest/RTL dependency) — verification is `npm run build` + `npm run lint` (this repo's existing convention, confirmed in `docs/handoff.md`'s "Verified this session" section) plus a manual browser check via the dev server, not automated unit tests.

## Global Constraints

- Scope is the **Project pool only** — do not touch Admin/HR/Core entry flows (those stay HR-via-EMS, unchanged).
- The new entry card must be **plain**: no emoji in its own header, no badges, no color-coded variance, no icons-in-circles, no modal/confirmation step. One plain summary line (`Planned ₹X · Logged ₹Y · Remaining ₹Z`), a plain list, one plain add-row.
- Straight swap: the Tasks card is **removed** from `ExpensePanel`, not kept alongside.
- `canEdit` gates add/delete controls, exactly like the rest of `ExpensePanel` (Send/Revoke already follow this pattern).
- Follow this file's existing conventions: `fmt()` for currency, `CCard`/`CCardHeader`/`CCardBody` structure, `size="sm"` on all form controls inside these compact cards.

---

## File Structure

- **Modify:** `src/services/localProjectExpenses.js` — add `'project'` to `VALID_POOLS`; add an optional `date` field to `create()` (the row shape currently has no user-facing date, only the audit `createdAt` timestamp — the new card needs a real "date of expense" field, matching the `date`/`fmtDate` pattern already used by the project-specific `ExpenseCard` in `ProjectDetailPage.jsx`).
- **Modify:** `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` — new `ActualExpenseCard` component; `ExpensePanel` swaps it in for the Tasks card; `ActualSpendPanel`'s Project column reads real data instead of a hardcoded string. Remove the now-unused `TASK_STATUS_COLORS` constant.

No other files change. `ProjectDetailPage.jsx` (the page that renders `ExpensePanel`) needs no changes — it already passes `project`, `onProjectChange`, `canEdit`, `currentUser` straight through.

---

## Task 1: Extend `localProjectExpenses` to support the `project` pool and a per-entry date

**Files:**
- Modify: `src/services/localProjectExpenses.js`

**Interfaces:**
- Produces: `localProjectExpenses.create({ project_id, pool: 'project', month, amount, label, createdBy, date })` — `date` is optional (`'YYYY-MM-DD'` string); when omitted, defaults to today. Existing callers (`pool: 'admin'|'hr'|'core'`, no `date` arg) are unaffected — they simply get today's date stamped on a field they don't read.
- Produces: `localProjectExpenses.list({ projectId, pool: 'project', month })` — unchanged signature, now also returns rows where `pool === 'project'`.

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Run: `sed -n '1,30p' src/services/localProjectExpenses.js`
Expected output (confirms the exact text this task edits):
```js
/**
 * Local store for per-project actual expense entries. Distinct from
 * localAdminExpenses.js (the org-wide vendor-contract ledger) — these
 * entries are tied to one specific project via project_id, and feed the
 * PMS "Actual Spend" section and the Budget & Payroll Admin Expenses card.
 * Only pool: 'admin' is exposed in the UI so far; 'hr'/'core' are accepted
 * by the shape as a provision for later.
 */

const KEY = 'hma_project_expenses'
...
const VALID_POOLS = ['admin', 'hr', 'core']
```

- [ ] **Step 2: Update the header comment and `VALID_POOLS`**

Change:
```js
/**
 * Local store for per-project actual expense entries. Distinct from
 * localAdminExpenses.js (the org-wide vendor-contract ledger) — these
 * entries are tied to one specific project via project_id, and feed the
 * PMS "Actual Spend" section and the Budget & Payroll Admin Expenses card.
 * Only pool: 'admin' is exposed in the UI so far; 'hr'/'core' are accepted
 * by the shape as a provision for later.
 */
```
to:
```js
/**
 * Local store for per-project actual expense entries. Distinct from
 * localAdminExpenses.js (the org-wide vendor-contract ledger) — these
 * entries are tied to one specific project via project_id, and feed the
 * PMS "Actual Spend" section, the Budget & Payroll Admin Expenses card,
 * and the PO's own Actual Expense entry (pool: 'project') in the Expense
 * tab. 'hr'/'core' are accepted by the shape as a provision for later,
 * not yet exposed in any UI.
 */
```

Change:
```js
const VALID_POOLS = ['admin', 'hr', 'core']
```
to:
```js
const VALID_POOLS = ['admin', 'hr', 'core', 'project']
```

- [ ] **Step 3: Add the optional `date` field to `create()`**

Change:
```js
  create({ project_id, pool, month, amount, label, createdBy }) {
    if (!project_id) throw new Error('A project is required.')
    if (!VALID_POOLS.includes(pool)) throw new Error('Pool must be admin, hr, or core.')
    if (!month) throw new Error('A month is required.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!label || !label.trim()) throw new Error('A label is required.')

    const rows = read()
    const row = {
      id: uid(),
      project_id,
      pool,
      month,
      amount: amt,
      label: label.trim(),
      createdBy: createdBy || 'Unknown',
      createdAt: new Date().toISOString(),
    }
    write([...rows, row])
    return row
  },
```
to:
```js
  create({ project_id, pool, month, amount, label, createdBy, date }) {
    if (!project_id) throw new Error('A project is required.')
    if (!VALID_POOLS.includes(pool)) throw new Error('Pool must be admin, hr, core, or project.')
    if (!month) throw new Error('A month is required.')
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (amt <= 0) throw new Error('Amount must be greater than zero.')
    if (!label || !label.trim()) throw new Error('A label is required.')

    const rows = read()
    const row = {
      id: uid(),
      project_id,
      pool,
      month,
      amount: amt,
      label: label.trim(),
      date: date || new Date().toISOString().slice(0, 10),
      createdBy: createdBy || 'Unknown',
      createdAt: new Date().toISOString(),
    }
    write([...rows, row])
    return row
  },
```

- [ ] **Step 4: Manually verify in a browser console (no test runner in this repo)**

Run: `npm_config_prefix=/tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/6a82894c-883f-469c-b3c6-f4f14e1482a0/scratchpad/npm-global npm run build` (per `docs/handoff.md`'s noted `.npmrc` workaround for this environment)

Expected: build completes with no errors (`vite build` output ending in `✓ built in ...`).

- [ ] **Step 5: Commit**

```bash
git add src/services/localProjectExpenses.js
git commit -m "feat: support project-pool actual expense entries with a per-entry date"
```

---

## Task 2: Replace the Tasks card with `ActualExpenseCard` in `ExpensePanel`

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjectExpenses.list/create/remove` (Task 1), `computeEffectiveProjectMonthly(project, month)` (already imported in this file at the top from `../../../services/monthlyApportionment`), `fmt(n)` (already defined at the top of this file).
- Produces: `ActualExpenseCard({ projectId, month, plannedAmount, canEdit, currentUser })` — a component local to this file (not exported), used once inside `ExpensePanel`.

- [ ] **Step 1: Add `useEffect` to the React import**

Change (line 1):
```js
import React, { useState } from 'react'
```
to:
```js
import React, { useState, useEffect } from 'react'
```

- [ ] **Step 2: Remove the now-unused `TASK_STATUS_COLORS` constant**

Delete this line (currently directly above the `ExpensePanel` doc comment):
```js
const TASK_STATUS_COLORS = { active: 'primary', completed: 'success', cancelled: 'secondary' }
```

- [ ] **Step 3: Define `ActualExpenseCard`, directly above the `ExpensePanel` component**

Insert this new component immediately before the `const ExpensePanel = (...)` line:

```js
const ActualExpenseCard = ({ projectId, month, plannedAmount, canEdit, currentUser }) => {
  const [entries, setEntries] = useState(() =>
    localProjectExpenses.list({ projectId, pool: 'project', month }),
  )
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    setEntries(localProjectExpenses.list({ projectId, pool: 'project', month }))
  }, [projectId, month])

  const logged = entries.reduce((s, e) => s + (e.amount || 0), 0)
  const remaining = plannedAmount - logged
  const canAdd = desc.trim() && parseFloat(amount) > 0

  const handleAdd = () => {
    if (!canAdd) return
    localProjectExpenses.create({
      project_id: projectId,
      pool: 'project',
      month,
      amount: parseFloat(amount),
      label: desc.trim(),
      date,
      createdBy: currentUser,
    })
    setEntries(localProjectExpenses.list({ projectId, pool: 'project', month }))
    setDesc('')
    setAmount('')
  }

  const handleDelete = (id) => {
    localProjectExpenses.remove(id)
    setEntries(localProjectExpenses.list({ projectId, pool: 'project', month }))
  }

  const fmtEntryDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''

  return (
    <CCard className="h-100">
      <CCardHeader className="bg-transparent fw-semibold py-2">Actual Expense</CCardHeader>
      <CCardBody className="p-2">
        <div className="small text-body-secondary mb-2">
          Planned {fmt(plannedAmount)} · Logged {fmt(logged)} · Remaining {fmt(remaining)}
        </div>

        {entries.length === 0 ? (
          <div className="text-center text-body-tertiary small py-2">
            No expenses logged this month.
          </div>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="d-flex justify-content-between align-items-center border-bottom py-1 small"
            >
              <span>
                {fmtEntryDate(e.date)} — {e.label}
              </span>
              <span className="d-flex align-items-center gap-2">
                {fmt(e.amount)}
                {canEdit && (
                  <CButton
                    size="sm"
                    color="secondary"
                    variant="ghost"
                    style={{ padding: '0 4px' }}
                    onClick={() => handleDelete(e.id)}
                  >
                    ✕
                  </CButton>
                )}
              </span>
            </div>
          ))
        )}

        {canEdit && (
          <CRow className="g-1 mt-2 align-items-center">
            <CCol xs={4} md={3}>
              <CFormInput
                type="date"
                size="sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </CCol>
            <CCol xs={8} md={5}>
              <CFormInput
                size="sm"
                placeholder="Description"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </CCol>
            <CCol xs={8} md={3}>
              <CInputGroup size="sm">
                <CInputGroupText>₹</CInputGroupText>
                <CFormInput
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={4} md={1}>
              <CButton size="sm" color="primary" disabled={!canAdd} onClick={handleAdd}>
                Add
              </CButton>
            </CCol>
          </CRow>
        )}
      </CCardBody>
    </CCard>
  )
}

ActualExpenseCard.propTypes = {
  projectId: PropTypes.string.isRequired,
  month: PropTypes.string.isRequired,
  plannedAmount: PropTypes.number.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}
```

- [ ] **Step 4: Swap the Tasks `CCol` for `ActualExpenseCard` inside `ExpensePanel`**

Change (the first `CCol` in the `CRow className="g-3"` block inside `ExpensePanel`, currently the Tasks card):
```jsx
          <CCol xs={12} md={6}>
            <CCard className="h-100">
              <CCardHeader className="bg-transparent fw-semibold py-2">
                ✅ Tasks <CBadge color="secondary">{monthTasks.length}</CBadge>
              </CCardHeader>
              <CCardBody className="p-2">
                {monthTasks.length === 0 ? (
                  <div className="text-center text-body-tertiary small py-2">
                    No tasks due this month.
                  </div>
                ) : (
                  monthTasks.map((t) => (
                    <div
                      key={t.id}
                      className="d-flex justify-content-between align-items-start border-bottom py-1 small"
                    >
                      <div>
                        <div className="fw-medium">{t.title}</div>
                        <div className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                          {t.assignee || 'Unassigned'} · Due{' '}
                          {monthLabel((t.due_date || t.target_date || '').slice(0, 7))}
                        </div>
                      </div>
                      <CBadge color={TASK_STATUS_COLORS[t.status] || 'secondary'}>
                        {t.status}
                      </CBadge>
                    </div>
                  ))
                )}
              </CCardBody>
            </CCard>
          </CCol>
```
to:
```jsx
          <CCol xs={12} md={6}>
            <ActualExpenseCard
              projectId={project.id}
              month={month}
              plannedAmount={computeEffectiveProjectMonthly(project, month)}
              canEdit={canEdit}
              currentUser={currentUser}
            />
          </CCol>
```

`monthTasks` stays defined and used elsewhere in `ExpensePanel` (the Assignees card at line ~850 derives `assignees` from it) — do not remove its computation, only this rendering block.

- [ ] **Step 5: Verify build and lint**

Run: `npm_config_prefix=/tmp/claude-1000/-home-jojo-labs-git-lab-HMA-hma-template-emsv1/6a82894c-883f-469c-b3c6-f4f14e1482a0/scratchpad/npm-global npm run build`
Expected: clean build, no errors.

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx src/services/localProjectExpenses.js`
Expected: no new errors (this repo has a large pre-existing `react-hooks/set-state-in-effect` baseline elsewhere — confirm nothing new appears specific to these two files).

- [ ] **Step 6: Manual browser verification**

Start the dev server (`npm_config_prefix=<scratch> npm run start` or the project's `run` skill if one exists) and, logged in as a Project Officer or Project Associate on a project that already has a Monthly Plan:
1. Open the project detail page → Expense tab.
2. Confirm the Tasks card is gone and an "Actual Expense" card appears in its place, showing `Planned ₹X · Logged ₹0 · Remaining ₹X` for the selected month.
3. Enter a description and amount (leave date at today's default), click Add. Confirm the entry appears in the list above the form, immediately, with the amount subtracted from "Remaining".
4. Change the month dropdown at the top of the tab. Confirm the Actual Expense card's list and totals change to reflect the newly selected month (should be empty/zero for a month with no entries yet).
5. Switch back to the first month, click ✕ on the logged entry. Confirm it disappears and totals return to `Logged ₹0`.
6. Log in as a role without edit access (or view the same project as CEO/HR if their `canEdit` still applies — check `canEditMonthlyPlan` in `ProjectDetailPage.jsx`; if no no-edit role is easily reachable, skip this sub-step and note it as not independently verified) — confirm no Add row and no ✕ buttons render, only the read-only list and summary line.

- [ ] **Step 7: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: replace Expense tab Tasks card with plain PO actual-expense entry"
```

---

## Task 3: Wire `ActualSpendPanel`'s Project column to real data

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjectExpenses.list({ projectId, pool: 'project' })` (Task 1), `computeEffectiveProjectMonthly` (already imported).

- [ ] **Step 1: Add a Project-pool entries lookup and per-month actual helper inside `ActualSpendPanel`**

Change:
```js
const ActualSpendPanel = ({ project }) => {
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)
```
to:
```js
const ActualSpendPanel = ({ project }) => {
  const entries = localProjectExpenses.list({ projectId: project.id, pool: 'admin' })
  const actualForMonth = (month) =>
    entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)

  const projectEntries = localProjectExpenses.list({ projectId: project.id, pool: 'project' })
  const actualProjectForMonth = (month) =>
    projectEntries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)
```

- [ ] **Step 2: Replace the hardcoded Project column cell**

Change:
```jsx
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
```
to (only the first of these three cells — Project — changes; HR and Core stay exactly as they are):
```jsx
                    <CTableDataCell className="text-end">
                      {actualProjectForMonth(m.month) === 0
                        ? 'None'
                        : fmt(actualProjectForMonth(m.month))}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-body-tertiary">
                      — not yet tracked
                    </CTableDataCell>
```

- [ ] **Step 3: Verify build and lint**

Run: `npm_config_prefix=<scratch> npm run build`
Expected: clean build.

Run: `npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: no new errors.

- [ ] **Step 4: Manual browser verification**

On the same project used in Task 2's verification (which now has a logged Project-pool entry for one month): open the Monthly Plan tab, scroll to "💸 Actual Spend" below "📈 Planning Summary". Confirm the Project column for that month shows the logged amount (not "— not yet tracked"), and shows "None" for months with no entries. HR and Core columns still show "— not yet tracked".

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: show real Project-pool actuals in the Actual Spend table"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec §1 (VALID_POOLS). Task 2 covers spec §2 (Tasks-card swap, plain 3-field entry, canEdit gating, planned/logged/remaining line). Task 3 covers spec §3 (ActualSpendPanel Project column). Out-of-scope items (Admin/HR/Core entry UI, inline edit, `expense_accounted` reconciliation, Send/Revoke gating) are correctly not implemented.
- **Type/name consistency:** `ActualExpenseCard` props (`projectId`, `month`, `plannedAmount`, `canEdit`, `currentUser`) match exactly between its definition (Task 2, Step 3) and its usage (Task 2, Step 4). `pool: 'project'` string is identical across Task 1's `VALID_POOLS`, Task 2's `create`/`list` calls, and Task 3's `list` call.
- **No placeholders:** every step shows full before/after code; no "add validation" or "similar to Task N" shorthand.
