import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { localBudgetPlan } from '../../../../services/localBudgetPlan'

const POOL_LABELS = { admin: 'Admin', hr: 'HR', core: 'Core' }

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/**
 * The only way to edit an Admin/HR/Core pool block now — no more typing
 * directly into a live number field. "Add" pulls from this month's own
 * project budget into the pool here (unchanged from the old inline-input
 * behavior). "Send elsewhere" reduces this pool's credit for this month
 * and moves it straight to another month's pool credit — it no longer
 * lands back in this month's own project budget.
 */
const PoolAdjustModal = ({
  visible,
  onClose,
  project,
  plan,
  pool,
  month,
  phase,
  currentAmount,
  currentUser,
  onPlanChange,
}) => {
  const [mode, setMode] = useState('increase')
  const [amount, setAmount] = useState('')
  const [targetMonth, setTargetMonth] = useState('')
  const [targetPool, setTargetPool] = useState(pool)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const otherMonths = plan.months.map((m) => m.month).filter((m) => m !== month)

  const reset = () => {
    setMode('increase')
    setAmount('')
    setTargetMonth('')
    setTargetPool(pool)
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleConfirm = async () => {
    setError('')
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (mode === 'send' && !targetMonth) {
      setError('Pick a month to send it to.')
      return
    }
    setSaving(true)
    try {
      const updated =
        mode === 'increase'
          ? await localBudgetPlan.moveBalance(project.id, {
              originMonth: month,
              direction: 'send',
              targets: [pool],
              amount: amt,
              phase,
              createdBy: currentUser,
            })
          : await localBudgetPlan.movePoolBalance(project.id, {
              fromPool: pool,
              fromMonth: month,
              toPool: targetPool,
              toMonth: targetMonth,
              amount: amt,
              phase,
              createdBy: currentUser,
            })
      onPlanChange(updated)
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center">
      <CModalHeader>
        <CModalTitle>
          {POOL_LABELS[pool]} — {monthLabel(month)}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="small text-body-secondary mb-3">
          Current amount for this month: <strong>{fmt(currentAmount)}</strong>
        </div>
        <CForm>
          <div className="mb-3">
            <CFormCheck
              type="radio"
              name="poolAdjustMode"
              id="poolAdjustIncrease"
              label={`Add to ${POOL_LABELS[pool]} from this month's project budget`}
              checked={mode === 'increase'}
              onChange={() => setMode('increase')}
            />
            <CFormCheck
              type="radio"
              name="poolAdjustMode"
              id="poolAdjustSend"
              label={`Reduce ${POOL_LABELS[pool]} and send it to another month`}
              checked={mode === 'send'}
              onChange={() => setMode('send')}
              disabled={otherMonths.length === 0}
            />
          </div>

          <CFormLabel>Amount</CFormLabel>
          <CFormInput
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mb-3"
          />

          {mode === 'send' && (
            <>
              <CFormLabel>Send to month</CFormLabel>
              <CFormSelect
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="mb-3"
              >
                <option value="">Select a month...</option>
                {otherMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </CFormSelect>

              <CFormLabel>Send to pool</CFormLabel>
              <CFormSelect value={targetPool} onChange={(e) => setTargetPool(e.target.value)}>
                {Object.keys(POOL_LABELS).map((p) => (
                  <option key={p} value={p}>
                    {POOL_LABELS[p]}
                  </option>
                ))}
              </CFormSelect>
            </>
          )}
        </CForm>
        {error && <div className="text-danger small mt-3">{error}</div>}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" size="sm" onClick={handleClose}>
          Cancel
        </CButton>
        <CButton color="primary" size="sm" disabled={saving} onClick={handleConfirm}>
          Confirm
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

PoolAdjustModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  pool: PropTypes.oneOf(['admin', 'hr', 'core']).isRequired,
  month: PropTypes.string.isRequired,
  phase: PropTypes.oneOf(['planning', 'actual']).isRequired,
  currentAmount: PropTypes.number.isRequired,
  currentUser: PropTypes.string,
  onPlanChange: PropTypes.func.isRequired,
}

export default PoolAdjustModal
