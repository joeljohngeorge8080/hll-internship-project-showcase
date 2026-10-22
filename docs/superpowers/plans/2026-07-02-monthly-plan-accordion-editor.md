# Monthly Plan Accordion Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the block-range planning UI with a per-month accordion (click a month to expand/edit it independently, with a "copy to all months" shortcut), and let the generated Monthly Plan table add/remove phase lines, not just edit amounts.

**Architecture:** This is a UI-only change confined to `MonthlyPlanPanel.jsx`. `BlockPlanner` is rewritten into `MonthAccordion`, which builds one single-month "block" per configured month and calls the existing, unchanged `localProjects.generateMonthlyPlan`. `PlanTable` gains add/remove/label/phase editing that calls the existing, unchanged `localProjects.updateMonthPlan`. No changes to `localProjects.js` or `monthlyApportionment.js`.

**Tech Stack:** React 19 + Vite, CoreUI React, plain JS service modules backed by `localStorage`. No test framework, no working browser in this environment — verification is `npm run build` + scoped `npm run lint -- <file>` + careful manual code review.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-monthly-plan-accordion-editor.md`.
- `src/modules/pms/project-associate/MonthlyPlanPanel.jsx` currently has a 0-error lint baseline — both tasks must keep it at 0 (this is a from-scratch rewrite of the file's content, not a legacy file with pre-existing debt to tolerate).
- `npm run build` currently passes clean and must continue to after every task.
- No changes to `src/services/localProjects.js` or `src/services/monthlyApportionment.js` — both `generateMonthlyPlan(projectId, blocks)` and `updateMonthPlan(projectId, month, phases)` are reused exactly as they exist today.
- Follow this file's existing style exactly (no semicolons, single quotes, 2-space indent, CoreUI components only, PropTypes on every component).
- Run all commands from `/home/jojo/labs/git-lab/HMA/hma-template/emsv1`.

---

## Task 1: Replace `BlockPlanner` with `MonthAccordion`

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Removes: `emptyBlock`, `BlockPlanner`, `BlockPlanner.propTypes`.
- Produces: `emptyMonthEntry(month)`, `seedMonthEntries(months, planBlocks)`, `MonthAccordion` component with the same prop contract `BlockPlanner` had (`project`, `onProjectChange`, `canEdit`, `defaultCollapsed`) — consumed by `MonthlyPlanPanel` (updated in this same task, Step 2).
- Consumes: `monthsInRange`, `computeWorkingPool` (existing, unchanged), `localProjects.generateMonthlyPlan(projectId, blocks)` (existing, unchanged signature: `blocks: Array<{startMonth, endMonth, phases}>`).

- [ ] **Step 1: Replace `emptyBlock`/`BlockPlanner`/`BlockPlanner.propTypes` with `emptyMonthEntry`/`seedMonthEntries`/`MonthAccordion`/`MonthAccordion.propTypes`**

Find the entire block from (currently starting at line 93):
```js
const emptyBlock = (months) => ({
  id: null,
  startMonth: months[0] || '',
  endMonth: months[0] || '',
  lines: [emptyLine()],
})
```
through the end of (currently ending at line 361):
```js
BlockPlanner.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  defaultCollapsed: PropTypes.bool,
}
```
(i.e., delete `emptyBlock`, the entire `BlockPlanner` component, and `BlockPlanner.propTypes` — everything between `const emptyBlock = ...` and the line right before `const monthLabel = (ym) => {`).

Replace with:

```js
const emptyMonthEntry = (month) => ({ month, lines: [emptyLine()] })

/**
 * Seeds one entry per project month from project.plan_blocks (each block's
 * month range expanded and its lines applied to every month it covers,
 * cloned per month so they're independently editable), or an empty line
 * for any month not covered by a saved block.
 */
const seedMonthEntries = (months, planBlocks) => {
  const linesByMonth = {}
  ;(planBlocks || []).forEach((b) => {
    const covered = monthsInRange(b.startMonth, b.endMonth)
    const lines = b.phases.map((ph) => ({
      phase: ph.phase,
      label: ph.label,
      amount: String(ph.amount),
    }))
    covered.forEach((m) => {
      linesByMonth[m] = lines
    })
  })
  return months.map((m) =>
    linesByMonth[m]
      ? { month: m, lines: linesByMonth[m].map((l) => ({ ...l })) }
      : emptyMonthEntry(m),
  )
}

const MonthAccordion = ({
  project,
  onProjectChange,
  canEdit = false,
  defaultCollapsed = false,
}) => {
  const months = monthsInRange(project.start_date, project.end_date)
  const workingPool = computeWorkingPool(project)
  const monthCount = months.length
  const baselinePerMonth = monthCount > 0 ? Math.round((workingPool / monthCount) * 100) / 100 : 0

  const [monthEntries, setMonthEntries] = useState(() =>
    seedMonthEntries(months, project.plan_blocks),
  )
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [error, setError] = useState('')

  const updateLine = (month, lineIdx, patch) => {
    setMonthEntries((prev) =>
      prev.map((e) =>
        e.month === month
          ? { ...e, lines: e.lines.map((l, li) => (li === lineIdx ? { ...l, ...patch } : l)) }
          : e,
      ),
    )
  }
  const addLine = (month) => {
    setMonthEntries((prev) =>
      prev.map((e) => (e.month === month ? { ...e, lines: [...e.lines, emptyLine()] } : e)),
    )
  }
  const removeLine = (month, lineIdx) => {
    setMonthEntries((prev) =>
      prev.map((e) =>
        e.month === month ? { ...e, lines: e.lines.filter((_, li) => li !== lineIdx) } : e,
      ),
    )
  }
  const copyToAllMonths = (month) => {
    const source = monthEntries.find((e) => e.month === month)
    if (!source) return
    setMonthEntries((prev) =>
      prev.map((e) =>
        e.month === month ? e : { ...e, lines: source.lines.map((l) => ({ ...l })) },
      ),
    )
  }

  const monthTotal = (entry) => entry.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const grandTotal = monthEntries.reduce((s, e) => s + monthTotal(e), 0)

  const handleGenerate = () => {
    setError('')
    try {
      const blocks = monthEntries
        .map((e) => ({
          startMonth: e.month,
          endMonth: e.month,
          phases: e.lines
            .filter((l) => l.label.trim() && parseFloat(l.amount) > 0)
            .map((l) => ({ phase: l.phase, label: l.label.trim(), amount: parseFloat(l.amount) })),
        }))
        .filter((b) => b.phases.length > 0)
      if (project.monthly_plan?.length) {
        const ok = window.confirm(
          'Regenerating will overwrite all manual month edits made in the table below — continue?',
        )
        if (!ok) return
      }
      const updated = localProjects.generateMonthlyPlan(project.id, blocks)
      onProjectChange(updated)
      setCollapsed(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!canEdit) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="bg-transparent fw-semibold pt-3">📅 Plan the Budget</CCardHeader>
        <CCardBody>
          <CAlert color="info" className="mb-0 small">
            You don&apos;t have permission to plan this project&apos;s budget.
          </CAlert>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard className="shadow-sm mb-4">
      <CCardHeader
        className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center"
        role="button"
        onClick={() => project.monthly_plan?.length && setCollapsed((c) => !c)}
      >
        <span>📅 Plan the Budget by Month</span>
        {project.monthly_plan?.length > 0 && (
          <CBadge color="secondary">{collapsed ? 'Show' : 'Hide'}</CBadge>
        )}
      </CCardHeader>
      {!collapsed && (
        <CCardBody>
          <div className="text-body-secondary small mb-3">
            Project baseline: <strong>{fmt(workingPool)}</strong> across{' '}
            <strong>{monthCount}</strong> month{monthCount !== 1 ? 's' : ''} — suggestion:{' '}
            <strong>{fmt(baselinePerMonth)}</strong>/month if split evenly. Click a month to plan
            it, or use &quot;Copy to all months&quot; to reuse one month&apos;s plan everywhere as
            a starting point. Months you leave empty are filled evenly with what&apos;s left when
            you Generate.
          </div>

          {monthCount > 0 && <BaselineTable months={months} baselinePerMonth={baselinePerMonth} />}

          {monthEntries.map((entry) => {
            const isOpen = expandedMonth === entry.month
            return (
              <CCard key={entry.month} className="mb-2 border">
                <CCardHeader
                  className="d-flex justify-content-between align-items-center py-2"
                  role="button"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedMonth(isOpen ? null : entry.month)}
                >
                  <span className="fw-semibold small">{monthLabelShort(entry.month)}</span>
                  <div className="d-flex align-items-center gap-2">
                    <CBadge color={monthTotal(entry) > 0 ? 'primary' : 'secondary'}>
                      {fmt(monthTotal(entry))}
                    </CBadge>
                    <CBadge color="secondary">{isOpen ? 'Hide' : 'Show'}</CBadge>
                  </div>
                </CCardHeader>
                {isOpen && (
                  <CCardBody>
                    {entry.lines.map((line, li) => (
                      <CRow key={li} className="g-2 mb-2 align-items-center">
                        <CCol xs={12} md={3}>
                          <CFormSelect
                            size="sm"
                            value={line.phase}
                            onChange={(e) =>
                              updateLine(entry.month, li, { phase: e.target.value })
                            }
                          >
                            {PHASE_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </CFormSelect>
                        </CCol>
                        <CCol xs={12} md={5}>
                          <CFormInput
                            size="sm"
                            placeholder="Task / activity"
                            value={line.label}
                            onChange={(e) =>
                              updateLine(entry.month, li, { label: e.target.value })
                            }
                          />
                        </CCol>
                        <CCol xs={8} md={3}>
                          <CInputGroup size="sm">
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={line.amount}
                              onChange={(e) =>
                                updateLine(entry.month, li, { amount: e.target.value })
                              }
                            />
                          </CInputGroup>
                        </CCol>
                        <CCol xs={4} md={1}>
                          <CButton
                            size="sm"
                            color="danger"
                            variant="ghost"
                            disabled={entry.lines.length === 1}
                            onClick={() => removeLine(entry.month, li)}
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </CCol>
                      </CRow>
                    ))}

                    <div className="d-flex gap-2">
                      <CButton
                        size="sm"
                        color="secondary"
                        variant="outline"
                        onClick={() => addLine(entry.month)}
                      >
                        <CIcon icon={cilPlus} className="me-1" />
                        Add Line
                      </CButton>
                      <CButton
                        size="sm"
                        color="info"
                        variant="outline"
                        onClick={() => copyToAllMonths(entry.month)}
                      >
                        📋 Copy to all months
                      </CButton>
                    </div>
                  </CCardBody>
                )}
              </CCard>
            )
          })}

          <div className="d-flex align-items-center gap-2 mb-3 mt-2">
            <span className="small text-body-secondary">Planned total:</span>
            <CBadge color={grandTotal > 0 ? 'primary' : 'secondary'}>{fmt(grandTotal)}</CBadge>
            <span className="small text-body-secondary">
              of {fmt(workingPool)} project baseline
            </span>
          </div>

          {error && (
            <CAlert color="danger" className="py-2 small">
              {error}
            </CAlert>
          )}

          <CButton color="success" onClick={handleGenerate}>
            Generate Plan
          </CButton>
        </CCardBody>
      )}
    </CCard>
  )
}

MonthAccordion.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  defaultCollapsed: PropTypes.bool,
}
```

Note: `CCardHeader` and `CCardBody` are siblings inside `CCard`, not nested — so a click inside the expanded month's `CCardBody` (e.g. on a text input) does not bubble up to the month's own `CCardHeader` toggle handler. No `stopPropagation()` is needed anywhere in this component.

- [ ] **Step 2: Update `MonthlyPlanPanel` to render `MonthAccordion` instead of `BlockPlanner`**

Find (inside `MonthlyPlanPanel`, currently around line 652):
```js
      <BlockPlanner
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        defaultCollapsed={hasPlan}
      />
```
Replace with:
```js
      <MonthAccordion
        project={project}
        onProjectChange={onProjectChange}
        canEdit={canEdit}
        defaultCollapsed={hasPlan}
      />
```

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: both exit 0. This file's baseline is 0 errors — hold strictly. `grep -n "BlockPlanner"` on this file should return zero matches after this task.

- [ ] **Step 4: Manual verification**

No browser available — verify by careful code read-through. Confirm: `seedMonthEntries` correctly expands a multi-month `plan_blocks` entry (e.g. a block with `startMonth: '2026-01', endMonth: '2026-03'`) into 3 separate month entries, each with its own cloned `lines` array (not sharing the same array reference — verify by checking `.map((l) => ({ ...l }))` is present, not a bare reference assignment). Confirm `copyToAllMonths` clones lines for every OTHER month but leaves the source month's own entry unchanged in the same state update. Confirm `handleGenerate` builds one block per month with any non-empty lines, and that `localProjects.generateMonthlyPlan`'s existing signature (`Array<{startMonth, endMonth, phases}>`) is satisfied exactly (each block here has `startMonth === endMonth === e.month`).

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: replace block-range planner with per-month accordion editor"
```

---

## Task 2: `PlanTable` gains add/remove phase lines and editable label/phase

**Files:**
- Modify: `src/modules/pms/project-associate/MonthlyPlanPanel.jsx`

**Interfaces:**
- Consumes: `localProjects.updateMonthPlan(projectId, month, phases)` (existing, unchanged — returns `{ project, validation }`).
- Changes: `PlanTable`'s phase-breakdown table cell gains editable phase/label fields (previously static) plus Add Line / Remove Line controls, alongside the existing amount editing.

- [ ] **Step 1: Add three new handlers next to the existing `handleAmountChange` in `PlanTable`**

Find (currently around line 502-509):
```js
  const handleAmountChange = (month, phaseIdx, amount) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) =>
      i === phaseIdx ? { ...ph, amount: parseFloat(amount) || 0 } : ph,
    )
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```
Add right after it:
```js

  const handleLabelChange = (month, phaseIdx, label) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, label } : ph))
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handlePhaseChange = (month, phaseIdx, phase) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.map((ph, i) => (i === phaseIdx ? { ...ph, phase } : ph))
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleAddPhase = (month) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = [...monthEntry.phases, { phase: 'design', label: '', amount: 0 }]
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }

  const handleRemovePhase = (month, phaseIdx) => {
    const monthEntry = project.monthly_plan.find((m) => m.month === month)
    const phases = monthEntry.phases.filter((_, i) => i !== phaseIdx)
    const { project: updated } = localProjects.updateMonthPlan(project.id, month, phases)
    onProjectChange(updated)
  }
```

- [ ] **Step 2: Replace the static phase-breakdown table cell with the editable version**

Find (currently around lines 561-584):
```jsx
                    <CTableDataCell>
                      {m.phases.map((ph, i) => (
                        <div key={i} className="d-flex align-items-center gap-2 mb-1">
                          <CBadge
                            color="secondary"
                            shape="rounded-pill"
                            style={{ fontSize: '0.65rem' }}
                          >
                            {ph.phase}
                          </CBadge>
                          <span className="text-body-secondary">{ph.label}</span>
                          <CInputGroup size="sm" style={{ maxWidth: 130 }}>
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={ph.amount}
                              disabled={!canEdit}
                              onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                            />
                          </CInputGroup>
                        </div>
                      ))}
                    </CTableDataCell>
```
Replace with:
```jsx
                    <CTableDataCell>
                      {m.phases.map((ph, i) => (
                        <div key={i} className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                          <CFormSelect
                            size="sm"
                            style={{ width: 110 }}
                            value={ph.phase}
                            disabled={!canEdit}
                            onChange={(e) => handlePhaseChange(m.month, i, e.target.value)}
                          >
                            {PHASE_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </CFormSelect>
                          <CFormInput
                            size="sm"
                            style={{ width: 130 }}
                            placeholder="Task / activity"
                            value={ph.label}
                            disabled={!canEdit}
                            onChange={(e) => handleLabelChange(m.month, i, e.target.value)}
                          />
                          <CInputGroup size="sm" style={{ maxWidth: 120 }}>
                            <CInputGroupText>₹</CInputGroupText>
                            <CFormInput
                              type="number"
                              min="0"
                              value={ph.amount}
                              disabled={!canEdit}
                              onChange={(e) => handleAmountChange(m.month, i, e.target.value)}
                            />
                          </CInputGroup>
                          {canEdit && (
                            <CButton
                              size="sm"
                              color="danger"
                              variant="ghost"
                              disabled={m.phases.length === 1}
                              onClick={() => handleRemovePhase(m.month, i)}
                            >
                              <CIcon icon={cilTrash} size="sm" />
                            </CButton>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <CButton
                          size="sm"
                          color="secondary"
                          variant="outline"
                          onClick={() => handleAddPhase(m.month)}
                        >
                          <CIcon icon={cilPlus} className="me-1" />
                          Add Line
                        </CButton>
                      )}
                    </CTableDataCell>
```

- [ ] **Step 3: Verify it lints and builds**

Run: `npm run build && npm run lint -- src/modules/pms/project-associate/MonthlyPlanPanel.jsx`
Expected: both exit 0. This file's baseline is 0 errors — hold strictly.

- [ ] **Step 4: Manual verification**

No browser available — verify by careful code read-through. Confirm: `handleAddPhase` appends a new `{phase: 'design', label: '', amount: 0}` line and persists via `updateMonthPlan` immediately (matching this table's existing live-save convention — no separate save step, consistent with everything else in `PlanTable`). Confirm `handleRemovePhase`'s Remove button is `disabled` when `m.phases.length === 1` (mirrors the same "keep at least one line" convention already used in `MonthAccordion`/`removeLine`). Confirm phase/label/amount fields are all `disabled={!canEdit}` (view-only for non-editors, matching the existing amount-only disabled behavior). Confirm `PHASE_OPTIONS` (the existing top-level constant) is reused here, not redefined.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pms/project-associate/MonthlyPlanPanel.jsx
git commit -m "feat: allow adding/removing phase lines in the generated Monthly Plan table"
```
