import React, { useEffect, useMemo, useState } from 'react'
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
  CProgress,
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
import api from '../../../../services/api'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'
import useRole from '../../../../hooks/useRole'
import { ROLE } from '../../../../constants/roles'
import CoreSalaryPanel from './CoreSalaryPanel'
import AdminDivisionPanel from './AdminDivisionPanel'

const MONTHS_LABEL = [
  '',
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
const MONTHS_OPT = [
  { v: 1, l: 'January' },
  { v: 2, l: 'February' },
  { v: 3, l: 'March' },
  { v: 4, l: 'April' },
  { v: 5, l: 'May' },
  { v: 6, l: 'June' },
  { v: 7, l: 'July' },
  { v: 8, l: 'August' },
  { v: 9, l: 'September' },
  { v: 10, l: 'October' },
  { v: 11, l: 'November' },
  { v: 12, l: 'December' },
]
const THIS_YEAR = new Date().getFullYear()
const YEARS = [THIS_YEAR - 2, THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1]
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Annually', 'One-time']
const STATUSES = ['Pending', 'Paid', 'Overdue', 'Cancelled']

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const STATUS_COLORS = {
  Pending: 'warning',
  Paid: 'success',
  Overdue: 'danger',
  Cancelled: 'secondary',
}

// Outsourced Services (HK, Security, City salaries) + HR Operations
// (vehicle, website, photocopier, desktop rental, internet) — HR division
const HR_CATEGORY_NAMES = new Set(['Outsourced Services', 'HR Operations'])

const HR_DIVISION = {
  key: 'hr',
  label: 'HR Expense Directly Linked to Project',
  description:
    'Outsourced workforce costs and HR-booked operations (HK, Security, City staff, vehicle, website, IT)',
  color: 'info',
  matchFn: (catId, catName) => HR_CATEGORY_NAMES.has(catName),
  filterCats: (cats) => cats.filter((c) => HR_CATEGORY_NAMES.has(c.name)),
}

// ── Inline expense form modal ─────────────────────────────────────────────────

const EMPTY_FORM = {
  category_id: '',
  expense_name: '',
  month: new Date().getMonth() + 1,
  year: THIS_YEAR,
  frequency: 'Monthly',
  planned_amount: '',
  actual_amount: '',
  status: 'Pending',
  remarks: '',
}

const ExpenseModal = ({
  title,
  form,
  setForm,
  divCategories,
  allCategories,
  onSave,
  onClose,
  saving,
  error,
  isHrDivision,
}) => {
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const variance =
    form.planned_amount !== '' && form.actual_amount !== ''
      ? parseFloat(
          (parseFloat(form.actual_amount || 0) - parseFloat(form.planned_amount || 0)).toFixed(2),
        )
      : null

  const hidePlanned = isHrDivision || HR_CATEGORY_IDS.has(form.category_id)

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <div className="modal-body">
            {error && (
              <CAlert color="danger" className="py-2">
                {error}
              </CAlert>
            )}
            <CRow className="g-3">
              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Category <span className="text-danger">*</span>
                </CFormLabel>
                {divCategories.length === 1 ? (
                  /* Single-category division (e.g. HR) — lock it, no accidental blank selection */
                  <div className="form-control bg-body-secondary">{divCategories[0].name}</div>
                ) : (
                  <CFormSelect
                    value={form.category_id}
                    onChange={(e) => set('category_id', e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {(divCategories.length > 0 ? divCategories : allCategories).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </CFormSelect>
                )}
              </CCol>

              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  Expense Name <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.expense_name}
                  onChange={(e) => set('expense_name', e.target.value)}
                  placeholder="e.g. Housekeeping Salary"
                />
              </CCol>

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Month</CFormLabel>
                <CFormSelect
                  value={form.month}
                  onChange={(e) => set('month', parseInt(e.target.value))}
                >
                  {MONTHS_OPT.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.l}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Year</CFormLabel>
                <CFormSelect
                  value={form.year}
                  onChange={(e) => set('year', parseInt(e.target.value))}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol sm={4}>
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

              {!hidePlanned && (
                <>
                  <CCol sm={4}>
                    <CFormLabel className="fw-semibold">
                      Planned Amount (₹) <span className="text-danger">*</span>
                    </CFormLabel>
                    <CFormInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.planned_amount}
                      onChange={(e) => set('planned_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </CCol>
                </>
              )}

              <CCol sm={4}>
                <CFormLabel className="fw-semibold">Actual Amount (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_amount}
                  onChange={(e) => set('actual_amount', e.target.value)}
                  placeholder="0.00"
                />
              </CCol>

              {!hidePlanned && (
                <CCol sm={4}>
                  <CFormLabel className="fw-semibold">Variance</CFormLabel>
                  <div
                    className={`form-control bg-body-secondary ${
                      variance === null
                        ? ''
                        : variance > 0
                          ? 'text-danger'
                          : variance < 0
                            ? 'text-success'
                            : ''
                    }`}
                    style={{ userSelect: 'none' }}
                  >
                    {variance === null
                      ? '—'
                      : `${variance > 0 ? '+' : ''}${new Intl.NumberFormat('en-IN').format(variance)}`}
                  </div>
                </CCol>
              )}

              <CCol sm={6}>
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
                  placeholder="Optional notes (vendor, reference, etc.)"
                />
              </CCol>
            </CRow>
          </div>
          <div className="modal-footer">
            <CButton color="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </CButton>
            <CButton color="primary" onClick={onSave} disabled={saving}>
              {saving && <CSpinner size="sm" className="me-1" />}
              Save
            </CButton>
          </div>
        </div>
      </div>
    </div>
  )
}

ExpenseModal.propTypes = {
  title: PropTypes.string.isRequired,
  form: PropTypes.object.isRequired,
  setForm: PropTypes.func.isRequired,
  divCategories: PropTypes.array.isRequired,
  allCategories: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  error: PropTypes.string,
}

// ── Division card ─────────────────────────────────────────────────────────────

const DivisionCard = ({ division, expenses, categories, canEdit, month, year, onRefresh }) => {
  const divExpenses = expenses.filter((e) =>
    division.matchFn(
      e.category_id,
      e.category_name || categories.find((c) => c.id === e.category_id)?.name,
    ),
  )
  const divCategories = division.filterCats(categories)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const totalPlanned = divExpenses.reduce((s, e) => s + parseFloat(e.planned_amount || 0), 0)
  const totalActual = divExpenses.reduce((s, e) => s + parseFloat(e.actual_amount || 0), 0)
  const variance = totalActual - totalPlanned
  const paidCount = divExpenses.filter((e) => e.status === 'Paid').length
  const pendingCount = divExpenses.filter((e) => e.status === 'Pending').length
  const overdueCount = divExpenses.filter((e) => e.status === 'Overdue').length
  const utilizationPct =
    totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0

  const openAdd = () => {
    setEditTarget(null)
    setError('')
    const defaultCat = divCategories.length === 1 ? divCategories[0].id : ''
    setForm({
      ...EMPTY_FORM,
      category_id: defaultCat,
      month: month || new Date().getMonth() + 1,
      year: year || THIS_YEAR,
    })
    setShowModal(true)
  }

  const openEdit = (exp) => {
    setEditTarget(exp)
    setError('')
    setForm({
      category_id: exp.category_id,
      expense_name: exp.expense_name,
      month: exp.month,
      year: exp.year,
      frequency: exp.frequency,
      planned_amount: exp.planned_amount,
      actual_amount: exp.actual_amount,
      status: exp.status,
      remarks: exp.remarks || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.category_id) {
      setError('Select a category')
      return
    }
    if (!form.expense_name.trim()) {
      setError('Expense name is required')
      return
    }
    const isHrDirectlyLinked = HR_CATEGORY_IDS.has(form.category_id)

    if (!isHrDirectlyLinked && (form.planned_amount === '' || isNaN(parseFloat(form.planned_amount)))) {
      setError('Planned amount is required')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      category_id: form.category_id,
      expense_name: form.expense_name.trim(),
      month: parseInt(form.month),
      year: parseInt(form.year),
      frequency: form.frequency,
      planned_amount: isHrDirectlyLinked ? 0 : parseFloat(form.planned_amount),
      actual_amount: parseFloat(form.actual_amount || 0),
      status: form.status,
      remarks: form.remarks.trim() || null,
    }

    try {
      if (editTarget) {
        await api.patch(`/general-expenses/${editTarget.id}`, payload)
      } else {
        await api.post('/general-expenses', payload)
      }
    } catch {
      try {
        if (editTarget) {
          await localGeneralExpenses.expenses.update(editTarget.id, payload)
        } else {
          await localGeneralExpenses.expenses.create(payload)
        }
      } catch (localErr) {
        setError(localErr.message || 'Save failed')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setShowModal(false)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/general-expenses/${deleteTarget.id}`)
    } catch {
      await localGeneralExpenses.expenses.delete(deleteTarget.id)
    }
    setDeleting(false)
    setDeleteTarget(null)
    onRefresh()
  }

  return (
    <>
      <CCard className={`border-top border-top-${division.color} border-3 h-100`}>
        <CCardHeader>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <strong>{division.label}</strong>
              <div className="small text-body-secondary mt-1">{division.description}</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <CBadge color={division.color} className="fs-6 px-3 py-2">
                {divExpenses.length} item{divExpenses.length !== 1 ? 's' : ''}
              </CBadge>
              {canEdit && (
                <CButton color={division.color} size="sm" onClick={openAdd}>
                  <CIcon icon={cilPlus} className="me-1" /> Add
                </CButton>
              )}
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          {divExpenses.length === 0 ? (
            <p className="text-body-secondary small mb-0">
              No expense records for this division.
              {canEdit && ' Click "Add" to create one.'}
            </p>
          ) : (
            <>
              {/* Totals */}
              <CRow className="g-2 mb-3">
                {division.key !== 'hr' && (
                  <CCol xs={4}>
                    <div className="border rounded p-2 text-center">
                      <div className="small text-body-secondary">Planned</div>
                      <div className={`fw-bold text-${division.color}`}>{currency(totalPlanned)}</div>
                    </div>
                  </CCol>
                )}
                <CCol xs={division.key === 'hr' ? 12 : 4}>
                  <div className="border rounded p-2 text-center">
                    <div className="small text-body-secondary">Actual Total</div>
                    <div className="fw-bold">{currency(totalActual)}</div>
                  </div>
                </CCol>
                {division.key !== 'hr' && (
                  <CCol xs={4}>
                    <div className="border rounded p-2 text-center">
                      <div className="small text-body-secondary">Variance</div>
                      <div className={`fw-bold text-${variance > 0 ? 'danger' : 'success'}`}>
                        {variance > 0 ? '+' : ''}
                        {currency(variance)}
                      </div>
                    </div>
                  </CCol>
                )}
              </CRow>

              {/* Utilization bar */}
              {division.key !== 'hr' && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between small text-body-secondary mb-1">
                    <span>Budget utilisation</span>
                    <span>{utilizationPct}%</span>
                  </div>
                  <CProgress
                    value={utilizationPct}
                    color={
                      utilizationPct > 100
                        ? 'danger'
                        : utilizationPct > 85
                          ? 'warning'
                          : division.color
                    }
                    height={8}
                  />
                </div>
              )}

              {/* Status badges */}
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {paidCount > 0 && <CBadge color="success">{paidCount} Paid</CBadge>}
                {pendingCount > 0 && <CBadge color="warning">{pendingCount} Pending</CBadge>}
                {overdueCount > 0 && <CBadge color="danger">{overdueCount} Overdue</CBadge>}
              </div>

              {/* Individual expense rows */}
              <CTable small hover responsive className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Expense</CTableHeaderCell>
                    <CTableHeaderCell>Category</CTableHeaderCell>
                    {division.key !== 'hr' && (
                      <CTableHeaderCell className="text-end">Planned</CTableHeaderCell>
                    )}
                    <CTableHeaderCell className="text-end">Actual</CTableHeaderCell>
                    {division.key !== 'hr' && (
                      <CTableHeaderCell className="text-end">Variance</CTableHeaderCell>
                    )}
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    {canEdit && <CTableHeaderCell />}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {divExpenses.map((exp) => {
                    const v =
                      parseFloat(exp.actual_amount || 0) - parseFloat(exp.planned_amount || 0)
                    const catName =
                      categories.find((c) => c.id === exp.category_id)?.name ||
                      exp.category_name ||
                      'Unknown'
                    return (
                      <CTableRow key={exp.id}>
                        <CTableDataCell className="fw-semibold small">
                          {exp.expense_name}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="info" textColor="dark" className="small">
                            {catName}
                          </CBadge>
                        </CTableDataCell>
                        {division.key !== 'hr' && (
                          <CTableDataCell className="text-end small">
                            {currency(exp.planned_amount)}
                          </CTableDataCell>
                        )}
                        <CTableDataCell className="text-end small">
                          {currency(exp.actual_amount)}
                        </CTableDataCell>
                        {division.key !== 'hr' && (
                          <CTableDataCell
                            className={`text-end small fw-semibold text-${v > 0 ? 'danger' : 'success'}`}
                          >
                            {v > 0 ? '+' : ''}
                            {currency(v)}
                          </CTableDataCell>
                        )}
                        <CTableDataCell>
                          <CBadge
                            color={STATUS_COLORS[exp.status] || 'secondary'}
                            className="small"
                          >
                            {exp.status}
                          </CBadge>
                        </CTableDataCell>
                        {canEdit && (
                          <CTableDataCell>
                            <CButton
                              color="secondary"
                              variant="ghost"
                              size="sm"
                              className="me-1"
                              onClick={() => openEdit(exp)}
                              title="Edit expense"
                            >
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton
                              color="danger"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(exp)}
                              title="Delete expense"
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </CTableDataCell>
                        )}
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </>
          )}
        </CCardBody>
      </CCard>

      {showModal && (
        <ExpenseModal
          title={editTarget ? `Edit — ${editTarget.expense_name}` : `Add ${division.label}`}
          form={form}
          setForm={setForm}
          divCategories={divCategories}
          allCategories={categories}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={error}
          isHrDivision={division.key === 'hr'}
        />
      )}

      {deleteTarget && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Expense</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                />
              </div>
              <div className="modal-body">
                Delete <strong>{deleteTarget.expense_name}</strong>? This cannot be undone.
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

DivisionCard.propTypes = {
  division: PropTypes.object.isRequired,
  expenses: PropTypes.array.isRequired,
  categories: PropTypes.array.isRequired,
  canEdit: PropTypes.bool,
  month: PropTypes.number,
  year: PropTypes.number,
  onRefresh: PropTypes.func.isRequired,
}

// ── DivisionsSummary ──────────────────────────────────────────────────────────

const DivisionsSummary = ({ year, month }) => {
  const role = useRole()
  const canEdit = role === ROLE.HR

  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const onRefresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page_size: 500 })
        if (year) params.set('year', year)
        if (month) params.set('month', month)
        const [expRes, catRes] = await Promise.all([
          api.get(`/general-expenses?${params}`),
          api.get('/general-expenses/categories'),
        ])
        setExpenses(expRes.data.items || [])
        setCategories(catRes.data || [])
      } catch {
        const result = await localGeneralExpenses.expenses.list({
          year: year || undefined,
          month: month || undefined,
          page_size: 500,
        })
        setExpenses(result.items || [])
        setCategories(await localGeneralExpenses.categories.list())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year, month, refreshKey])

  const totalPlanned = useMemo(
    () => expenses.reduce((s, e) => s + parseFloat(e.planned_amount || 0), 0),
    [expenses],
  )
  const totalActual = useMemo(
    () => expenses.reduce((s, e) => s + parseFloat(e.actual_amount || 0), 0),
    [expenses],
  )

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  const periodLabel =
    month && year ? `${MONTHS_LABEL[month]} ${year}` : year ? `Year ${year}` : 'All Time'

  return (
    <>
      {/* Overall header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <strong className="fs-6">Divisions Overview</strong>
          <span className="text-body-secondary small ms-2">— {periodLabel}</span>
        </div>
        <div className="d-flex gap-3 text-center flex-wrap">
          <div>
            <div className="small text-body-secondary">HR Planned</div>
            <div className="fw-bold text-info">{currency(totalPlanned)}</div>
          </div>
          <div>
            <div className="small text-body-secondary">HR Actual</div>
            <div className="fw-bold">{currency(totalActual)}</div>
          </div>
          <div>
            <div className="small text-body-secondary">HR Variance</div>
            <div className={`fw-bold text-${totalActual > totalPlanned ? 'danger' : 'success'}`}>
              {currency(Math.abs(totalActual - totalPlanned))}
              <span className="small ms-1">{totalActual > totalPlanned ? 'over' : 'under'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HR then Admin — stacked */}
      <div className="d-flex flex-column gap-4 mb-4">
        <DivisionCard
          division={HR_DIVISION}
          expenses={expenses}
          categories={categories}
          canEdit={canEdit}
          month={month}
          year={year}
          onRefresh={onRefresh}
        />
        <AdminDivisionPanel canEdit={canEdit} />
      </div>

      {/* Core — full width */}
      <CoreSalaryPanel year={year} month={month} canEdit={canEdit} />
    </>
  )
}

DivisionsSummary.propTypes = {
  year: PropTypes.number,
  month: PropTypes.number,
}

export default DivisionsSummary
