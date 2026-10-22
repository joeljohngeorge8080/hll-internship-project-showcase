import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CCard, CCardBody, CCardHeader } from '@coreui/react'
import { localBudgetPlan } from '../../../services/localBudgetPlan'
import {
  monthsInRange,
  computeWorkingPool,
  monthBaselines,
  monthPlannedTotal,
} from '../../../services/budgetPlan'
import { localProjects } from '../../../services/localProjects'
import PlanHeader from './budget-plan/PlanHeader'
import RecurringTasksEntry from './budget-plan/RecurringTasksEntry'
import PlanningMonthCard from './budget-plan/PlanningMonthCard'
import ActualMonthCard from './budget-plan/ActualMonthCard'
import BaselineSplitStrip from './budget-plan/BaselineSplitStrip'
import LedgerUploadPanel from './budget-plan/LedgerUploadPanel'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

// Settlement math is paisa-exact (see budgetPlan.js), but fmt() rounds to
// whole rupees for display — a ₹0.37 mismatch would print as "₹0", hiding
// the very amount the user needs to fix. Only the settlement diagnostics
// below need paisa precision; every other amount in this panel stays
// whole-rupee on purpose.
const fmtPrecise = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)

const BudgetPlanPanel = ({
  project,
  onProjectChange,
  canEdit = false,
  currentUser = 'Unknown',
}) => {
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [initError, setInitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [settlement, setSettlement] = useState(null)

  useEffect(() => {
    let cancelled = false
    setPlanLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    localBudgetPlan
      .getPlan(project.id)
      .then((p) => {
        if (!cancelled) setPlan(p)
      })
      .catch((e) => {
        if (!cancelled) setInitError(e.message)
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    if (plan?.status === 'planning') {
      localBudgetPlan
        .computeSettlement(project.id)
        .then((check) => {
          if (!cancelled) setSettlement(check)
        })
        .catch((e) => {
          if (!cancelled) setSubmitError(e.message)
        })
    } else {
      setSettlement(null) // eslint-disable-line react-hooks/set-state-in-effect
    }
    return () => {
      cancelled = true
    }
  }, [plan, project.id])

  const months = monthsInRange(project.start_date, project.end_date)
  const previewPoolPct = {
    admin: project.admin_pct ?? 5,
    hr: project.hr_pct ?? 5,
    core: project.core_pct ?? 5,
  }
  const previewProjectValue = project.project_value || project.project_valuation || 0
  const previewWorkingPool = computeWorkingPool(previewProjectValue, previewPoolPct)
  const previewBaselines = monthBaselines(previewWorkingPool, months)

  const handleInitialize = async () => {
    setInitError('')
    try {
      const created = await localBudgetPlan.initializePlan(project.id, {
        projectValue: project.project_value || project.project_valuation || 0,
        startDate: project.start_date,
        endDate: project.end_date,
        poolPct: {
          admin: project.admin_pct ?? 5,
          hr: project.hr_pct ?? 5,
          core: project.core_pct ?? 5,
        },
      })
      setPlan(created)
    } catch (e) {
      setInitError(e.message)
    }
  }

  const handleFullDelete = async () => {
    await localBudgetPlan.fullDelete(project.id)
    setPlan(null)
  }

  const handleSubmit = async () => {
    setSubmitError('')
    try {
      const submittedPlan = await localBudgetPlan.submit(project.id)
      setPlan(submittedPlan)

      // Bridge into localProjects.monthly_plan — the field EMS's Consolidated
      // Sheet, Apportionment Sheet, and Project Expenses page read. Without
      // this, a submitted budget plan is invisible to EMS.
      const monthlyPlanEntries = submittedPlan.months.map((m) => ({
        month: m.month,
        total: monthPlannedTotal(m.tasks),
        phases: (m.tasks || []).flatMap((t) =>
          (t.subtasks || []).map((sub) => ({
            phase: sub.activity || 'design',
            name: sub.name,
            amount: sub.planned_amount || 0,
            actual: sub.actual_amount ?? null,
          })),
        ),
      }))
      const updatedProject = await localProjects.syncMonthlyPlanFromBudgetPlan(
        project.id,
        monthlyPlanEntries,
      )
      onProjectChange?.(updatedProject)

      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch (e) {
      setSubmitError(e.message)
    }
  }

  const handleDrawFromAdmin = async () => {
    setSubmitError('')
    try {
      setPlan(await localBudgetPlan.drawFromAdmin(project.id, { createdBy: currentUser }))
    } catch (e) {
      setSubmitError(e.message)
    }
  }

  if (planLoading) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="fw-semibold">Budget Plan</CCardHeader>
        <CCardBody className="text-body-secondary small">Loading plan…</CCardBody>
      </CCard>
    )
  }

  if (!plan) {
    return (
      <CCard className="shadow-sm mb-4">
        <CCardHeader className="fw-semibold">Budget Plan</CCardHeader>
        <CCardBody>
          {months.length > 0 && (
            <>
              <div className="d-flex flex-wrap gap-3 mb-2">
                <div>
                  <div className="small text-body-secondary">Total Project Value</div>
                  <div className="fw-bold">{fmt(previewProjectValue)}</div>
                </div>
                <div>
                  <div className="small text-body-secondary">
                    Project ({100 - previewPoolPct.admin - previewPoolPct.hr - previewPoolPct.core}
                    %)
                  </div>
                  <div className="fw-bold">{fmt(previewWorkingPool)}</div>
                </div>
                <div>
                  <div className="small text-body-secondary">Admin ({previewPoolPct.admin}%)</div>
                  <div className="fw-bold">
                    {fmt((previewProjectValue * previewPoolPct.admin) / 100)}
                  </div>
                </div>
                <div>
                  <div className="small text-body-secondary">HR ({previewPoolPct.hr}%)</div>
                  <div className="fw-bold">
                    {fmt((previewProjectValue * previewPoolPct.hr) / 100)}
                  </div>
                </div>
                <div>
                  <div className="small text-body-secondary">Core ({previewPoolPct.core}%)</div>
                  <div className="fw-bold">
                    {fmt((previewProjectValue * previewPoolPct.core) / 100)}
                  </div>
                </div>
              </div>
              <BaselineSplitStrip
                months={months}
                amounts={previewBaselines}
                workingPool={previewWorkingPool}
              />
            </>
          )}
          {canEdit ? (
            <>
              <CAlert color="info" className="small">
                No budget plan yet for this {months.length}-month project.
              </CAlert>
              <CButton color="primary" onClick={handleInitialize} disabled={months.length === 0}>
                Initialize Plan
              </CButton>
              {initError && <div className="text-danger small mt-2">{initError}</div>}
            </>
          ) : (
            <CAlert color="info" className="small mb-0">
              No budget plan has been created yet.
            </CAlert>
          )}
        </CCardBody>
      </CCard>
    )
  }

  if (plan.status === 'planning') {
    const check = settlement
    return (
      <>
        <PlanHeader
          project={project}
          plan={plan}
          canEdit={canEdit}
          onPlanChange={setPlan}
          onFullDelete={handleFullDelete}
          currentUser={currentUser}
        />
        <RecurringTasksEntry
          project={project}
          plan={plan}
          canEdit={canEdit}
          onPlanChange={setPlan}
        />
        {plan.months.map((m, i) => (
          <PlanningMonthCard
            key={m.month}
            project={project}
            plan={plan}
            month={m.month}
            colorIndex={i}
            canEdit={canEdit}
            onPlanChange={setPlan}
            currentUser={currentUser}
          />
        ))}
        {canEdit && check && (
          <CCard className="mb-4">
            <CCardBody>
              <div className="small mb-2">
                {check.valid ? (
                  <span className="text-success">Every month is settled — ready to submit.</span>
                ) : (
                  <ul className="mb-0">
                    {check.monthIssues.map((i) => (
                      <li key={i.month} className="text-danger">
                        {i.month}:{' '}
                        {i.diff > 0
                          ? `over by ${fmtPrecise(i.diff)}`
                          : `${fmtPrecise(-i.diff)} unallocated`}
                      </li>
                    ))}
                    {!check.invariantOk && (
                      <li className="text-danger">
                        Totals don&apos;t add up to the project value — try Reset Calculation.
                      </li>
                    )}
                    {!check.poolsNonNegative && (
                      <li className="text-danger">A pool has gone negative.</li>
                    )}
                  </ul>
                )}
              </div>
              {check.adminDraw && (
                <CButton size="sm" color="warning" className="me-2" onClick={handleDrawFromAdmin}>
                  Draw {fmtPrecise(check.adminDraw.amount)} from Admin
                </CButton>
              )}
              <CButton color="primary" disabled={!check.valid} onClick={handleSubmit}>
                Submit Plan
              </CButton>
              {submitError && <div className="text-danger small mt-2">{submitError}</div>}
            </CCardBody>
          </CCard>
        )}
      </>
    )
  }

  return (
    <>
      {submitted && (
        <CAlert color="success" className="py-2 small">
          ✓ Plan saved
        </CAlert>
      )}
      <PlanHeader
        project={project}
        plan={plan}
        canEdit={canEdit}
        onPlanChange={setPlan}
        onFullDelete={handleFullDelete}
        currentUser={currentUser}
      />
      <LedgerUploadPanel
        project={project}
        plan={plan}
        canEdit={canEdit}
        currentUser={currentUser}
        onPlanChange={setPlan}
      />
      {plan.months.map((m, i) => (
        <ActualMonthCard
          key={m.month}
          project={project}
          plan={plan}
          month={m.month}
          colorIndex={i}
          canEdit={canEdit}
          onPlanChange={setPlan}
          onProjectChange={onProjectChange}
          currentUser={currentUser}
        />
      ))}
    </>
  )
}

BudgetPlanPanel.propTypes = {
  project: PropTypes.object.isRequired,
  onProjectChange: PropTypes.func,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
}

export default BudgetPlanPanel
