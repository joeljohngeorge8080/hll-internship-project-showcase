import React, { useEffect, useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus, cilTrash } from '@coreui/icons'
import { localAdminExpenses } from '../../../../services/localAdminExpenses'

const FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Annually']
const STATUSES = ['Active', 'Inactive']

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const monthlyEquiv = (annual) => Math.round(parseFloat(annual || 0) / 12)

const STATUS_COLORS = { Active: 'success', Inactive: 'secondary' }

const EMPTY_FORM = {
  vendor_name: '',
  expense_category: '',
  frequency: 'Monthly',
  annual_amount: '',
  monthly_amount: '',
  status: 'Active',
  remarks: '',
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
// Monthly-frequency entries take the amount directly (the natural way HR
// thinks about a monthly bill) instead of forcing them to first work out an
// annual figure — annual_amount is still what's stored, just derived
// (monthly × 12) for that case instead of typed in directly.
const ExpenseModal = ({ form, setForm, editTarget, onSave, onClose, saving, error }) => {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isMonthly = form.frequency === 'Monthly'
  const derivedAnnual =
    isMonthly && form.monthly_amount !== ''
      ? Math.round(parseFloat(form.monthly_amount) * 12)
      : null
  const monthly = !isMonthly && form.annual_amount !== '' ? monthlyEquiv(form.annual_amount) : null

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {editTarget ? 'Edit Admin Expense' : 'Add Admin Expense'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <div className="modal-body">
            {error && (
              <CAlert color="danger" className="py-2 mb-3">
                {error}
              </CAlert>
            )}
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Vendor Name <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.vendor_name}
                  onChange={(e) => set('vendor_name', e.target.value)}
                  placeholder="e.g. KSEB"
                />
              </CCol>

              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Expense Category <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.expense_category}
                  onChange={(e) => set('expense_category', e.target.value)}
                  placeholder="e.g. Electricity Bill"
                />
              </CCol>

              <CCol md={4}>
                <CFormLabel className="fw-semibold">Frequency</CFormLabel>
                <CFormSelect
                  value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              {isMonthly ? (
                <>
                  <CCol md={4}>
                    <CFormLabel className="fw-semibold">
                      Monthly Amount (₹) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      min="0"
                      step="1"
                      value={form.monthly_amount}
                      onChange={(e) => set('monthly_amount', e.target.value)}
                      placeholder="0"
                    />
                  </CCol>

                  <CCol md={4}>
                    <CFormLabel className="fw-semibold">Annual Equivalent</CFormLabel>
                    <div className="form-control bg-body-secondary text-body-secondary">
                      {derivedAnnual !== null ? currency(derivedAnnual) : '—'}
                    </div>
                    <div className="form-text">Monthly × 12 (auto)</div>
                  </CCol>
                </>
              ) : (
                <>
                  <CCol md={4}>
                    <CFormLabel className="fw-semibold">
                      Annual Amount (₹) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      min="0"
                      step="1"
                      value={form.annual_amount}
                      onChange={(e) => set('annual_amount', e.target.value)}
                      placeholder="0"
                    />
                  </CCol>

                  <CCol md={4}>
                    <CFormLabel className="fw-semibold">Monthly Equivalent</CFormLabel>
                    <div className="form-control bg-body-secondary text-body-secondary">
                      {monthly !== null ? currency(monthly) : '—'}
                    </div>
                    <div className="form-text">Annual ÷ 12 (auto)</div>
                  </CCol>
                </>
              )}

              <CCol md={4}>
                <CFormLabel className="fw-semibold">Status</CFormLabel>
                <CFormSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={12}>
                <CFormLabel>Remarks</CFormLabel>
                <CFormTextarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => set('remarks', e.target.value)}
                  placeholder="Optional notes"
                />
              </CCol>
            </CRow>
          </div>
          <div className="modal-footer">
            <CButton color="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </CButton>
            <CButton
              color="primary"
              onClick={onSave}
              disabled={
                saving ||
                !form.vendor_name.trim() ||
                !form.expense_category.trim() ||
                (isMonthly ? form.monthly_amount === '' : form.annual_amount === '')
              }
            >
              {saving && <CSpinner size="sm" className="me-1" />}
              {editTarget ? 'Save Changes' : 'Add Entry'}
            </CButton>
          </div>
        </div>
      </div>
    </div>
  )
}

ExpenseModal.propTypes = {
  form: PropTypes.object.isRequired,
  setForm: PropTypes.func.isRequired,
  editTarget: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  error: PropTypes.string,
}

// ── Main panel ────────────────────────────────────────────────────────────────
const AdminDivisionPanel = ({ canEdit }) => {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    setEntries(await localAdminExpenses.list())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const activeEntries = useMemo(() => entries.filter((e) => e.status === 'Active'), [entries])
  const totalMonthly = useMemo(
    () => activeEntries.reduce((s, e) => s + monthlyEquiv(e.annual_amount), 0),
    [activeEntries],
  )
  const totalAnnual = useMemo(
    () => activeEntries.reduce((s, e) => s + parseFloat(e.annual_amount || 0), 0),
    [activeEntries],
  )

  const openAdd = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (entry) => {
    setEditTarget(entry)
    setForm({
      vendor_name: entry.vendor_name,
      expense_category: entry.expense_category,
      frequency: entry.frequency,
      annual_amount: entry.annual_amount,
      monthly_amount: entry.frequency === 'Monthly' ? monthlyEquiv(entry.annual_amount) : '',
      status: entry.status,
      remarks: entry.remarks || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.vendor_name.trim()) {
      setError('Vendor name is required')
      return
    }
    if (!form.expense_category.trim()) {
      setError('Expense category is required')
      return
    }
    const isMonthly = form.frequency === 'Monthly'
    if (isMonthly && (form.monthly_amount === '' || isNaN(parseFloat(form.monthly_amount)))) {
      setError('Monthly amount is required')
      return
    }
    if (!isMonthly && (form.annual_amount === '' || isNaN(parseFloat(form.annual_amount)))) {
      setError('Annual amount is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        vendor_name: form.vendor_name.trim(),
        expense_category: form.expense_category.trim(),
        frequency: form.frequency,
        annual_amount: isMonthly
          ? Math.round(parseFloat(form.monthly_amount) * 12)
          : parseFloat(form.annual_amount),
        status: form.status,
        remarks: form.remarks.trim() || null,
      }
      if (editTarget) {
        await localAdminExpenses.update(editTarget.id, payload)
      } else {
        await localAdminExpenses.create(payload)
      }
    } catch (e) {
      setError(e.message || 'Save failed')
      setSaving(false)
      return
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await localAdminExpenses.delete(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  return (
    <>
      <CCard className="border-top border-top-primary border-3">
        <CCardHeader>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <strong>Admin Expenses</strong>
              <div className="small text-body-secondary mt-1">
                Office operations, utilities &amp; infrastructure
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <CBadge color="primary" className="fs-6 px-3 py-2">
                {entries.length} item{entries.length !== 1 ? 's' : ''}
              </CBadge>
              {canEdit && (
                <CButton color="primary" size="sm" onClick={openAdd}>
                  <CIcon icon={cilPlus} className="me-1" /> Add
                </CButton>
              )}
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-4">
              <CSpinner color="primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-body-secondary small mb-0">
              No admin expense entries.{canEdit && ' Click "Add" to create one.'}
            </p>
          ) : (
            <>
              {/* Totals (active only) */}
              <CRow className="g-2 mb-3">
                <CCol xs={6}>
                  <div className="border rounded p-2 text-center">
                    <div className="small text-body-secondary">Monthly (Active)</div>
                    <div className="fw-bold text-primary">{currency(totalMonthly)}</div>
                  </div>
                </CCol>
                <CCol xs={6}>
                  <div className="border rounded p-2 text-center">
                    <div className="small text-body-secondary">Annual (Active)</div>
                    <div className="fw-bold text-primary">{currency(totalAnnual)}</div>
                  </div>
                </CCol>
              </CRow>

              {/* Entries table */}
              <CTable small hover responsive className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Vendor</CTableHeaderCell>
                    <CTableHeaderCell>Expense Category</CTableHeaderCell>
                    <CTableHeaderCell>Frequency</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Annual</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Monthly Equiv.</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    {canEdit && <CTableHeaderCell />}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {entries.map((entry) => (
                    <CTableRow key={entry.id}>
                      <CTableDataCell className="fw-semibold small">
                        {entry.vendor_name}
                      </CTableDataCell>
                      <CTableDataCell className="small">{entry.expense_category}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="info" textColor="dark" className="small">
                          {entry.frequency}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="text-end small fw-semibold">
                        {currency(entry.annual_amount)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end small text-body-secondary">
                        {currency(monthlyEquiv(entry.annual_amount))}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge
                          color={STATUS_COLORS[entry.status] || 'secondary'}
                          className="small"
                        >
                          {entry.status}
                        </CBadge>
                      </CTableDataCell>
                      {canEdit && (
                        <CTableDataCell>
                          <CButton
                            color="secondary"
                            variant="ghost"
                            size="sm"
                            className="me-1"
                            onClick={() => openEdit(entry)}
                            title="Edit"
                          >
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton
                            color="danger"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(entry)}
                            title="Delete"
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </CTableDataCell>
                      )}
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </>
          )}
        </CCardBody>
      </CCard>

      {showModal && (
        <ExpenseModal
          form={form}
          setForm={setForm}
          editTarget={editTarget}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={error}
        />
      )}

      {deleteTarget && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Admin Expense</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                />
              </div>
              <div className="modal-body">
                Delete <strong>{deleteTarget.vendor_name}</strong> — {deleteTarget.expense_category}
                ? This cannot be undone.
              </div>
              <div className="modal-footer">
                <CButton
                  color="secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </CButton>
                <CButton color="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting && <CSpinner size="sm" className="me-1" />}
                  Delete
                </CButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

AdminDivisionPanel.propTypes = {
  canEdit: PropTypes.bool,
}

export default AdminDivisionPanel
