# Remove Task-Count Gate From Project Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Project Officer/Associate activate a project's HR/Core pool distribution as soon as a monthly plan exists, without also needing at least one task assigned to the project first.

**Architecture:** Single-file UI change. `ProjectDetailPage.jsx` currently computes `projectTaskCount` and uses it, alongside `hasMonthlyPlan`, to pick between three mutually-exclusive banner states (task-missing badge / plan-missing badge / Activate button). Drop the task-count branch and its now-dead `projectTaskCount` memo; the two remaining states collapse to depend on `hasMonthlyPlan` alone. `localProjects.activateProject` itself is untouched — it already has no task requirement, the gate lives entirely in the UI's conditional rendering.

**Tech Stack:** React 18 function components. No test framework in this project (no `vitest`/`jest`, no existing test files) — verification is a real dev-server + browser check (Playwright), matching how every other change in this project has been verified.

## Global Constraints

- Activation must still require a monthly plan to exist (`hasMonthlyPlan`) — only the task-count requirement is being removed, confirmed explicitly by the user.
- `localTasks` import in `ProjectDetailPage.jsx` must stay — it's used elsewhere in the file (`localTasks.getByProjectGrouped`) for an unrelated feature (milestone task grouping), unrelated to this change.
- No change to `localProjects.activateProject` — it was never task-gated; the gate was purely a UI-layer conditional.

---

## File Structure

| File | Responsibility |
|---|---|
| `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx` | Remove the `projectTaskCount` memo and the task-count condition from the three activation-banner branches (lines ~686-692, ~857-882). |

No new files, no service-layer changes, no new dependencies.

---

### Task 1: Drop the task-count gate from the activation banner

**Files:**
- Modify: `hma-template/emsv1/src/modules/pms/project-associate/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: nothing new — `project.monthly_plan`, `project.is_operations_active` (already read elsewhere in this file), `localProjects.activateProject` (already imported and called by the existing `handleActivateProject`, unchanged).
- Produces: nothing consumed elsewhere — this is a leaf UI change with no other file depending on it.

- [ ] **Step 1: Remove the `projectTaskCount` memo**

Find, around line 686:

```jsx
  const projectTaskCount = useMemo(
    () => (project ? localTasks.getByProject(project.id).length : 0),
    [project],
  )
  // Activation requires both a task assigned AND a completed monthly plan —
  // the Project Officer must plan the budget before it can go live.
  const hasMonthlyPlan = Boolean(project?.monthly_plan?.length)
```

Replace with:

```jsx
  // Activation requires a completed monthly plan — the Project Officer
  // must plan the budget before it can go live. (Previously also required
  // a task to be assigned first, but that gate assumed active task
  // monitoring by field personnel, which doesn't happen in practice, so
  // it was removed — a project with a plan but zero tasks can activate.)
  const hasMonthlyPlan = Boolean(project?.monthly_plan?.length)
```

- [ ] **Step 2: Collapse the three activation-banner branches to two**

Find, around line 857:

```jsx
          {!project.is_operations_active && projectTaskCount === 0 && (
            <CBadge
              color="secondary"
              className="px-3 py-2 d-flex align-items-center"
              style={{ fontSize: '0.8rem' }}
            >
              ⏸ Not Activated — assign a task first
            </CBadge>
          )}
          {!project.is_operations_active && projectTaskCount > 0 && !hasMonthlyPlan && (
            <CBadge
              color="secondary"
              className="px-3 py-2 d-flex align-items-center"
              style={{ fontSize: '0.8rem' }}
            >
              ⏸ Not Activated — plan the monthly budget first
            </CBadge>
          )}
          {!project.is_operations_active && projectTaskCount > 0 && hasMonthlyPlan && (
            <CButton
              color="success"
              className="fw-semibold flex-shrink-0"
              onClick={handleActivateProject}
            >
              ▶ Activate Project
            </CButton>
          )}
```

Replace with:

```jsx
          {!project.is_operations_active && !hasMonthlyPlan && (
            <CBadge
              color="secondary"
              className="px-3 py-2 d-flex align-items-center"
              style={{ fontSize: '0.8rem' }}
            >
              ⏸ Not Activated — plan the monthly budget first
            </CBadge>
          )}
          {!project.is_operations_active && hasMonthlyPlan && (
            <CButton
              color="success"
              className="fw-semibold flex-shrink-0"
              onClick={handleActivateProject}
            >
              ▶ Activate Project
            </CButton>
          )}
```

- [ ] **Step 3: Verify no other reference to `projectTaskCount` remains**

```bash
cd hma-template/emsv1 && grep -n "projectTaskCount" src/modules/pms/project-associate/ProjectDetailPage.jsx
```

Expected: no output (all three usages removed — the memo declaration and both of its two remaining condition checks; the third occurrence, the "assign a task first" branch, was deleted outright in Step 2).

- [ ] **Step 4: Build and lint**

```bash
cd hma-template/emsv1 && npm run build && npx eslint src/modules/pms/project-associate/ProjectDetailPage.jsx
```

Expected: clean build (`✓ built in ...`); lint exits 0 with no output.

- [ ] **Step 5: Browser verification**

Start the dev server and confirm both banner states in a real browser:

```bash
cd hma-template/emsv1
nohup npm run start > /tmp/vite-dev.log 2>&1 & disown
sleep 3 && cat /tmp/vite-dev.log   # confirm the port (usually 3000)
```

Using Playwright (scratch npm install, same pattern used throughout this project — `mkdir -p /tmp/pw-scratch && cd /tmp/pw-scratch && npm init -y && npm install playwright`):

1. Log in as Project Associate → Enter Projects.
2. Open a project that has **zero tasks assigned** and **no monthly plan yet**. Confirm the banner reads "⏸ Not Activated — plan the monthly budget first" (not the old "assign a task first" message, which must no longer be reachable).
3. Generate a monthly plan for that same project (Monthly Plan tab → Initialize/Generate Plan). Re-open the Overview tab. Confirm the "▶ Activate Project" button now appears — even though this project still has zero tasks.
4. Click "▶ Activate Project". Confirm it succeeds (toast: "Project operations activated — HR & Core pool contributions are now live") and the banner switches to "Operations Active", exactly as before.
5. Check the browser console for errors at each step (`page.on('pageerror')` / `page.on('console')` filtering to `error` type) — expect none (the two pre-existing Google Sign-In warnings seen throughout this project are not regressions and can be ignored).

- [ ] **Step 6: Clean up**

```bash
pkill -f "vite" 2>/dev/null
rm -rf /tmp/pw-scratch
```

- [ ] **Step 7: Commit**

```bash
cd hma-template/emsv1 && git add src/modules/pms/project-associate/ProjectDetailPage.jsx
git commit -m "fix: drop task-count gate on project activation, keep monthly-plan gate"
```

---

## Self-Review

**1. Spec coverage:** Single confirmed requirement — remove the task-count gate, keep the monthly-plan gate. Task 1 covers it completely (memo removal + both banner branches updated). No other requirement was stated.

**2. Placeholder scan:** No TBD/TODO; every step shows the exact before/after code and exact commands.

**3. Type consistency:** `hasMonthlyPlan` (boolean, `Boolean(project?.monthly_plan?.length)`) and `handleActivateProject` (existing function, unchanged) are the only identifiers this plan's new code depends on — both already exist verbatim in the current file at the point this task starts, confirmed by direct reading of the file before writing this plan.
