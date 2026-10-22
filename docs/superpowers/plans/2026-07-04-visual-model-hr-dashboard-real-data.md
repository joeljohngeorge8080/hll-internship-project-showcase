# Visual Model — HR Dashboard Real-Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded mock data in `VisualModelPage.jsx`'s HR Dashboard section with real data from `localEmployees` and `localAttendance`, removing the two widgets (Payroll trend, Employment Type) that have no real backing data.

**Architecture:** All changes are in one file, `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`. Three module-level pure helper functions (`buildDepartments`, `buildAttendanceTrend`, `computeTotalMonthlyPayroll`) replace the hardcoded mock constants; the `HRDashboard` component calls them on each render instead of closing over module-load-time constants. Chart components (`DeptBar`, `AttendanceTrend`) become prop-driven instead of reading module constants directly.

**Tech Stack:** React 19, Chart.js via direct `chart.js` import (this file doesn't use `@coreui/react-chartjs`, it wraps `Chart.js` itself in a `useChart` hook — this is pre-existing and out of scope to change).

## Global Constraints

- Working directory for all commands: `hma-template/emsv1/`.
- No semicolons, single quotes, 2-space indent (Prettier via ESLint) — run `npx eslint --fix <file>` after edits, then `npx eslint <file>` must show no *new* errors (this file, like others in the repo, may have pre-existing lint debt unrelated to this change — compare error counts before/after your edit, don't try to fix unrelated pre-existing issues).
- **No test runner exists in this repo.** Verification per task = (1) a Node-script logic check for pure helper functions (this file's service imports, `localEmployees.js`/`localAttendance.js`, have no relative imports of their own, so plain `node --input-type=module` scripts work directly, same approach already used for `localGeneralExpenses.js` verification), (2) `npx vite build` succeeds, (3) a final manual browser check after all 3 tasks (dev-login, navigate to Visual Model, switch to HR Dashboard).
- Real seed data facts (from `src/services/seedEmployees.json`, 73 employees): departments present are `['', 'Finance', 'HMA Management', 'HR', 'IT', 'SDP', 'Utility Staff']` (blank department → bucket as `'Unassigned'`, per spec); all 73 have `current_salary: 0` today, so the Payroll KPI will legitimately show ₹0 until real salaries are entered — this is correct behavior, not a bug, and worth mentioning when reporting task completion.
- Spec: `docs/superpowers/specs/2026-07-04-visual-model-hr-dashboard-real-data-design.md`. Section 1 → Task 1. Section 2 → Task 2. Sections 3–4 → Task 3.

---

### Task 1: Wire Departments + gender chart to real employee data

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`

**Interfaces:**
- Consumes: `localEmployees.list({ pageSize }) => { items: Array<{ status, gender, employment: { department } }>, total, total_pages }` from `../../../services/localEmployees` (existing, unchanged).
- Produces: `buildDepartments() => Array<{ name: string, headcount: number, male: number, female: number }>`, used by Task 3's `HRDashboard` rewrite. `DeptBar` now takes a `{ departments }` prop instead of reading a module constant.

- [ ] **Step 1: Add the `localEmployees` import**

Find (line 20):
```js
} from '../../../services/sdpProjectsData'
```
Replace with:
```js
} from '../../../services/sdpProjectsData'
import { localEmployees } from '../../../services/localEmployees'
```

- [ ] **Step 2: Replace `HR_DEPARTMENTS` with a live builder function**

Find (lines 61–69):
```js
const HR_DEPARTMENTS = [
  { name: 'Field Operations', headcount: 42, male: 28, female: 14 },
  { name: 'Programme',        headcount: 18, male: 10, female: 8  },
  { name: 'Finance',          headcount: 11, male: 6,  female: 5  },
  { name: 'Admin & HR',       headcount: 9,  male: 4,  female: 5  },
  { name: 'IT & Data',        headcount: 6,  male: 5,  female: 1  },
  { name: 'Communications',   headcount: 5,  male: 2,  female: 3  },
  { name: 'M&E',              headcount: 4,  male: 2,  female: 2  },
]
```
Replace with:
```js
/**
 * Live department + gender breakdown from real employee records.
 * Groups Active employees by employment.department (blank → 'Unassigned').
 */
const buildDepartments = () => {
  const employees = localEmployees.list({ pageSize: 1000 }).items.filter(
    (e) => e.status === 'Active',
  )
  const byDept = {}
  for (const e of employees) {
    const dept = e.employment?.department || 'Unassigned'
    if (!byDept[dept]) byDept[dept] = { name: dept, headcount: 0, male: 0, female: 0 }
    byDept[dept].headcount += 1
    if (e.gender === 'Male') byDept[dept].male += 1
    else if (e.gender === 'Female') byDept[dept].female += 1
  }
  return Object.values(byDept).sort((a, b) => b.headcount - a.headcount)
}
```

- [ ] **Step 3: Make `DeptBar` accept a `departments` prop**

Find (lines 235–256):
```js
/** Grouped bar – department headcount by gender */
const DeptBar = () => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: HR_DEPARTMENTS.map(d => d.name),
      datasets: [
        { label: 'Male',   data: HR_DEPARTMENTS.map(d => d.male),   backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 16 },
        { label: 'Female', data: HR_DEPARTMENTS.map(d => d.female), backgroundColor: '#ec4899', borderRadius: 4, barThickness: 16 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 25 } },
        y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 5, font: { size: 11 } }, title: { display: true, text: 'Headcount', font: { size: 11 }, color: '#6b7280' } },
      },
    },
  }), [])
  return <canvas ref={ref} height={200} />
}
```
Replace with:
```js
/** Grouped bar – department headcount by gender */
const DeptBar = ({ departments }) => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: departments.map(d => d.name),
      datasets: [
        { label: 'Male',   data: departments.map(d => d.male),   backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 16 },
        { label: 'Female', data: departments.map(d => d.female), backgroundColor: '#ec4899', borderRadius: 4, barThickness: 16 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 25 } },
        y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 5, font: { size: 11 } }, title: { display: true, text: 'Headcount', font: { size: 11 }, color: '#6b7280' } },
      },
    },
  }), [departments.map(d => d.name).join()])
  return <canvas ref={ref} height={200} />
}
```
(The dependency array change — from `[]` to `[departments.map(d => d.name).join()]` — makes the chart rebuild if the department list itself changes across renders; values within existing departments don't need this since `useChart`'s builder closure already captures the latest `departments` on each call... but department *names* changing would otherwise leave a stale canvas, so this is a correctness fix worth keeping.)

- [ ] **Step 4: Update `HRDashboard` to use `buildDepartments()` for headcount/gender KPIs, `DeptBar`, and the Department Summary table**

Find (lines 370–374 — the module-level derived constants block):
```js
const totalHeadcount  = HR_DEPARTMENTS.reduce((s, d) => s + d.headcount, 0)
const totalMale       = HR_DEPARTMENTS.reduce((s, d) => s + d.male, 0)
const totalFemale     = HR_DEPARTMENTS.reduce((s, d) => s + d.female, 0)
const avgAttendance   = Math.round(HR_ATTENDANCE.present.reduce((s, v) => s + v, 0) / HR_ATTENDANCE.present.length)
const latestPayroll   = HR_PAYROLL_TOTALS[HR_PAYROLL_TOTALS.length - 1]
```
Replace with (this removes the department-related module constants; `avgAttendance` and `latestPayroll` stay as module-level constants for now — Tasks 2 and 3 replace those):
```js
const avgAttendance   = Math.round(HR_ATTENDANCE.present.reduce((s, v) => s + v, 0) / HR_ATTENDANCE.present.length)
const latestPayroll   = HR_PAYROLL_TOTALS[HR_PAYROLL_TOTALS.length - 1]
```

Find (lines 376–384, the start of `HRDashboard` through the KPI row):
```js
const HRDashboard = () => (
  <>
    {/* KPI row */}
    <div style={S.kpiRow4}>
      <KpiCard label="Total Employees" value={totalHeadcount}    icon="👥" accent="#1e40af" />
      <KpiCard label="Avg Attendance"  value={`${avgAttendance}%`} icon="📅" accent="#059669" />
      <KpiCard label="Monthly Payroll" value={`₹${fmtCompact(latestPayroll)}`} sub={`₹${fmt(latestPayroll)}`} icon="💰" accent="#6366f1" />
      <KpiCard label="Gender Split"    value={`${totalMale}M / ${totalFemale}F`} icon="⚖️" accent="#0891b2" />
    </div>
```
Replace with:
```js
const HRDashboard = () => {
  const departments = buildDepartments()
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)

  return (
  <>
    {/* KPI row */}
    <div style={S.kpiRow4}>
      <KpiCard label="Total Employees" value={totalHeadcount}    icon="👥" accent="#1e40af" />
      <KpiCard label="Avg Attendance"  value={`${avgAttendance}%`} icon="📅" accent="#059669" />
      <KpiCard label="Monthly Payroll" value={`₹${fmtCompact(latestPayroll)}`} sub={`₹${fmt(latestPayroll)}`} icon="💰" accent="#6366f1" />
      <KpiCard label="Gender Split"    value={`${totalMale}M / ${totalFemale}F`} icon="⚖️" accent="#0891b2" />
    </div>
```
(Note: `HRDashboard` becomes a normal function body with an explicit `return` — the closing needs updating too, see Step 5.)

- [ ] **Step 5: Pass `departments` into `DeptBar`, use it in the summary table, and close the new function body**

Find (line 389):
```js
        <DeptBar />
```
Replace with:
```js
        <DeptBar departments={departments} />
```

Find (line 429):
```js
            {HR_DEPARTMENTS.map((d, i) => {
```
Replace with:
```js
            {departments.map((d, i) => {
```

Find the end of `HRDashboard` (lines 462–464):
```js
    </ChartCard>
  </>
)
```
Replace with:
```js
    </ChartCard>
  </>
  )
}
```

- [ ] **Step 6: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/reports-analysis/VisualModelPage.jsx`

Run: `npx eslint src/modules/ems/reports-analysis/VisualModelPage.jsx 2>&1 | tail -5`
Expected: whatever count of errors appears, note it — this file may have pre-existing lint debt. Confirm none of the errors reference `buildDepartments`, `DeptBar`, or line numbers inside `HRDashboard`'s new body by grepping the output for those names — expected: no matches.

Run: `npx vite build`
Expected: `✓ built in` with no errors.

- [ ] **Step 7: Verify `buildDepartments`'s logic against real seed data**

```bash
cat > /tmp/verify_departments.mjs << 'EOF'
globalThis.localStorage = (() => {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
})()
if (!globalThis.crypto.randomUUID) {
  let i = 0
  globalThis.crypto.randomUUID = () => `uuid-${i++}`
}

const { seedLocalEmployees } = await import(process.cwd() + '/src/services/seedLocalEmployees.js')
const { localEmployees } = await import(process.cwd() + '/src/services/localEmployees.js')

seedLocalEmployees()
const items = localEmployees.list({ pageSize: 1000 }).items
console.log('Total employees:', items.length)
console.log('Active:', items.filter(e => e.status === 'Active').length)

const byDept = {}
for (const e of items.filter(e => e.status === 'Active')) {
  const dept = e.employment?.department || 'Unassigned'
  byDept[dept] = (byDept[dept] || 0) + 1
}
console.log('Departments:', byDept)
EOF
node /tmp/verify_departments.mjs
```
Expected: `Total employees: 73`, `Active: 73`, and a `Departments` object whose keys include `Unassigned` (for the blank-department employees) plus `Finance`, `HMA Management`, `HR`, `IT`, `SDP`, `Utility Staff`, summing to 73.

- [ ] **Step 8: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx
git commit -m "feat: wire Visual Model HR Dashboard departments/gender to real employee data"
```

---

### Task 2: Wire Attendance trend to real attendance data

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`

**Interfaces:**
- Consumes: `localAttendance.listMonthlySummaries({ year, month }) => Array<{ present_count, absent_count, leave_count }>` from `../../../services/localAttendance` (existing, unchanged).
- Produces: `buildAttendanceTrend() => { months: string[6], present: number[6], absent: number[6], leave: number[6] }`, used by Task 3's `HRDashboard` rewrite. `AttendanceTrend` now takes `{ months, present, absent, leave }` props.

- [ ] **Step 1: Add the `localAttendance` import**

Find (the line added in Task 1, Step 1):
```js
import { localEmployees } from '../../../services/localEmployees'
```
Replace with:
```js
import { localEmployees } from '../../../services/localEmployees'
import { localAttendance } from '../../../services/localAttendance'
```

- [ ] **Step 2: Replace `HR_ATTENDANCE_MONTHS`/`HR_ATTENDANCE` with a live builder function**

Find (lines 71–76):
```js
const HR_ATTENDANCE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const HR_ATTENDANCE = {
  present: [88, 85, 90, 87, 82, 91],
  absent:  [7,  9,  6,  8,  11, 6 ],
  leave:   [5,  6,  4,  5,  7,  3 ],
}
```
Replace with:
```js
/**
 * Live attendance trend for the trailing 6 calendar months (ending this month).
 * A month with no imported attendance data shows 0%, not a fabricated value.
 */
const buildAttendanceTrend = () => {
  const today = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    })
  }

  const present = []
  const absent = []
  const leave = []
  for (const m of months) {
    const rows = localAttendance.listMonthlySummaries({ year: m.year, month: m.month })
    if (rows.length === 0) {
      present.push(0)
      absent.push(0)
      leave.push(0)
      continue
    }
    let p = 0
    let a = 0
    let l = 0
    for (const r of rows) {
      const total = (r.present_count || 0) + (r.absent_count || 0) + (r.leave_count || 0)
      if (total === 0) continue
      p += (r.present_count || 0) / total
      a += (r.absent_count || 0) / total
      l += (r.leave_count || 0) / total
    }
    present.push(Math.round((p / rows.length) * 100))
    absent.push(Math.round((a / rows.length) * 100))
    leave.push(Math.round((l / rows.length) * 100))
  }

  return { months: months.map((m) => m.label), present, absent, leave }
}
```

- [ ] **Step 3: Make `AttendanceTrend` accept props, and fix the "On Leave" color**

Find (lines 259–281):
```js
/** Stacked area line – attendance trend */
const AttendanceTrend = () => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'line',
    data: {
      labels: HR_ATTENDANCE_MONTHS,
      datasets: [
        { label: 'Present %', data: HR_ATTENDANCE.present, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
        { label: 'Absent %',  data: HR_ATTENDANCE.absent,  borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)',  fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
        { label: 'On Leave %',data: HR_ATTENDANCE.leave,   borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',  fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%', font: { size: 11 } }, min: 0, max: 100 },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  }), [])
  return <canvas ref={ref} height={180} />
}
```
Replace with:
```js
/** Stacked area line – attendance trend */
const AttendanceTrend = ({ months, present, absent, leave }) => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Present %', data: present, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
        { label: 'Absent %',  data: absent,  borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)',  fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
        { label: 'On Leave %',data: leave,   borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.08)',  fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%', font: { size: 11 } }, min: 0, max: 100 },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  }), [months.join(), present.join(), absent.join(), leave.join()])
  return <canvas ref={ref} height={180} />
}
```

- [ ] **Step 4: Update `HRDashboard` to build and pass the real attendance trend**

Find (the module-level constants left after Task 1, Step 4):
```js
const avgAttendance   = Math.round(HR_ATTENDANCE.present.reduce((s, v) => s + v, 0) / HR_ATTENDANCE.present.length)
const latestPayroll   = HR_PAYROLL_TOTALS[HR_PAYROLL_TOTALS.length - 1]
```
Replace with (only `latestPayroll` stays module-level for now — Task 3 removes it):
```js
const latestPayroll   = HR_PAYROLL_TOTALS[HR_PAYROLL_TOTALS.length - 1]
```

Find (inside `HRDashboard`, right after the `departments`/`totalHeadcount`/`totalMale`/`totalFemale` lines added in Task 1, Step 4):
```js
  const departments = buildDepartments()
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)
```
Replace with:
```js
  const departments = buildDepartments()
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)
  const attendance = buildAttendanceTrend()
  const avgAttendance = Math.round(
    attendance.present.reduce((s, v) => s + v, 0) / attendance.present.length,
  )
```

Find (line 410, the `AttendanceTrend` render call):
```js
        <AttendanceTrend />
```
Replace with:
```js
        <AttendanceTrend
          months={attendance.months}
          present={attendance.present}
          absent={attendance.absent}
          leave={attendance.leave}
        />
```

- [ ] **Step 5: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/reports-analysis/VisualModelPage.jsx`

Run: `npx eslint src/modules/ems/reports-analysis/VisualModelPage.jsx 2>&1 | grep -i "buildAttendanceTrend\|AttendanceTrend\|avgAttendance"`
Expected: no output (no lint errors on the new code).

Run: `npx vite build`
Expected: succeeds.

- [ ] **Step 6: Verify `buildAttendanceTrend`'s month-window and aggregation logic**

```bash
cat > /tmp/verify_attendance.mjs << 'EOF'
globalThis.localStorage = (() => {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
})()

const { localAttendance } = await import(process.cwd() + '/src/services/localAttendance.js')

// Seed one fake monthly summary for the current month to prove aggregation works.
const today = new Date()
const year = today.getFullYear()
const month = today.getMonth() + 1
localStorage.setItem('hma_attendance_summaries', JSON.stringify([
  { employee_id: 'E1', year, month, present_count: 20, absent_count: 2, leave_count: 3 },
  { employee_id: 'E2', year, month, present_count: 22, absent_count: 1, leave_count: 2 },
]))

const rows = localAttendance.listMonthlySummaries({ year, month })
console.log('Rows for current month:', rows.length)

// Replicate the same aggregation buildAttendanceTrend uses, to confirm the math
let p = 0, a = 0, l = 0
for (const r of rows) {
  const total = r.present_count + r.absent_count + r.leave_count
  p += r.present_count / total
  a += r.absent_count / total
  l += r.leave_count / total
}
console.log('present%:', Math.round((p / rows.length) * 100))
console.log('absent%:', Math.round((a / rows.length) * 100))
console.log('leave%:', Math.round((l / rows.length) * 100))

// A month with no data at all (5 months ago) should return zero rows
const past = new Date(today.getFullYear(), today.getMonth() - 5, 1)
console.log(
  'Rows for 5-months-ago (expect 0):',
  localAttendance.listMonthlySummaries({ year: past.getFullYear(), month: past.getMonth() + 1 }).length,
)
EOF
node /tmp/verify_attendance.mjs
```
Expected: `Rows for current month: 2`, `present%: 84`, `absent%: 6`, `leave%: 10` (E1: 80/8/12, E2: 88/4/8, averaged and rounded), and `Rows for 5-months-ago (expect 0): 0`.

- [ ] **Step 7: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx
git commit -m "feat: wire Visual Model HR Dashboard attendance trend to real data"
```

---

### Task 3: Replace Payroll chart with a stat tile; remove Employment Type donut; finalize layout

**Files:**
- Modify: `hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx`

**Interfaces:**
- Consumes: `localEmployees.list({ pageSize })` (same as Task 1).
- Produces: `computeTotalMonthlyPayroll() => number`, used only within this file. No further consumers — this is the last task.

- [ ] **Step 1: Replace the Payroll and Employment Type mock constants with one payroll helper**

Find (lines 78–82):
```js
const HR_PAYROLL_MONTHS   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const HR_PAYROLL_TOTALS   = [1820000, 1850000, 1900000, 1880000, 1920000, 1960000]

const HR_EMPLOYMENT_TYPES = { 'Full-time': 58, 'Part-time': 12, 'Contract': 15, 'Intern': 10 }
const HR_EMPLOYMENT_COLORS = ['#1e40af', '#0891b2', '#7c3aed', '#059669']
```
Replace with:
```js
/** Live sum of current_salary across Active employees today (a snapshot, not a trend). */
const computeTotalMonthlyPayroll = () =>
  localEmployees
    .list({ pageSize: 1000 })
    .items.filter((e) => e.status === 'Active')
    .reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0)
```

- [ ] **Step 2: Remove the `PayrollBar` component entirely**

Find (lines 283–302):
```js
/** Bar – monthly payroll */
const PayrollBar = () => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'bar',
    data: {
      labels: HR_PAYROLL_MONTHS,
      datasets: [{ label: 'Payroll (₹)', data: HR_PAYROLL_TOTALS, backgroundColor: '#6366f1', borderRadius: 5, barThickness: 32 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ₹${fmtCompact(c.parsed.y)}` } } },
      scales: {
        y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => '₹' + fmtCompact(v), font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  }), [])
  return <canvas ref={ref} height={180} />
}

/** Doughnut – employment type */
const EmploymentDonut = () => {
  const ref = useRef(null)
  useChart(ref, (canvas) => new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(HR_EMPLOYMENT_TYPES),
      datasets: [{ data: Object.values(HR_EMPLOYMENT_TYPES), backgroundColor: HR_EMPLOYMENT_COLORS, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }],
    },
    options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } } } },
  }), [])
  return <canvas ref={ref} height={160} />
}
```
Replace with nothing (delete the block) — leave the blank line before `// ═══...─ STYLES ─...` as-is.

- [ ] **Step 3: Remove `latestPayroll` module constant; compute it live inside `HRDashboard`**

Find (the module-level line left after Task 2, Step 4):
```js
const latestPayroll   = HR_PAYROLL_TOTALS[HR_PAYROLL_TOTALS.length - 1]
```
Replace with nothing (delete this line entirely).

Find (inside `HRDashboard`, the block from Task 2, Step 4):
```js
  const departments = buildDepartments()
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)
  const attendance = buildAttendanceTrend()
  const avgAttendance = Math.round(
    attendance.present.reduce((s, v) => s + v, 0) / attendance.present.length,
  )
```
Replace with:
```js
  const departments = buildDepartments()
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0)
  const totalMale = departments.reduce((s, d) => s + d.male, 0)
  const totalFemale = departments.reduce((s, d) => s + d.female, 0)
  const attendance = buildAttendanceTrend()
  const avgAttendance = Math.round(
    attendance.present.reduce((s, v) => s + v, 0) / attendance.present.length,
  )
  const totalMonthlyPayroll = computeTotalMonthlyPayroll()
```

Find (the KPI row's Payroll card):
```js
      <KpiCard label="Monthly Payroll" value={`₹${fmtCompact(latestPayroll)}`} sub={`₹${fmt(latestPayroll)}`} icon="💰" accent="#6366f1" />
```
Replace with:
```js
      <KpiCard label="Monthly Payroll" value={`₹${fmtCompact(totalMonthlyPayroll)}`} sub={`₹${fmt(totalMonthlyPayroll)} · current snapshot`} icon="💰" accent="#6366f1" />
```

- [ ] **Step 4: Restructure the two chart rows — remove the Employment Type card, remove the Payroll Outflow card, put Departments and Attendance side by side**

Find (lines 386–415, the "Row 1" and "Row 2" two-col blocks):
```js
    {/* Row 1: Dept bar + Employment type donut */}
    <div style={S.twoCol}>
      <ChartCard title="Headcount by Department & Gender">
        <DeptBar departments={departments} />
      </ChartCard>
      <ChartCard title="Employment Type Breakdown">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <EmploymentDonut />
          {/* Totals under donut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
            {Object.entries(HR_EMPLOYMENT_TYPES).map(([type, count], i) => (
              <div key={type} style={{ background: HR_EMPLOYMENT_COLORS[i] + '15', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: HR_EMPLOYMENT_COLORS[i] }}>{count}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{type}</div>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>

    {/* Row 2: Attendance trend + Payroll bar */}
    <div style={S.twoCol}>
      <ChartCard title="Attendance Trend (%) — Last 6 Months">
        <AttendanceTrend
          months={attendance.months}
          present={attendance.present}
          absent={attendance.absent}
          leave={attendance.leave}
        />
      </ChartCard>
      <ChartCard title="Monthly Payroll Outflow — Last 6 Months">
        <PayrollBar />
      </ChartCard>
    </div>
```
Replace with:
```js
    {/* Row 1: Dept bar + Attendance trend */}
    <div style={S.twoCol}>
      <ChartCard title="Headcount by Department & Gender">
        <DeptBar departments={departments} />
      </ChartCard>
      <ChartCard title="Attendance Trend (%) — Last 6 Months">
        <AttendanceTrend
          months={attendance.months}
          present={attendance.present}
          absent={attendance.absent}
          leave={attendance.leave}
        />
      </ChartCard>
    </div>
```

- [ ] **Step 5: Lint and build**

Run: `cd hma-template/emsv1 && npx eslint --fix src/modules/ems/reports-analysis/VisualModelPage.jsx`

Run: `npx eslint src/modules/ems/reports-analysis/VisualModelPage.jsx 2>&1 | grep -i "HR_PAYROLL\|HR_EMPLOYMENT\|PayrollBar\|EmploymentDonut"`
Expected: no output — confirms no leftover references to the removed constants/components anywhere in the file (if this greps a hit, some usage was missed — find it and remove it before continuing).

Run: `npx vite build`
Expected: `✓ built in` with no errors. If the build fails referencing `HR_PAYROLL_MONTHS`, `HR_PAYROLL_TOTALS`, `HR_EMPLOYMENT_TYPES`, `HR_EMPLOYMENT_COLORS`, `PayrollBar`, or `EmploymentDonut`, a reference to the removed code was missed in Step 4 or earlier — search the file for that exact name and remove/replace it.

- [ ] **Step 6: Verify `computeTotalMonthlyPayroll` against real seed data**

```bash
cat > /tmp/verify_payroll.mjs << 'EOF'
globalThis.localStorage = (() => {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
})()
if (!globalThis.crypto.randomUUID) {
  let i = 0
  globalThis.crypto.randomUUID = () => `uuid-${i++}`
}

const { seedLocalEmployees } = await import(process.cwd() + '/src/services/seedLocalEmployees.js')
const { localEmployees } = await import(process.cwd() + '/src/services/localEmployees.js')

seedLocalEmployees()
const total = localEmployees
  .list({ pageSize: 1000 })
  .items.filter((e) => e.status === 'Active')
  .reduce((s, e) => s + (parseFloat(e.current_salary) || 0), 0)
console.log('Total monthly payroll (real seed data):', total)
EOF
node /tmp/verify_payroll.mjs
```
Expected: `Total monthly payroll (real seed data): 0` — this is correct per the Global Constraints note (all 73 seeded employees currently have `current_salary: 0`), not a bug.

- [ ] **Step 7: Manual browser check — final end-to-end look at the whole page**

1. Start the dev server if not running: `npm start` (note the printed port).
2. Navigate to the dev server root, dev-login (any role with Reports & Analysis access — CEO/Heads/HR/Finance/Project Officer all have View access per the RBAC table in `docs/CLAUDE.md`).
3. Navigate to `.../#/ems/reports-analysis/visual-model`.
4. Confirm the "HR Dashboard" view is selected by default (it is — `VisualModelPage`'s `section` state defaults to `'hr'`).
5. Confirm: Total Employees KPI shows a real headcount (73 with unmodified seed data); Gender Split KPI shows real Male/Female counts; Monthly Payroll KPI shows `₹0` (expected, see above); Avg Attendance shows a computed percentage (likely `0%` unless attendance has been imported for recent months — expected, not a bug).
6. Confirm only two chart cards remain in the first row: "Headcount by Department & Gender" and "Attendance Trend (%) — Last 6 Months" — no "Employment Type Breakdown" or "Monthly Payroll Outflow" cards.
7. Confirm the Department Summary table at the bottom lists real department names (`Finance`, `HMA Management`, `HR`, `IT`, `SDP`, `Utility Staff`, `Unassigned`) with real headcounts, not the old 7 mock department names.

- [ ] **Step 8: Commit**

```bash
git add hma-template/emsv1/src/modules/ems/reports-analysis/VisualModelPage.jsx
git commit -m "feat: replace Visual Model Payroll chart with real stat tile, remove Employment Type widget"
```
