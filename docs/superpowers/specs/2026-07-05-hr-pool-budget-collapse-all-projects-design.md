# Global HR Pool — Collapsible Budget View + "All Projects" Summary — Design Spec

**Date:** 2026-07-05
**Module:** EMS Global HR Pool (`hma-template/emsv1/src/modules/ems/hr-pool/GlobalHRPoolPage.jsx`)
**Status:** Approved by user.

## Background

The Global HR Pool page always shows the "View Project HR Budget" section (project selector + gradient `ProjectHRBudgetCard` banner) at the top, above the HR/Admin expense cards. The user wants this hidden by default (shown on demand), and wants a way to see all active projects' HR budget summed together, not just one project at a time.

## Decisions (confirmed with user)

1. **Hide behavior:** Collapsed by default behind a single toggle button (`Show Project HR Budget` / `Hide Project HR Budget`). No modal — inline expand/collapse.
2. **"All Projects" view:** A new `— All Projects —` option in the existing project dropdown, shown instead of an individual project's gradient banner.
3. **Aggregate scope:** Current month only, reusing the already-existing `localOrgPool.getMonthlyHRPoolBudgetSummary()` (no new pool-logic function needed — this function is already used elsewhere on this page, in `ExpensePoolCard`'s Budget Cap Alert). No per-project breakdown, no per-charge editable list — just the three-tile aggregate (matches the user's explicit choice of "single aggregated summary only").

## Non-goals

- No changes to `ProjectHRBudgetCard`'s per-project view, its `AllocationEditor`, or `updateExpenseProjectAllocation` — selecting an individual project behaves exactly as it does today.
- No new functions in `localOrgPool.js` — `getMonthlyHRPoolBudgetSummary()` already returns everything needed (`totalMonthlyBudget`, `usedThisMonth`, `remaining`).
- No changes to the HR/Admin `ExpensePoolCard` cards below this section.

## Design

### 1. Collapse/expand toggle

New state in `GlobalHRPoolPage`: `showBudgetSection` (boolean, default `false`). A button placed where the "Project Selector + Budget Banner" card currently starts:

```jsx
<div className="mb-3">
  <CButton
    size="sm"
    color="secondary"
    variant="outline"
    onClick={() => setShowBudgetSection((s) => !s)}
  >
    <CIcon icon={cilChartPie} className="me-1" style={{ width: 14, height: 14 }} />
    {showBudgetSection ? 'Hide Project HR Budget' : 'Show Project HR Budget'}
  </CButton>
</div>
```

The project-selector `CCard` and whichever budget card follows (`ProjectHRBudgetCard` or the new `OrgWideHRBudgetCard`) only render when `showBudgetSection` is `true`.

### 2. "All Projects" dropdown option + default selection

The dropdown's `<option value="">— Select a project —</option>` is replaced with `<option value="__all__">— All Projects —</option>`, and `selectedProjectId`'s initial state becomes `'__all__'` instead of `''`. The `reload()` function's line that auto-selects the first project (`setSelectedProjectId((prev) => prev || (ap[0]?.projectId ?? ''))`) is removed — it's no longer needed since the state always starts on the `'__all__'` sentinel, which is truthy, so that line would never have overridden it anyway. `'__all__'` is safe as a sentinel since real project ids never take this literal value.

### 3. New `OrgWideHRBudgetCard` component

Defined inline in `GlobalHRPoolPage.jsx` (same convention as `AllocationEditor`/`ProjectHRBudgetCard` — page-specific, not extracted to its own file). Reuses the page's existing `fmtL`, `cilDollar`, `cilChartPie` imports — no new imports needed. Visually matches `ProjectHRBudgetCard`'s gradient-card style (same background, same 3-metric-tile row, same progress bar) but with only one heading ("All Projects (Org-Wide)") and no per-charge breakdown list:

```jsx
const OrgWideHRBudgetCard = () => {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    setSummary(localOrgPool.getMonthlyHRPoolBudgetSummary())
  }, [])

  if (!summary) return null

  const { totalMonthlyBudget, usedThisMonth, remaining } = summary
  const usedPct =
    totalMonthlyBudget > 0 ? Math.min(100, Math.round((usedThisMonth / totalMonthlyBudget) * 100)) : 0
  const isOver = remaining < 0

  return (
    <CCard
      className="mb-4 shadow-sm border-0"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <CCardBody className="p-4">
        <div className="mb-4">
          <div className="text-white-50 small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '0.08em' }}>
            HR Pool Budget — Monthly View
          </div>
          <div className="text-white fw-bold fs-5">All Projects (Org-Wide)</div>
        </div>

        <CRow className="g-3 mb-4">
          {[
            {
              label: 'Monthly HR Budget',
              value: fmtL(totalMonthlyBudget),
              sub: 'Across all active projects',
              icon: cilDollar,
              accent: '#4facfe',
            },
            {
              label: 'Amount Used',
              value: fmtL(usedThisMonth),
              sub: 'This month, Project Pool-sourced',
              icon: cilChartPie,
              accent: isOver ? '#ff6b6b' : '#ffd166',
            },
            {
              label: 'Remaining',
              value: fmtL(Math.abs(remaining)),
              sub: isOver ? 'Over budget!' : `${100 - usedPct}% remaining`,
              icon: cilDollar,
              accent: isOver ? '#ff6b6b' : '#06d6a0',
              prefix: isOver ? '−' : '',
            },
          ].map((m) => (
            <CCol key={m.label} xs={12} md={4}>
              <div
                className="rounded-3 p-3 h-100"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="d-flex align-items-center gap-2 mb-2" style={{ color: m.accent }}>
                  <CIcon icon={m.icon} size="sm" />
                  <span
                    className="small fw-semibold text-uppercase"
                    style={{ letterSpacing: '0.06em', fontSize: '0.7rem' }}
                  >
                    {m.label}
                  </span>
                </div>
                <div className="fw-bold text-white" style={{ fontSize: '1.6rem', lineHeight: 1.1 }}>
                  {m.prefix || ''}
                  {m.value}
                </div>
                <div className="text-white-50" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  {m.sub}
                </div>
              </div>
            </CCol>
          ))}
        </CRow>

        <div>
          <div className="d-flex justify-content-between text-white-50 small mb-2">
            <span>Budget utilization</span>
            <span className={isOver ? 'text-danger fw-bold' : 'text-white fw-semibold'}>
              {usedPct}% used {isOver && '(Over budget!)'}
            </span>
          </div>
          <div className="rounded-pill overflow-hidden" style={{ height: 10, background: 'rgba(255,255,255,0.12)' }}>
            <div
              className="rounded-pill h-100"
              style={{
                width: `${Math.min(100, usedPct)}%`,
                background: isOver
                  ? '#ff6b6b'
                  : usedPct > 85
                    ? 'linear-gradient(90deg,#ffd166,#ff9f43)'
                    : 'linear-gradient(90deg,#4facfe,#06d6a0)',
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}
```

### 4. Wiring it together

The render block that currently reads:

```jsx
<CCard className="shadow-sm mb-3 border-0 bg-body-secondary">
  ...project selector...
</CCard>

<ProjectHRBudgetCard
  key={budgetKey}
  projectId={selectedProjectId}
  projects={activeProjects}
  onAllocationEdited={() => setBudgetKey((k) => k + 1)}
/>
```

becomes:

```jsx
<div className="mb-3">
  <CButton size="sm" color="secondary" variant="outline" onClick={() => setShowBudgetSection((s) => !s)}>
    <CIcon icon={cilChartPie} className="me-1" style={{ width: 14, height: 14 }} />
    {showBudgetSection ? 'Hide Project HR Budget' : 'Show Project HR Budget'}
  </CButton>
</div>

{showBudgetSection && (
  <>
    <CCard className="shadow-sm mb-3 border-0 bg-body-secondary">
      <CCardBody className="py-3 px-4">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <CIcon icon={cilChartPie} className="text-primary" style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div className="fw-semibold text-nowrap">View Project HR Budget:</div>
          <CFormSelect
            size="sm"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ maxWidth: 380, minWidth: 220 }}
          >
            <option value="__all__">— All Projects —</option>
            {activeProjects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </CFormSelect>
          {activeProjects.length === 0 && (
            <span className="text-body-secondary small">No active projects in the HR pool yet.</span>
          )}
        </div>
      </CCardBody>
    </CCard>

    {selectedProjectId === '__all__' ? (
      <OrgWideHRBudgetCard key={budgetKey} />
    ) : (
      <ProjectHRBudgetCard
        key={budgetKey}
        projectId={selectedProjectId}
        projects={activeProjects}
        onAllocationEdited={() => setBudgetKey((k) => k + 1)}
      />
    )}
  </>
)}
```

`budgetKey` (already bumped by `ExpensePoolCard`'s `onExpenseChanged` after an HR expense add/remove/edit) is reused as `OrgWideHRBudgetCard`'s `key` too, so it refetches after any HR expense change — same refresh mechanism the per-project card already relies on.

## Data shape summary (for the implementation plan)

```
GlobalHRPoolPage.jsx:
  - new state: showBudgetSection (boolean, default false)
  - selectedProjectId initial state changes from '' to '__all__'
  - reload() no longer auto-selects the first project
  - new component: OrgWideHRBudgetCard (no props, reads localOrgPool.getMonthlyHRPoolBudgetSummary() directly)
  - dropdown's blank option replaced with '__all__' / "— All Projects —"
  - render swaps between OrgWideHRBudgetCard and ProjectHRBudgetCard based on selectedProjectId
  - entire selector + budget-card block wrapped in a toggle-controlled conditional

No changes to localOrgPool.js, ExpensePoolCard.jsx, or any other file.
```
