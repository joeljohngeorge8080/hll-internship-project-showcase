# Super Forecasting — CEO Executive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Profit / Loss vs LSGB" to "Super Forecasting", fold Expense Pools' HR/Admin/Core expenses (and their `lsgb_revenue_pct` tags) into the expense math, add a reverse-calculator for how much new project value is needed to cut LSGB borrowing by a target %, and expand the page into a plain-language CEO command-center covering expenses/projects/HR health.

**Architecture:** File rename (`LsgbDependencyPage.jsx` → `SuperForecastingPage.jsx`) with the exported `computeLsgbTotals` extended (new `poolExpenses`/`projectCount` fields, same signature, still consumed unmodified by `ProfitLossWidget.jsx` once its import path is fixed) plus one new exported pure function `computeLsgbReductionPlan`. The rest of the new CEO-glance sections (expense health, project stats, HR health) are computed inline via `useMemo` in the page component, matching this file's existing pattern of page-local aggregation helpers.

**Tech Stack:** React 19, CoreUI React, plain JS services (`localStorage`-backed). No test runner configured — verification is `npm run build` + `npm run lint` + manual browser verification via the dev server.

## Global Constraints

- `computeLsgbTotals`'s signature (`(rangeStart, rangeEnd) => {...}`) must not change — `ProfitLossWidget.jsx` calls it directly.
- `ownRevenue` (`shares + hrRevenueTotal`) is never modified by this work — only `expenses` grows (to include Expense Pool amounts).
- No changes to `localOrgPool.js` — all new aggregation is page-local, matching how `buildOperatingActuals()` already works today.
- Every new number must come from real data — no hardcoded example figures anywhere in the new sections.
- "Do our projects earn enough?" (§6 of the design) must reuse the same `totals.isProfit` flag as the main verdict — never a second, independently-thresholded yes/no that could contradict the top banner.
- Kid-simple language: no unexplained percentages, no dense multi-column tables, no jargon column headers, in every new/changed section of this page (not the Dashboard widget, which is out of scope).

---

## File Structure

- **Create:** `src/modules/ems/reports-analysis/SuperForecastingPage.jsx` (full new content, replaces `LsgbDependencyPage.jsx`)
- **Delete:** `src/modules/ems/reports-analysis/LsgbDependencyPage.jsx`
- **Modify:** `src/routes/ems.routes.js` — import path, route path, nav-facing name
- **Modify:** `src/modules/ems/_nav.jsx` — nav label + `to`
- **Modify:** `src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx` — fix import path only (one line)

---

## Task 1: Create `SuperForecastingPage.jsx` with corrected math + new calculator + new sections

**Files:**
- Create: `src/modules/ems/reports-analysis/SuperForecastingPage.jsx`

**Interfaces:**
- Produces: `export const computeLsgbTotals = (rangeStart, rangeEnd) => {...}` — same signature as today, return object gains two new fields: `poolExpenses: { totalAmount, lsgbTaggedAmount, count }` and `projectCount: number` (all existing fields — `monthRows`, `hrRevenueTotal`, `operating`, `project`, `shares`, `expenses`, `ownRevenue`, `lsgbNeed`, `surplus`, `lsgbSharePct`, `isProfit` — unchanged in meaning; `expenses` now includes `poolExpenses.totalAmount`).
- Produces: `export const computeLsgbReductionPlan = (totals, targetPct) => { avgCombinedPct, baseAmount, targetReduction, neededNewProjectValue, avgProjectSize, approxProjectsNeeded }` — pure function, no I/O beyond reading `localProjects`.
- Produces: `export default SuperForecastingPage` — the page component.
- Consumes: `localOrgPool.getHRExpenses()/getAdminExpenses()/getCoreExpenses()/getMonthlyHRPoolBudgetSummary()/getMonthlyAdminPoolBudgetSummary()/getMonthlyCorePoolBudgetSummary()` (all pre-existing, unmodified), `localAdminExpenses`, `localGeneralExpenses`, `localRecruitments`, `localInternships`, `localProjects` (incl. `getStats()`), `localLsgb`, `computeEffectivePoolMonthly`.

- [ ] **Step 1: Write the complete file**

```jsx
/**
 * SuperForecastingPage.jsx
 * ────────────────────────
 * EMS › Reports & Analysis › Super Forecasting  (formerly "Profit / Loss vs LSGB")
 *
 * CEO-facing command center answering: "Will the company be in profit or
 * loss — will expenses have to be taken from LSGB revenue? How many more
 * projects would close that gap? Are expenses, projects, and HR healthy?"
 *
 *   Money We Spent  = HR & Admin operating expenses (localAdminExpenses actuals,
 *                      forecast for months without data) + every project's
 *                      planned monthly expense (monthly_plan) + Expense Pools'
 *                      HR/Admin/Core expenses (localOrgPool — including any
 *                      expense explicitly tagged as drawing from LSGB Revenue)
 *   Money We Earned  = HR revenue (Recruitment/Training/Internship) + project
 *                      pool shares (5% Admin + 5% HR + 5% Core via monthly plans)
 *   Money We Had to
 *   Borrow (LSGB)    = Money We Spent − Money We Earned (when positive, that
 *                      money must be drawn from LSGB sanctions)
 *
 * Verdict: borrowing LESS from LSGB = PROFIT (good) · borrowing MORE = LOSS (bad).
 *
 * Known limitation (not solved here): localAdminExpenses (vendor contracts,
 * edited via the "Forecast Expense" tab) and localOrgPool's HR/Admin/Core
 * expenses (Expense Pools cards) are two disconnected data stores that may
 * double-record the same real expense — nothing in the code ties them
 * together. They're shown as two separate lines, not deduplicated.
 */

import React, { useState, useMemo } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CBadge,
  CFormSelect,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CTableFoot,
} from '@coreui/react'
import { localAdminExpenses } from '../../../services/localAdminExpenses'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import { localRecruitments } from '../../../services/localRecruitments'
import { localInternships } from '../../../services/localInternships'
import { localProjects } from '../../../services/localProjects'
import { localLsgb } from '../../../services/localLsgb'
import { localOrgPool } from '../../../services/localOrgPool'
import { computeEffectivePoolMonthly } from '../../../services/monthlyApportionment'

// ── Formatters & month helpers ────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

const monthsBetween = (start, end) => {
  const months = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 60) {
    months.push(cur)
    cur = addMonths(cur, 1)
    guard += 1
  }
  return months
}

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const CURRENT_MONTH = monthKeyOf(new Date())
// Pickable window: 12 months back … 12 months ahead of today.
const PICKER_MONTHS = monthsBetween(addMonths(CURRENT_MONTH, -12), addMonths(CURRENT_MONTH, 12))

// ── HR & Admin operating expense per month ────────────────────────────────────
// Same records the Forecast Expense tab reads/writes: localAdminExpenses'
// monthly_actuals plus localGeneralExpenses' Outsourced Services category.

const buildOperatingActuals = () => {
  const byMonth = {}

  localAdminExpenses.list({ status: 'Active' }).forEach((entry) => {
    Object.entries(entry.monthly_actuals || {}).forEach(([m, amount]) => {
      byMonth[m] = (byMonth[m] || 0) + (parseFloat(amount) || 0)
    })
  })

  const outsourcedCat = localGeneralExpenses.categories
    .list()
    .find((c) => c.name === 'Outsourced Services')
  if (outsourcedCat) {
    const { items } = localGeneralExpenses.expenses.list({
      category_id: outsourcedCat.id,
      page_size: 500,
    })
    items.forEach((e) => {
      const m = `${e.year}-${String(e.month).padStart(2, '0')}`
      byMonth[m] = (byMonth[m] || 0) + (parseFloat(e.actual_amount) || 0)
    })
  }

  return byMonth
}

/** Recency-weighted average (oldest ×1 … newest ×n) of known month totals. */
const forecastFrom = (knownTotals) => {
  const n = knownTotals.length
  if (n === 0) return 0
  const weightSum = (n * (n + 1)) / 2
  return Math.round(knownTotals.reduce((acc, v, i) => acc + v * (i + 1), 0) / weightSum)
}

/**
 * Sums Expense Pools' HR/Admin/Core expenses (localOrgPool) within a date
 * range — the only expense records that carry an explicit lsgb_revenue_pct
 * tag. Page-local helper (no changes needed in localOrgPool.js), same
 * pattern as buildOperatingActuals() above.
 */
const buildPoolExpenseTotals = (rangeStart, rangeEnd) => {
  const all = [
    ...localOrgPool.getHRExpenses(),
    ...localOrgPool.getAdminExpenses(),
    ...localOrgPool.getCoreExpenses(),
  ]
  const inRange = all.filter((e) => {
    const m = (e.date || '').slice(0, 7)
    return m >= rangeStart && m <= rangeEnd
  })
  const totalAmount = inRange.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const lsgbTaggedAmount = inRange.reduce((s, e) => {
    const pct = parseFloat(e.lsgb_revenue_pct) || 0
    return s + (parseFloat(e.amount) || 0) * (pct / 100)
  }, 0)
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    lsgbTaggedAmount: Math.round(lsgbTaggedAmount * 100) / 100,
    count: inRange.length,
  }
}

/**
 * Computes the full Profit/Loss picture for a date range: per-month expense
 * rows (with forecast fallback for months without actuals) plus period totals
 * and the profit/loss verdict. Pulled out of the page component so both the
 * page and the dashboard's Profit/Loss widget can call the exact same logic.
 */
export const computeLsgbTotals = (rangeStart, rangeEnd) => {
  const months = monthsBetween(rangeStart, rangeEnd)
  const operatingActuals = buildOperatingActuals()
  const projects = localProjects
    .list({ pageSize: 1000 })
    .items.filter((p) => p.monthly_plan?.length > 0)

  const knownMonths = Object.keys(operatingActuals).sort()
  const knownTotals = knownMonths.map((m) => operatingActuals[m])
  const operatingForecast = forecastFrom(knownTotals)
  const lastKnown = knownMonths[knownMonths.length - 1] || ''

  const monthRows = months.map((m) => {
    const hasActual = operatingActuals[m] !== undefined && m <= lastKnown
    const operatingExpense = hasActual ? operatingActuals[m] : operatingForecast

    let projectExpense = 0
    let shareRevenue = 0
    projects.forEach((p) => {
      const entry = p.monthly_plan.find((e) => e.month === m)
      if (!entry) return
      projectExpense += entry.total || 0
      shareRevenue +=
        computeEffectivePoolMonthly(p, 'admin', m) +
        computeEffectivePoolMonthly(p, 'hr', m) +
        computeEffectivePoolMonthly(p, 'core', m)
    })

    const totalExpense = operatingExpense + projectExpense
    const lsgbNeed = Math.max(0, totalExpense - shareRevenue)
    return {
      month: m,
      operatingExpense,
      isForecast: !hasActual,
      projectExpense,
      shareRevenue,
      totalExpense,
      lsgbNeed,
    }
  })

  const rec = localRecruitments.list()
  const recruitment = rec
    .filter((r) => (r.activity_type || 'recruitment') === 'recruitment')
    .reduce((s, r) => s + (r.amount_received || 0), 0)
  const training = rec
    .filter((r) => r.activity_type === 'training')
    .reduce((s, r) => s + (r.amount_received || 0), 0)
  const internship = localInternships.list().reduce((s, r) => s + (r.amount_received || 0), 0)
  const hrRevenueTotal = recruitment + training + internship

  const poolExpenses = buildPoolExpenseTotals(rangeStart, rangeEnd)

  const operating = monthRows.reduce((s, r) => s + r.operatingExpense, 0)
  const project = monthRows.reduce((s, r) => s + r.projectExpense, 0)
  const shares = monthRows.reduce((s, r) => s + r.shareRevenue, 0)
  const expenses = operating + project + poolExpenses.totalAmount
  const ownRevenue = shares + hrRevenueTotal
  const lsgbNeed = Math.max(0, expenses - ownRevenue)
  const surplus = Math.max(0, ownRevenue - expenses)
  const lsgbSharePct = expenses > 0 ? (lsgbNeed / expenses) * 100 : 0

  return {
    monthRows,
    hrRevenueTotal,
    operating,
    project,
    poolExpenses,
    projectCount: projects.length,
    shares,
    expenses,
    ownRevenue,
    lsgbNeed,
    surplus,
    lsgbSharePct,
    isProfit: lsgbNeed === 0,
  }
}

/**
 * Reverse-calculator: how much new project value (and roughly how many new
 * projects) would be needed to cut LSGB borrowing — or grow an existing
 * surplus — by targetPct%. avgCombinedPct is a weighted average (by project
 * value) of each active project's own admin_pct+hr_pct+core_pct, so this
 * reflects real project-level rates rather than assuming every project uses
 * the 5+5+5 default.
 */
export const computeLsgbReductionPlan = (totals, targetPct) => {
  const projects = localProjects
    .list({ pageSize: 1000 })
    .items.filter((p) => p.status === 'active' || p.status === 'ongoing')

  const totalValue = projects.reduce((s, p) => s + (p.project_value || p.project_valuation || 0), 0)
  const weightedPctSum = projects.reduce((s, p) => {
    const pv = p.project_value || p.project_valuation || 0
    const combinedPct = (p.admin_pct ?? 5) + (p.hr_pct ?? 5) + (p.core_pct ?? 5)
    return s + pv * combinedPct
  }, 0)
  const avgCombinedPct = totalValue > 0 ? weightedPctSum / totalValue : 15

  const baseAmount = totals.isProfit ? totals.surplus : totals.lsgbNeed
  const targetReduction = baseAmount * ((targetPct || 0) / 100)
  const neededNewProjectValue = avgCombinedPct > 0 ? targetReduction / (avgCombinedPct / 100) : 0
  const avgProjectSize = projects.length > 0 ? totalValue / projects.length : 0
  const approxProjectsNeeded =
    avgProjectSize > 0 ? Math.ceil(neededNewProjectValue / avgProjectSize) : null

  return {
    avgCombinedPct: Math.round(avgCombinedPct * 100) / 100,
    baseAmount: Math.round(baseAmount * 100) / 100,
    targetReduction: Math.round(targetReduction * 100) / 100,
    neededNewProjectValue: Math.round(neededNewProjectValue * 100) / 100,
    avgProjectSize: Math.round(avgProjectSize * 100) / 100,
    approxProjectsNeeded,
  }
}

/** Plain OK/Watch/Over Budget health label for one pool's monthly summary — same
 *  85%/100% threshold convention already used by GeneralExpenseWidget.jsx. */
const poolHealth = (summary) => {
  if (!summary || summary.totalMonthlyBudget <= 0) return { label: 'No Data', color: 'secondary' }
  const pct = (summary.usedThisMonth / summary.totalMonthlyBudget) * 100
  if (pct > 100) return { label: 'Over Budget', color: 'danger' }
  if (pct > 85) return { label: 'Watch', color: 'warning' }
  return { label: 'OK', color: 'success' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SuperForecastingPage = () => {
  // Default period ≈ 1 year: Jan → Dec of the current year (diagram: "maybe 1 year").
  const [rangeStart, setRangeStart] = useState(`${new Date().getFullYear()}-01`)
  const [rangeEnd, setRangeEnd] = useState(`${new Date().getFullYear()}-12`)
  const [targetPct, setTargetPct] = useState(10)

  // HR revenue has no per-month received date in its records, so — like the
  // Revenue tab — it counts once as a period-level total.
  const hrRevenue = useMemo(() => {
    const rec = localRecruitments.list()
    const recruitment = rec
      .filter((r) => (r.activity_type || 'recruitment') === 'recruitment')
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const training = rec
      .filter((r) => r.activity_type === 'training')
      .reduce((s, r) => s + (r.amount_received || 0), 0)
    const internship = localInternships.list().reduce((s, r) => s + (r.amount_received || 0), 0)
    return { recruitment, training, internship, total: recruitment + training + internship }
  }, [])

  // LSGB actuals: sanctions and withdrawals inside the selected period.
  const lsgb = useMemo(() => {
    const summary = localLsgb.getSummary()
    const withdrawnInPeriod = localLsgb
      .listWithdrawals()
      .filter((w) => {
        const m = (w.withdrawal_date || '').slice(0, 7)
        return m >= rangeStart && m <= rangeEnd
      })
      .reduce((s, w) => s + (parseFloat(w.amount) || 0), 0)
    return { ...summary, withdrawnInPeriod }
  }, [rangeStart, rangeEnd])

  // ── Period totals & verdict ─────────────────────────────────────────────────
  const { monthRows, ...totals } = useMemo(
    () => computeLsgbTotals(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  )
  const isProfit = totals.isProfit

  const reductionPlan = useMemo(
    () => computeLsgbReductionPlan(totals, targetPct),
    [totals, targetPct],
  )

  const projectStats = useMemo(() => localProjects.getStats(), [])

  const expenseGlance = useMemo(() => {
    const operatingCount = localAdminExpenses.list({ status: 'Active' }).length
    return {
      operatingCount,
      poolCount: totals.poolExpenses.count,
      projectCount: totals.projectCount,
      hr: poolHealth(localOrgPool.getMonthlyHRPoolBudgetSummary()),
      admin: poolHealth(localOrgPool.getMonthlyAdminPoolBudgetSummary()),
      core: poolHealth(localOrgPool.getMonthlyCorePoolBudgetSummary()),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.poolExpenses.count, totals.projectCount])

  const hrHealth = useMemo(() => {
    let hrOperatingCost = 0
    localAdminExpenses
      .list({ status: 'Active' })
      .filter((e) => e.group === 'HR')
      .forEach((entry) => {
        Object.entries(entry.monthly_actuals || {}).forEach(([m, amount]) => {
          if (m >= rangeStart && m <= rangeEnd) hrOperatingCost += parseFloat(amount) || 0
        })
      })
    const hrPoolCost = localOrgPool
      .getHRExpenses()
      .filter((e) => {
        const m = (e.date || '').slice(0, 7)
        return m >= rangeStart && m <= rangeEnd
      })
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const totalCost = Math.round((hrOperatingCost + hrPoolCost) * 100) / 100
    const coveragePct = totalCost > 0 ? Math.min(100, Math.round((hrRevenue.total / totalCost) * 100)) : null
    return { totalCost, coveragePct }
  }, [rangeStart, rangeEnd, hrRevenue.total])

  const handleStart = (v) => {
    setRangeStart(v)
    if (v > rangeEnd) setRangeEnd(v)
  }
  const handleEnd = (v) => {
    setRangeEnd(v)
    if (v < rangeStart) setRangeStart(v)
  }

  return (
    <>
      {/* Header + period picker */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Super Forecasting</h4>
          <p className="text-body-secondary mb-0 small">
            Will the money we earn cover the money we spend, or do we need to borrow from LSGB?
            Borrowing <strong className="text-success">less</strong> is good · borrowing{' '}
            <strong className="text-danger">more</strong> is bad.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-end">
          <div>
            <CFormLabel className="small fw-semibold mb-1">From</CFormLabel>
            <CFormSelect
              size="sm"
              value={rangeStart}
              onChange={(e) => handleStart(e.target.value)}
              style={{ width: 140 }}
            >
              {PICKER_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div>
            <CFormLabel className="small fw-semibold mb-1">To</CFormLabel>
            <CFormSelect
              size="sm"
              value={rangeEnd}
              onChange={(e) => handleEnd(e.target.value)}
              style={{ width: 140 }}
            >
              {PICKER_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </CFormSelect>
          </div>
        </div>
      </div>

      {/* Verdict banner */}
      <CCard
        className="border-0 shadow-sm mb-4"
        style={{
          background: isProfit ? 'rgba(6,214,160,0.08)' : 'rgba(255,107,107,0.08)',
          border: `1px solid ${isProfit ? 'rgba(6,214,160,0.3)' : 'rgba(255,107,107,0.3)'}`,
          borderRadius: 12,
        }}
      >
        <CCardBody className="d-flex align-items-center gap-3 py-3">
          <div style={{ fontSize: '2.2rem' }}>{isProfit ? '🎉' : '😟'}</div>
          <div className="flex-grow-1">
            <div
              className="fw-bold"
              style={{ fontSize: '1.15rem', color: isProfit ? '#06d6a0' : '#ff6b6b' }}
            >
              {isProfit
                ? 'We Made Money! Nothing needs to be borrowed from LSGB.'
                : `We Spent More Than We Earned — ${fmt(totals.lsgbNeed)} had to be borrowed from LSGB.`}
            </div>
            <div className="small text-body-secondary">
              {monthLabel(rangeStart)} – {monthLabel(rangeEnd)} · Money We Spent{' '}
              {fmt(totals.expenses)} vs Money We Earned {fmt(totals.ownRevenue)}
              {isProfit
                ? ` · extra money saved ${fmt(totals.surplus)}`
                : ` · ${totals.lsgbSharePct.toFixed(0)}% of what we spent came from LSGB`}
            </div>
            {totals.poolExpenses.lsgbTaggedAmount > 0 && (
              <div className="small text-body-secondary mt-1">
                Of which {fmt(totals.poolExpenses.lsgbTaggedAmount)} was already tagged as{' '}
                <strong>LSGB Revenue</strong> on expenses in Expense Pools.
              </div>
            )}
          </div>
        </CCardBody>
      </CCard>

      {/* Can we cut our LSGB borrowing? */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">
          Can We Cut Our LSGB Borrowing?
        </CCardHeader>
        <CCardBody>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
            <span>Cut borrowing by</span>
            <CInputGroup size="sm" style={{ width: 90 }}>
              <CFormInput
                type="number"
                min="0"
                max="100"
                value={targetPct}
                onChange={(e) => setTargetPct(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ textAlign: 'right', fontWeight: 600 }}
              />
              <CInputGroupText>%</CInputGroupText>
            </CInputGroup>
          </div>
          {reductionPlan.avgProjectSize > 0 ? (
            <>
              <div className="fs-6">
                To cut LSGB borrowing by {targetPct}%, you need about{' '}
                <strong className="text-success">{fmt(reductionPlan.neededNewProjectValue)}</strong>{' '}
                in new project value — roughly{' '}
                <strong className="text-success">
                  {reductionPlan.approxProjectsNeeded} new project
                  {reductionPlan.approxProjectsNeeded === 1 ? '' : 's'}
                </strong>
                , based on your average project size of {fmt(reductionPlan.avgProjectSize)}.
              </div>
              <div className="text-body-secondary small mt-2">
                Assumes the new project(s) run for this whole period, and earn pool-cut money at
                your current average rate of {reductionPlan.avgCombinedPct}% of project value.
              </div>
            </>
          ) : (
            <div className="text-body-secondary">
              Add at least one active project to calculate this.
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Headline cards */}
      <CRow className="g-3 mb-4">
        {[
          {
            label: 'Money We Spent',
            value: totals.expenses,
            color: 'danger',
            sub: `Operating ${fmt(totals.operating)} + Projects ${fmt(totals.project)} + Expense Pools ${fmt(totals.poolExpenses.totalAmount)}`,
          },
          {
            label: 'Money We Earned',
            value: totals.ownRevenue,
            color: 'success',
            sub: `Project shares ${fmt(totals.shares)} + HR revenue ${fmt(hrRevenue.total)}`,
          },
          {
            label: 'Money We Had to Borrow',
            value: totals.lsgbNeed,
            color: totals.lsgbNeed > 0 ? 'danger' : 'success',
            sub: totals.lsgbNeed > 0 ? 'Not covered by what we earned' : 'Fully self-funded',
          },
          {
            label: 'LSGB Withdrawn (period)',
            value: lsgb.withdrawnInPeriod,
            color: 'warning',
            sub: `Sanctioned ${fmt(lsgb.totalSanctioned)} · remaining ${fmt(lsgb.remaining)}`,
          },
        ].map((card) => (
          <CCol key={card.label} xs={6} lg={3}>
            <CCard className={`border-top border-top-${card.color} border-3 h-100`}>
              <CCardBody className="py-3">
                <div className={`fw-bold fs-5 text-${card.color}`}>{fmt(card.value)}</div>
                <div className="small text-body-secondary">{card.label}</div>
                <div className="text-body-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                  {card.sub}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Expenses at a Glance */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">Expenses at a Glance</CCardHeader>
        <CCardBody>
          <CRow className="g-3 mb-3">
            {[
              { label: 'Operating Contracts', value: expenseGlance.operatingCount },
              { label: 'Expense Pool Entries', value: expenseGlance.poolCount },
              { label: 'Projects with a Plan', value: expenseGlance.projectCount },
            ].map((s) => (
              <CCol key={s.label} xs={6} md={4}>
                <div className="border rounded-3 p-3 text-center h-100">
                  <div className="fw-bold fs-5">{s.value}</div>
                  <div className="small text-body-secondary">{s.label}</div>
                </div>
              </CCol>
            ))}
          </CRow>
          <div className="fw-semibold mb-2 small">Is spending under control this month?</div>
          <div className="d-flex flex-wrap gap-3">
            {[
              { label: 'HR', health: expenseGlance.hr },
              { label: 'Admin', health: expenseGlance.admin },
              { label: 'Core', health: expenseGlance.core },
            ].map((p) => (
              <div key={p.label} className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2">
                <span className="fw-semibold">{p.label}</span>
                <CBadge color={p.health.color} shape="rounded-pill">
                  {p.health.label}
                </CBadge>
              </div>
            ))}
          </div>
        </CCardBody>
      </CCard>

      {/* Projects at a Glance */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">Projects at a Glance</CCardHeader>
        <CCardBody>
          <CRow className="g-3 mb-3">
            {[
              { label: 'Running Now', value: projectStats.ongoing, color: 'success' },
              { label: 'Approved', value: projectStats.approved, color: 'info' },
              { label: 'In Pipeline', value: projectStats.pipeline, color: 'secondary' },
              { label: 'Completed', value: projectStats.completed, color: 'primary' },
            ].map((s) => (
              <CCol key={s.label} xs={6} md={3}>
                <div className="border rounded-3 p-3 text-center h-100">
                  <div className={`fw-bold fs-5 text-${s.color}`}>{s.value}</div>
                  <div className="small text-body-secondary">{s.label}</div>
                </div>
              </CCol>
            ))}
          </CRow>
          <div className="fs-6">
            Your projects earned <strong className="text-success">{fmt(totals.shares)}</strong> in
            pool-cut money this period.
          </div>
          <div className="mt-2">
            Do our projects earn enough?{' '}
            {isProfit ? (
              <CBadge color="success" shape="rounded-pill">
                Yes
              </CBadge>
            ) : (
              <>
                <CBadge color="danger" shape="rounded-pill">
                  Not yet
                </CBadge>
                <span className="text-body-secondary small ms-2">
                  See "Can We Cut Our LSGB Borrowing?" above for how many more projects would close
                  the gap.
                </span>
              </>
            )}
          </div>
        </CCardBody>
      </CCard>

      {/* How Is HR Doing? */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">How Is HR Doing?</CCardHeader>
        <CCardBody>
          {hrHealth.totalCost > 0 ? (
            <div className="fs-6">
              HR earned <strong className="text-success">{fmt(hrRevenue.total)}</strong> and cost{' '}
              <strong className="text-danger">{fmt(hrHealth.totalCost)}</strong> — HR covers{' '}
              <strong>{hrHealth.coveragePct}%</strong> of its own cost.
            </div>
          ) : (
            <div className="text-body-secondary">HR has no recorded cost this period.</div>
          )}
          <div className="text-body-secondary small mt-2">
            Recruitment {fmt(hrRevenue.recruitment)} · Training {fmt(hrRevenue.training)} ·
            Internship {fmt(hrRevenue.internship)}
          </div>
        </CCardBody>
      </CCard>

      {/* Month-by-month breakdown — simplified */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">Month-by-Month</CCardHeader>
        <CCardBody className="p-0">
          <div style={{ overflowX: 'auto' }}>
            <CTable small hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Month</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Money We Spent</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Money We Earned</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Status</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {monthRows.map((r) => (
                  <CTableRow key={r.month}>
                    <CTableDataCell className="fw-semibold">
                      {monthLabel(r.month)}
                      {r.isForecast && (
                        <span className="text-body-secondary fw-normal ms-1" style={{ fontSize: '0.72rem' }}>
                          (estimate)
                        </span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">{fmt(r.totalExpense)}</CTableDataCell>
                    <CTableDataCell className="text-end text-success">
                      {r.shareRevenue > 0 ? fmt(r.shareRevenue) : '—'}
                    </CTableDataCell>
                    <CTableDataCell className="text-center" style={{ fontSize: '1.1rem' }}>
                      {r.lsgbNeed > 0 ? '⚠️' : '✅'}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
              <CTableFoot color="light">
                <CTableRow className="fw-bold">
                  <CTableDataCell>Total</CTableDataCell>
                  <CTableDataCell className="text-end">{fmt(totals.expenses)}</CTableDataCell>
                  <CTableDataCell className="text-end text-success">
                    {fmt(totals.ownRevenue)}
                  </CTableDataCell>
                  <CTableDataCell className="text-center" style={{ fontSize: '1.1rem' }}>
                    {isProfit ? '✅' : '⚠️'}
                  </CTableDataCell>
                </CTableRow>
              </CTableFoot>
            </CTable>
          </div>
        </CCardBody>
      </CCard>
    </>
  )
}

export default SuperForecastingPage
```

- [ ] **Step 2: Delete the old file**

```bash
git rm src/modules/ems/reports-analysis/LsgbDependencyPage.jsx
```

- [ ] **Step 3: Verify build**

Run: `npm_config_prefix=<scratch-npm-prefix-dir> npm run build`
Expected: will FAIL at this point — `ems.routes.js` and `ProfitLossWidget.jsx` still import the old path. That's expected until Task 2. Confirm the only errors are unresolved-import errors referencing `LsgbDependencyPage`, not syntax errors in the new file.

---

## Task 2: Update route, nav, and the Dashboard widget's import

**Files:**
- Modify: `src/routes/ems.routes.js`
- Modify: `src/modules/ems/_nav.jsx`
- Modify: `src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx`

**Interfaces:**
- Consumes: `SuperForecastingPage` default export, `computeLsgbTotals` named export (Task 1).

- [ ] **Step 1: Update the route**

Change (`src/routes/ems.routes.js`, near the top where lazy imports are declared — find the existing `LsgbDependencyPage` import line and update it):

```js
const LsgbDependencyPage = React.lazy(() => import('../modules/ems/reports-analysis/LsgbDependencyPage'))
```
to:
```js
const SuperForecastingPage = React.lazy(() => import('../modules/ems/reports-analysis/SuperForecastingPage'))
```

Change:
```js
  {
    path: '/ems/reports-analysis/lsgb-dependency',
    name: 'Profit / Loss vs LSGB',
    element: LsgbDependencyPage,
    module: MODULE.REPORTS,
  },
```
to:
```js
  {
    path: '/ems/reports-analysis/super-forecasting',
    name: 'Super Forecasting',
    element: SuperForecastingPage,
    module: MODULE.REPORTS,
  },
```

- [ ] **Step 2: Update the nav entry**

Change (`src/modules/ems/_nav.jsx`):
```jsx
      { component: CNavItem, name: 'Visual Model', to: '/ems/reports-analysis/visual-model' },
      {
        component: CNavItem,
        name: 'Profit / Loss vs LSGB',
        to: '/ems/reports-analysis/lsgb-dependency',
      },
```
to:
```jsx
      { component: CNavItem, name: 'Visual Model', to: '/ems/reports-analysis/visual-model' },
      {
        component: CNavItem,
        name: 'Super Forecasting',
        to: '/ems/reports-analysis/super-forecasting',
      },
```

- [ ] **Step 3: Fix the Dashboard widget's import path**

Change (`src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx`):
```js
import { computeLsgbTotals } from '../../reports-analysis/LsgbDependencyPage'
```
to:
```js
import { computeLsgbTotals } from '../../reports-analysis/SuperForecastingPage'
```

(No other change to this widget — its own labels/behavior are out of scope per the design spec; it keeps working unmodified since `computeLsgbTotals`'s signature and all fields it reads — `expenses`, `ownRevenue`, `isProfit`, `surplus`, `lsgbNeed`, `lsgbSharePct` — are unchanged.)

- [ ] **Step 4: Verify build**

Run: `npm_config_prefix=<scratch-npm-prefix-dir> npm run build`
Expected: clean build, no unresolved-import errors.

- [ ] **Step 5: Verify lint**

Run: `npx eslint src/modules/ems/reports-analysis/SuperForecastingPage.jsx src/routes/ems.routes.js src/modules/ems/_nav.jsx src/modules/ems/dashboard/widgets/ProfitLossWidget.jsx`
Expected: no new errors (check any reported errors against what the equivalent lines showed before this change, if any pre-existing baseline errors exist in these files).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rename Profit/Loss vs LSGB to Super Forecasting, add CEO dashboard sections

Folds Expense Pools' HR/Admin/Core expenses (with lsgb_revenue_pct tags)
into the expense totals, adds a reverse-calculator for how much new
project value cuts LSGB borrowing by a target %, and expands the page
with plain-language expense/project/HR health sections."
```

---

## Task 3: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `(nohup npm run start -- --port 5183 --strictPort > /tmp/dev-server.log 2>&1 &)`
Run: `timeout 30 bash -c 'until curl -sf http://localhost:5183 >/dev/null; do sleep 1; done' && echo UP`

- [ ] **Step 2: Navigate and verify the rename**

Dev-login as CEO (or HR — either has `MODULE.REPORTS` view access; check `src/constants/permissions.js` if unsure which roles can see it). Click through the sidebar to Reports & Analysis → confirm the nav item now reads "Super Forecasting" (not "Profit / Loss vs LSGB"), click it, confirm the page heading reads "Super Forecasting" and the URL is `/ems/reports-analysis/super-forecasting`. Screenshot.

- [ ] **Step 3: Verify the verdict banner and new figures**

Confirm: banner shows "We Made Money! 🎉" or "We Spent More Than We Earned 😟" (plain language, no "Profit"/"Loss" jargon words), headline cards read "Money We Spent" / "Money We Earned" / "Money We Had to Borrow" / "LSGB Withdrawn (period)", and the "Money We Spent" card's sub-line includes "Expense Pools ₹X" as a third component alongside Operating and Projects. If any Expense Pool HR/Admin/Core expense exists with a nonzero `lsgb_revenue_pct` in the selected date range, confirm the extra banner line "Of which ₹X was already tagged as LSGB Revenue..." appears — if none exist in this fresh dev session, confirm the line is correctly *absent* (not rendered as "₹0").

- [ ] **Step 4: Verify the reduction calculator**

Confirm the "Can We Cut Our LSGB Borrowing?" card renders. If there are no active/ongoing projects in this dev session, confirm it shows "Add at least one active project to calculate this." instead of a NaN/Infinity/crash. If active projects exist, change the target % input (e.g. to 25) and confirm the sentence and numbers update live.

- [ ] **Step 5: Verify the new glance sections**

Confirm "Expenses at a Glance" shows real counts (not 0 across the board unless genuinely zero) and three health badges (HR/Admin/Core) each showing OK/Watch/Over Budget/No Data. Confirm "Projects at a Glance" shows the running/approved/pipeline/completed counts matching what's visible elsewhere in the app for the same dev-seeded projects (cross-check against `localProjects.getStats()` via browser console if needed: `JSON.parse(localStorage.getItem('hma_projects')||'[]').filter(p=>p.status==='ongoing').length` or similar). Confirm "How Is HR Doing?" shows either the coverage sentence or the "no recorded cost" fallback, not a crash.

- [ ] **Step 6: Verify the simplified month-by-month table**

Confirm only 4 columns (Month, Money We Spent, Money We Earned, Status) with ✅/⚠️ icons, no 7-column dense table, no "forecast" pill badges (small "(estimate)" text instead).

- [ ] **Step 7: Verify the Dashboard's Profit/Loss widget still works**

Navigate to the EMS Dashboard, confirm the "Profit / Loss (year)" widget still renders with correct figures (unchanged visually — this widget is out of scope for the rename/relabel, only its import path was fixed).

- [ ] **Step 8: Check console errors**

Confirm no new console errors across all the above navigation/interaction.

- [ ] **Step 9: Stop the dev server**

Run: `pkill -f "vite.*5183"`

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers design spec §1 (rename — file only; route/nav in Task 2), §2 (corrected math — `poolExpenses`/`projectCount` added to `computeLsgbTotals`, `ownRevenue` untouched), §3 (kid-simple language throughout the verdict banner, headline cards, and simplified table), §4 (reduction calculator, `computeLsgbReductionPlan`), §5 (Expenses at a Glance), §6 (Projects at a Glance — reuses `totals.isProfit`, not a second metric), §7 (How Is HR Doing?). Task 2 covers the remaining §1 items (route, nav, widget import fix). Task 3 verifies all of the above end-to-end. Out-of-scope items from the spec (deduplicating the two expense stores, per-month pool-expense attribution, `ProfitLossWidget.jsx`'s own labels, `localOrgPool.js` changes, writing to `admin_pct`/`hr_pct`/`core_pct`) are correctly not implemented anywhere in this plan.
- **Signature stability:** `computeLsgbTotals(rangeStart, rangeEnd)` keeps its exact signature and all pre-existing return fields — verified against `ProfitLossWidget.jsx`'s usage (`data.expenses`, `data.ownRevenue`, `data.isProfit`, `data.surplus`, `data.lsgbNeed`, `data.lsgbSharePct` — all still present, unchanged meaning).
- **No placeholders:** every step shows complete code; the full new page file is shown in its entirety in Task 1, Step 1, not as a diff, since it's a full-file rewrite/rename.
