import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import { computeWorkingPool, poolBalance, monthBaselines } from '../../../../services/budgetPlan'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'
import BaselineSplitStrip from './BaselineSplitStrip'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const PlanHeader = ({ project, plan, canEdit, onPlanChange, onFullDelete, currentUser }) => {
  const [confirmModal, setConfirmModal] = useState(null) // 'reset' | 'delete' | 'reopen' | null
  const [saved, setSaved] = useState(false)
  const workingPool = computeWorkingPool(plan.project_value, plan.pool_pct)
  const hrBalance = poolBalance(plan.project_value, plan.pool_pct, 'hr', plan.transfers)
  const coreBalance = poolBalance(plan.project_value, plan.pool_pct, 'core', plan.transfers)
  const adminBalance = poolBalance(plan.project_value, plan.pool_pct, 'admin', plan.transfers)
  const projectPct = 100 - plan.pool_pct.admin - plan.pool_pct.hr - plan.pool_pct.core
  const months = plan.months.map((m) => m.month)
  const baselines = monthBaselines(workingPool, months)

  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    try {
      onPlanChange(await localBudgetPlan.save(project.id))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    }
  }
  const handleResetCalculation = async () => {
    setError('')
    try {
      onPlanChange(await localBudgetPlan.getPlan(project.id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <CCard className="mb-3">
      <CCardBody>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-2">
          <div>
            <div className="small text-body-secondary">Total Project Value</div>
            <div className="fw-bold">{fmt(plan.project_value)}</div>
          </div>
          <div>
            <div className="small text-body-secondary">Duration</div>
            <div className="fw-bold">
              {plan.months.length} month{plan.months.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <div className="small text-body-secondary">Project ({projectPct}%)</div>
            <div className="fw-bold">{fmt(workingPool)}</div>
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="small text-body-secondary">Admin ({plan.pool_pct.admin}%)</div>
            <div className="fw-bold">{fmt(adminBalance)}</div>
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="small text-body-secondary">HR (max {plan.pool_pct.hr}%)</div>
            <div className="fw-bold">{fmt(hrBalance)}</div>
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="small text-body-secondary">Core (max {plan.pool_pct.core}%)</div>
            <div className="fw-bold">{fmt(coreBalance)}</div>
          </div>
        </div>

        {plan.status === 'planning' && (
          <BaselineSplitStrip months={months} amounts={baselines} workingPool={workingPool} />
        )}

        {saved && (
          <CAlert color="success" className="py-2 small mb-2">
            ✓ Saved
          </CAlert>
        )}

        {error && (
          <CAlert color="danger" className="py-2 small mb-2">
            {error}
          </CAlert>
        )}

        {canEdit && plan.status === 'planning' && (
          <div className="d-flex flex-wrap gap-2">
            <CButton size="sm" color="primary" onClick={handleSave}>
              Save
            </CButton>
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              onClick={() => setConfirmModal('reset')}
            >
              Reset
            </CButton>
            <CButton size="sm" color="secondary" variant="outline" onClick={handleResetCalculation}>
              Reset Calculation
            </CButton>
            <CButton
              size="sm"
              color="danger"
              variant="outline"
              onClick={() => setConfirmModal('delete')}
            >
              Full Delete
            </CButton>
          </div>
        )}

        {canEdit && plan.status === 'submitted' && (
          <CButton
            size="sm"
            color="danger"
            variant="outline"
            onClick={() => setConfirmModal('reopen')}
          >
            Back to Planning
          </CButton>
        )}
      </CCardBody>

      <CModal
        visible={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>Confirm</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          {confirmModal === 'reset' &&
            'This restores every month and transfer back to the last Save (or the empty state if you never saved). Continue?'}
          {confirmModal === 'delete' &&
            'This permanently deletes the entire budget plan. Continue?'}
          {confirmModal === 'reopen' &&
            'Going back to planning ERASES every actual entry — actual amounts, any tasks added during actual entry, actual-phase transfers, and month approvals. Planned amounts and the plan itself stay exactly as they were at submit. Continue?'}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmModal(null)}
          >
            Cancel
          </CButton>
          <CButton
            color="danger"
            size="sm"
            onClick={async () => {
              setError('')
              try {
                if (confirmModal === 'reset') onPlanChange(await localBudgetPlan.reset(project.id))
                else if (confirmModal === 'reopen')
                  onPlanChange(await localBudgetPlan.reopenPlanning(project.id))
                else await onFullDelete()
              } catch (e) {
                setError(e.message)
              }
              setConfirmModal(null)
            }}
          >
            Confirm
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

PlanHeader.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onPlanChange: PropTypes.func.isRequired,
  onFullDelete: PropTypes.func.isRequired,
  currentUser: PropTypes.string,
}

export default PlanHeader
