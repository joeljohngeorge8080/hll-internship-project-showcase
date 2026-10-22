/**
 * LsgbFinancePage.jsx — Finance > LSGB
 * Route: /ems/finance/lsgb
 *
 * Finance-only "Add LSGB Money" box (date, month, year, notes, amount) plus
 * the same inflow/outflow ledger shown on the common Expense Management >
 * LSGB tab (LsgbLedgerPanel), so Finance can add money and immediately see
 * its effect in one place.
 */
import React, { useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormInput,
  CButton,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBank } from '@coreui/icons'
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localLsgbRevenue } from '../../../services/localLsgbRevenue'
import LsgbLedgerPanel from '../expense-management/LsgbLedgerPanel'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => {
  const d = new Date()
  return {
    amount: '',
    credit_date: today(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    notes: '',
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const AddLsgbMoneyBox = ({ onSaved }) => {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const amt = parseFloat(form.amount)
    if (!(amt > 0) || !form.credit_date) return
    setSaving(true)
    setError('')
    try {
      await localLsgbRevenue.addCredit(
        {
          amount: amt,
          credit_date: form.credit_date,
          month: parseInt(form.month, 10),
          year: parseInt(form.year, 10),
          notes: form.notes,
        },
        null,
      )
      setForm(emptyForm())
      if (onSaved) await onSaved()
    } catch (e) {
      setError(e?.message || 'Failed to add LSGB money. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const disabled = !(parseFloat(form.amount) > 0) || !form.credit_date || saving

  return (
    <CCard className="mb-4 shadow-sm">
      <CCardHeader className="bg-transparent fw-semibold">
        <CIcon icon={cilBank} className="me-1" style={{ width: 14, height: 14 }} />
        Add LSGB Money
      </CCardHeader>
      <CCardBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError('')}>
            {error}
          </CAlert>
        )}
        <CRow className="g-2 mb-2">
          <CCol xs={12} md={3}>
            <label className="form-label small mb-1">Amount *</label>
            <CFormInput
              size="sm"
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="₹ Amount"
            />
          </CCol>
          <CCol xs={12} md={3}>
            <label className="form-label small mb-1">Date *</label>
            <CFormInput
              size="sm"
              type="date"
              value={form.credit_date}
              onChange={(e) => setForm((f) => ({ ...f, credit_date: e.target.value }))}
            />
          </CCol>
          <CCol xs={6} md={2}>
            <label className="form-label small mb-1">Month</label>
            <CFormInput
              size="sm"
              type="number"
              min="1"
              max="12"
              value={form.month}
              onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
            />
            <div className="text-body-secondary" style={{ fontSize: '0.68rem' }}>
              {MONTH_NAMES[(parseInt(form.month, 10) || 1) - 1]}
            </div>
          </CCol>
          <CCol xs={6} md={2}>
            <label className="form-label small mb-1">Year</label>
            <CFormInput
              size="sm"
              type="number"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            />
          </CCol>
          <CCol xs={12} md={2} className="d-flex align-items-end">
            <CButton
              size="sm"
              color="success"
              className="w-100"
              disabled={disabled}
              onClick={handleSave}
            >
              {saving ? 'Adding…' : 'Add'}
            </CButton>
          </CCol>
        </CRow>
        <CRow className="g-2">
          <CCol xs={12}>
            <label className="form-label small mb-1">Notes (optional)</label>
            <CFormInput
              size="sm"
              placeholder="e.g. LSGB sanction for FY 2026-27, installment 2"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}

const LsgbFinancePage = () => {
  const canEdit = usePermission(MODULE.FINANCE, 'edit')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <div className="mb-3">
        <h4 className="fw-bold mb-1">Finance — LSGB</h4>
        <p className="text-body-secondary mb-0 small">
          Add money to LSGB and track every inflow and outflow against it.
        </p>
      </div>

      {canEdit ? (
        <AddLsgbMoneyBox onSaved={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <CAlert color="info" className="mb-4">
          You have view-only access here — only Finance (Heads) can add LSGB money.
        </CAlert>
      )}

      <LsgbLedgerPanel key={refreshKey} />
    </>
  )
}

export default LsgbFinancePage
