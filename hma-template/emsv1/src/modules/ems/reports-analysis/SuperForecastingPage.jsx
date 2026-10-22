/**
 * SuperForecastingPage.jsx
 * ────────────────────────
 * EMS › Reports & Analysis › Super Forecasting  (formerly "Profit / Loss vs LSGB")
 *
 * CEO-facing command center: will the company be in profit or loss, when
 * (if ever) does the running balance go negative, and how much of the
 * forecast is money already committed versus money merely estimated?
 *
 * All business logic lives in services/forecastEngine.js (pure math) and
 * services/forecastData.js (I/O + composition) — this file is UI only. The
 * five dashboard widgets under ems/dashboard/widgets import their figures
 * from forecastData.js directly, not from this page.
 */
import React, { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import {
  CAlert,
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
import { localProjects } from '../../../services/localProjects'
import {
  computeProfitLossTotals,
  computeGapReductionPlan,
  computeHRRevenueBreakdown,
  computeExpenseGlance,
  computeHRHealth,
  monthsBetween,
  addMonths,
  currentMonthLocal,
} from '../../../services/forecastData'

Chart.register(...registerables)

// ── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthLabel = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const CURRENT_MONTH = currentMonthLocal()
// Pickable window: 24 months back … 24 months ahead of today.
const PICKER_MONTHS = monthsBetween(addMonths(CURRENT_MONTH, -24), addMonths(CURRENT_MONTH, 24))

const DEFAULT_TOTALS = {
  monthRows: [],
  hrRevenueTotal: 0,
  hrRevenueUnattributed: 0,
  shares: 0,
  operating: 0,
  project: 0,
  poolExpenses: { totalAmount: 0, count: 0 },
  projectCount: 0,
  committedSpend: 0,
  estimatedSpend: 0,
  outsourcedSpend: 0,
  expenses: 0,
  ownRevenue: 0,
  net: 0,
  gapAmount: 0,
  surplus: 0,
  gapSharePct: 0,
  isProfit: true,
  firstNegativeMonth: null,
  lastClosedMonth: addMonths(CURRENT_MONTH, -1),
  currentMonth: CURRENT_MONTH,
}

// ── Chart helpers ──────────────────────────────────────────────────────────
// Same pattern as VisualModelPage.jsx: defer canvas init a frame so Firefox
// resolves the container's flex/grid size first, and destroy the previous
// instance on every rebuild/unmount.

const useChart = (ref, builder, deps) => {
  const instance = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const rafId = requestAnimationFrame(() => {
      if (!ref.current) return
      if (instance.current) instance.current.destroy()
      instance.current = builder(ref.current)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (instance.current) {
        instance.current.destroy()
        instance.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Known-vs-estimated stacked bar — per forecast month, committed spend
 *  (contractually known) stacked against the estimated (Holt-trend) remainder. */
const KnownVsEstimatedChart = ({ monthRows }) => {
  const ref = useRef(null)
  const forecastRows = monthRows.filter((r) => r.isForecast)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: forecastRows.map((r) => monthLabel(r.month)),
          datasets: [
            {
              label: 'Committed',
              data: forecastRows.map((r) => r.spend.committed),
              backgroundColor: '#2563EB',
            },
            {
              label: 'Estimated',
              data: forecastRows.map((r) => r.spend.estimated),
              backgroundColor: '#F59E0B',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, ticks: { callback: (v) => fmt(v) } },
          },
        },
      }),
    [JSON.stringify(forecastRows)],
  )
  if (forecastRows.length === 0) {
    return (
      <div className="text-body-secondary small">No forecast months in the selected range.</div>
    )
  }
  // Chart.js's responsive:true + maintainAspectRatio:false makes the canvas
  // fill its immediate parent — that parent must have a fixed, non-content
  // -dependent height and position:relative, or the canvas and parent grow
  // each other in a feedback loop on every resize/redraw (e.g. hovering for
  // a tooltip). See https://www.chartjs.org/docs/latest/configuration/responsive.html
  return (
    <div style={{ position: 'relative', height: 220 }}>
      <canvas ref={ref} />
    </div>
  )
}

/** Spend vs earn grouped bars — forecast months rendered at reduced opacity
 *  so the eye separates "known" months from "estimated" ones at a glance. */
const SpendVsEarnChart = ({ monthRows }) => {
  const ref = useRef(null)
  useChart(
    ref,
    (canvas) =>
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: monthRows.map((r) => monthLabel(r.month)),
          datasets: [
            {
              label: 'Spend',
              data: monthRows.map((r) => r.totalExpense),
              backgroundColor: monthRows.map((r) =>
                r.isForecast ? 'rgba(37,99,235,0.35)' : '#2563EB',
              ),
            },
            {
              label: 'Earn',
              data: monthRows.map((r) => r.shareRevenue),
              backgroundColor: monthRows.map((r) =>
                r.isForecast ? 'rgba(5,150,105,0.35)' : '#059669',
              ),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { ticks: { callback: (v) => fmt(v) } } },
        },
      }),
    [JSON.stringify(monthRows)],
  )
  return (
    <div style={{ position: 'relative', height: 220 }}>
      <canvas ref={ref} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SuperForecastingPage = () => {
  const [rangeStart, setRangeStart] = useState(`${new Date().getFullYear()}-01`)
  const [rangeEnd, setRangeEnd] = useState(`${new Date().getFullYear()}-12`)
  const [targetPct, setTargetPct] = useState(10)

  // Set if any data-loading effect below fails (Supabase unreachable, RLS
  // denial, expired session) — without this, a failed fetch silently leaves
  // every figure at its zero default, rendering a confident "We Made
  // Money!" verdict indistinguishable from a real zero-activity org.
  const [loadError, setLoadError] = useState(false)

  const [hrRevenueAllTime, setHrRevenueAllTime] = useState({
    recruitment: 0,
    training: 0,
    internship: 0,
    total: 0,
    unattributed: 0,
  })
  useEffect(() => {
    let active = true
    computeHRRevenueBreakdown()
      .then((data) => {
        if (active) setHrRevenueAllTime(data)
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [])

  // ── Period totals & verdict ─────────────────────────────────────────────────
  // `totals` is set once per successful load (a stable reference), so every
  // effect below can safely depend on it directly — no destructuring into a
  // fresh `{ ...totals }` object on every render, which used to give
  // useEffect([totals, ...]) a new identity every render and re-fire forever.
  const [totals, setTotals] = useState(DEFAULT_TOTALS)
  useEffect(() => {
    let cancelled = false
    computeProfitLossTotals(rangeStart, rangeEnd)
      .then((res) => {
        if (!cancelled) setTotals(res)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [rangeStart, rangeEnd])
  const isProfit = totals.isProfit

  const [reductionPlan, setReductionPlan] = useState(null)
  useEffect(() => {
    let cancelled = false
    computeGapReductionPlan(totals, targetPct)
      .then((plan) => {
        if (!cancelled) setReductionPlan(plan)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [totals, targetPct])

  const [projectStats, setProjectStats] = useState({
    ongoing: 0,
    approved: 0,
    pipeline: 0,
    completed: 0,
    total: 0,
  })
  useEffect(() => {
    let cancelled = false
    localProjects
      .getStats()
      .then((s) => {
        if (!cancelled) setProjectStats(s)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const [expenseGlance, setExpenseGlance] = useState({
    operatingCount: 0,
    poolCount: 0,
    projectCount: 0,
    hr: { label: 'No Data', color: 'secondary' },
    admin: { label: 'No Data', color: 'secondary' },
    core: { label: 'No Data', color: 'secondary' },
  })
  useEffect(() => {
    let cancelled = false
    computeExpenseGlance(totals)
      .then((g) => {
        if (!cancelled) setExpenseGlance(g)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [totals])

  const [hrHealth, setHrHealth] = useState({ totalCost: 0, coveragePct: null })
  useEffect(() => {
    let cancelled = false
    computeHRHealth(rangeStart, rangeEnd, totals.hrRevenueTotal)
      .then((h) => {
        if (!cancelled) setHrHealth(h)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [rangeStart, rangeEnd, totals])

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
            Will the money we earn cover the money we spend, and if not — when do we run out? Closed
            months use real actuals; open months split into money already <strong>committed</strong>{' '}
            and money that's still an <strong>estimate</strong>.
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

      {loadError && (
        <CAlert color="warning" className="mb-4">
          Couldn't load live data for this period — the figures below may be incomplete or stale.
        </CAlert>
      )}

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
          <div className="flex-grow-1">
            <div
              className="fw-bold"
              style={{ fontSize: '1.15rem', color: isProfit ? '#06d6a0' : '#ff6b6b' }}
            >
              {isProfit
                ? `We Made Money! Net ${fmt(totals.net)} for the period.`
                : `We Spent More Than We Earned — ${fmt(totals.gapAmount)} has to be covered from lsgb.`}
            </div>
            <div className="small text-body-secondary">
              {monthLabel(rangeStart)} – {monthLabel(rangeEnd)} · Money We Spent{' '}
              {fmt(totals.expenses)} vs Money We Earned {fmt(totals.ownRevenue)}
              {isProfit
                ? ` · extra money saved ${fmt(totals.surplus)}`
                : ` · ${totals.gapSharePct.toFixed(0)}% of what we spent wasn't covered`}
            </div>
            {totals.firstNegativeMonth && (
              <div className="small text-danger fw-semibold mt-1">
                Running balance goes negative in {monthLabel(totals.firstNegativeMonth)}, if current
                trends hold.
              </div>
            )}
          </div>
        </CCardBody>
      </CCard>

      {/* Can we close this gap? */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">Can We Close This Gap?</CCardHeader>
        <CCardBody>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
            <span>Close the gap by</span>
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
          {reductionPlan?.avgProjectSize > 0 ? (
            <>
              <div className="fs-6">
                To close the gap by {targetPct}%, you need about{' '}
                <strong className="text-success">{fmt(reductionPlan.neededNewProjectValue)}</strong>{' '}
                in new project value — roughly{' '}
                <strong className="text-success">
                  {reductionPlan.approxProjectsNeeded} new project
                  {reductionPlan.approxProjectsNeeded === 1 ? '' : 's'}
                </strong>
                , based on your average project size of {fmt(reductionPlan.avgProjectSize)}.
              </div>
              <div className="text-body-secondary small mt-2">
                Assumes new project(s) run for an average of {reductionPlan.avgDurationMonths}{' '}
                month(s) (your current active-project average) against a{' '}
                {reductionPlan.periodMonths}
                -month selected period, earning pool-cut money at your current average rate of{' '}
                {reductionPlan.avgCombinedPct}% of project value — only the months of overlap
                between a project's own duration and the selected period count toward this period's
                gap.
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
            sub: `Committed ${fmt(totals.committedSpend)} + Estimated ${fmt(totals.estimatedSpend)} · Outsourced Services ${fmt(totals.outsourcedSpend)} (shown separately — see note below)`,
          },
          {
            label: 'Money We Earned',
            value: totals.ownRevenue,
            color: 'success',
            sub: `Project shares ${fmt(totals.shares)} + HR revenue (this period) ${fmt(totals.hrRevenueTotal)}`,
          },
          {
            label: 'Money We Had to Cover',
            value: totals.gapAmount,
            color: totals.gapAmount > 0 ? 'danger' : 'success',
            sub: totals.gapAmount > 0 ? 'Not covered by what we earned' : 'Fully self-funded',
          },
        ].map((card) => (
          <CCol key={card.label} xs={6} lg={4}>
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

      {totals.outsourcedSpend > 0 && (
        <CAlert color="info" className="mb-4 small">
          <strong>Note:</strong> "Outsourced Services" ({fmt(totals.outsourcedSpend)}) is a General
          Expenses category that was never covered by the pool-is-authoritative ruling — it may
          overlap with Expense Pool entries for the same real spend. It's shown as its own line
          rather than folded into either total, so this is visible instead of hidden. Judge it
          against real numbers before treating it as pure additional spend.
        </CAlert>
      )}

      {/* Known vs Estimated + Spend vs Earn */}
      <CRow className="g-3 mb-4">
        <CCol lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent fw-semibold">
              Forecast Months: Known vs Estimated
            </CCardHeader>
            <CCardBody>
              <KnownVsEstimatedChart monthRows={totals.monthRows} />
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent fw-semibold">Spend vs Earn by Month</CCardHeader>
            <CCardBody>
              {totals.monthRows.length > 0 ? (
                <SpendVsEarnChart monthRows={totals.monthRows} />
              ) : (
                <div className="text-body-secondary">No data for the selected period.</div>
              )}
              <div className="text-body-secondary small mt-2">Faded bars = forecast months.</div>
            </CCardBody>
          </CCard>
        </CCol>
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
              <div
                key={p.label}
                className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2"
              >
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
                  See "Can We Close This Gap?" above for how many more projects would close the gap.
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
              HR earned <strong className="text-success">{fmt(totals.hrRevenueTotal)}</strong> this
              period and cost <strong className="text-danger">{fmt(hrHealth.totalCost)}</strong> —
              HR covers <strong>{hrHealth.coveragePct}%</strong> of its own cost.
            </div>
          ) : (
            <div className="text-body-secondary">HR has no recorded cost this period.</div>
          )}
          <div className="text-body-secondary small mt-2">
            All-time revenue mix (not limited to the selected period): Recruitment{' '}
            {fmt(hrRevenueAllTime.recruitment)} · Training {fmt(hrRevenueAllTime.training)} ·
            Internship {fmt(hrRevenueAllTime.internship)}
            {hrRevenueAllTime.unattributed > 0 &&
              ` · ${fmt(hrRevenueAllTime.unattributed)} has no usable date and isn't attributed to any month or period`}
          </div>
        </CCardBody>
      </CCard>

      {/* Month-by-month breakdown */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">Month-by-Month</CCardHeader>
        <CCardBody className="p-0">
          <div style={{ overflowX: 'auto' }}>
            <CTable small hover align="middle" className="mb-0" style={{ fontSize: '0.82rem' }}>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Month</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Spend (committed + est.)</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Earn</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Net</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Cumulative</CTableHeaderCell>
                  <CTableHeaderCell className="text-center">Source</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {totals.monthRows.map((r) => (
                  <CTableRow key={r.month}>
                    <CTableDataCell className="fw-semibold">{monthLabel(r.month)}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      {fmt(r.totalExpense)}
                      {r.isForecast && (
                        <span
                          className="text-body-secondary fw-normal ms-1"
                          style={{ fontSize: '0.72rem' }}
                        >
                          ({fmt(r.spend.committed)} + {fmt(r.spend.estimated)})
                        </span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell className="text-end text-success">
                      {r.shareRevenue > 0 ? fmt(r.shareRevenue) : '—'}
                    </CTableDataCell>
                    <CTableDataCell
                      className={`text-end ${r.net >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      {fmt(r.net)}
                    </CTableDataCell>
                    <CTableDataCell
                      className={`text-end fw-semibold ${r.cumulative >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      {fmt(r.cumulative)}
                    </CTableDataCell>
                    <CTableDataCell className="text-center">
                      <CBadge color={r.isForecast ? 'warning' : 'secondary'} shape="rounded-pill">
                        {r.source}
                      </CBadge>
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
                  <CTableDataCell
                    className={`text-end ${totals.net >= 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {fmt(totals.net)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {totals.monthRows.length > 0
                      ? fmt(totals.monthRows[totals.monthRows.length - 1].cumulative)
                      : fmt(0)}
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    <CBadge color={isProfit ? 'success' : 'danger'} shape="rounded-pill">
                      {isProfit ? 'Covered' : 'Borrowed'}
                    </CBadge>
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
