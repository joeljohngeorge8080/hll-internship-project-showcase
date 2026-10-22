import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CCol,
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
import { cilPencil, cilPlus, cilTrash, cilPeople } from '@coreui/icons'
import { localCoreSalaries } from '../../../../services/localCoreSalaries'
import { localEmployees } from '../../../../services/localEmployees'
import { localSalaryDetails } from '../../../../services/localSalaryDetails'
import { computeEffectiveCTC } from '../../staff-payroll/ctcUtils'

const STATUS_COLORS = {
  Pending: 'warning',
  Paid: 'success',
  Overdue: 'danger',
  Cancelled: 'secondary',
}
const STATUSES = ['Pending', 'Paid', 'Overdue', 'Cancelled']

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

// Total Invoice reuses the same CTC engine Staff & Payroll's Salary Invoice
// page uses (ctcUtils.computeEffectiveCTC, with that record's own
// ctcOverrides — HRA/OA are HR-entered per record, not derived, so ignoring
// ctcOverrides here would silently undercount), keyed by employee code +
// that entry's own month/year — not the panel's current filter — so it's
// correct even when viewing "All Months". Employees with no salary details
// entered yet for that period show 0, same as an un-generated invoice
// would. Fetched once per `entries` load into `invoicesById` (async
// Supabase reads can't happen inline during render), keyed by the
// core_salaries entry id.
const invoiceForDetails = (details) =>
  details ? computeEffectiveCTC(details, details.ctcOverrides || {}).totalInvoiceAmount : 0

const EMPTY_FORM = {
  employee_id: '',
  employee_name: '',
  employee_code: '',
  status: 'Pending',
  remarks: '',
}

const CoreSalaryPanel = ({ year, month, canEdit }) => {
  const [entries, setEntries] = useState([])
  const [invoicesById, setInvoicesById] = useState({})
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addingTpc, setAddingTpc] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const list = await localCoreSalaries.list({ year, month })
    setEntries(list)
    const pairs = await Promise.all(
      list.map(async (entry) => {
        const details = await localSalaryDetails.get(entry.employee_code, entry.year, entry.month)
        return [entry.id, invoiceForDetails(details)]
      }),
    )
    setInvoicesById(Object.fromEntries(pairs))
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useEffect(() => {
    let cancelled = false
    localEmployees.list({ status: 'Active', pageSize: 500 }).then(({ items }) => {
      if (!cancelled) setEmployees(items)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const openAdd = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (entry) => {
    setEditTarget(entry)
    setForm({
      employee_id: entry.employee_id,
      employee_name: entry.employee_name,
      employee_code: entry.employee_code || '',
      status: entry.status,
      remarks: entry.remarks || '',
    })
    setShowModal(true)
  }

  const handleEmployeeChange = (empId) => {
    const emp = employees.find((e) => e.id === empId)
    if (emp) {
      setForm((f) => ({
        ...f,
        employee_id: empId,
        employee_name: emp.employee_name,
        employee_code: emp.employee_id,
      }))
    } else {
      setForm((f) => ({ ...f, employee_id: '', employee_name: '', employee_code: '' }))
    }
  }

  const handleSave = async () => {
    if (!form.employee_id) return
    setSaving(true)
    const payload = {
      employee_id: form.employee_id,
      employee_name: form.employee_name,
      employee_code: form.employee_code,
      month,
      year,
      status: form.status,
      remarks: form.remarks.trim() || null,
    }
    if (editTarget) {
      await localCoreSalaries.update(editTarget.id, payload)
    } else {
      await localCoreSalaries.create(payload)
    }
    setSaving(false)
    setShowModal(false)
    await loadEntries()
  }

  // Bulk-adds every Active TPC-category employee not already on this period's
  // sheet, so HR doesn't have to add them one by one via the modal.
  const handleAddAllTpc = async () => {
    const tpcEmployees = employees.filter((e) => e.employee_category === 'TPC')
    const existingIds = new Set(entries.map((e) => e.employee_id))
    const toAdd = tpcEmployees.filter((e) => !existingIds.has(e.id))
    if (toAdd.length === 0) return
    setAddingTpc(true)
    await Promise.all(
      toAdd.map((emp) =>
        localCoreSalaries.create({
          employee_id: emp.id,
          employee_name: emp.employee_name,
          employee_code: emp.employee_id,
          month,
          year,
          status: 'Pending',
          remarks: null,
        }),
      ),
    )
    setAddingTpc(false)
    await loadEntries()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await localCoreSalaries.delete(deleteTarget.id)
    setDeleteTarget(null)
    await loadEntries()
  }

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = entries.filter((e) => e.status === s).length
    return acc
  }, {})
  const totalInvoice = entries.reduce((s, e) => s + (invoicesById[e.id] || 0), 0)

  return (
    <>
      <CCard className="border-top border-top-success border-3">
        <CCardHeader>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <strong>Core — Employee Salaries</strong>
              <div className="small text-body-secondary mt-1">
                Staff payroll status for the selected period
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="text-end">
                <div className="small text-body-secondary">Total Invoice</div>
                <div className="fw-bold text-success">{currency(totalInvoice)}</div>
              </div>
              <CBadge color="success" className="fs-6 px-3 py-2">
                {entries.length} employee{entries.length !== 1 ? 's' : ''}
              </CBadge>
              {canEdit && (
                <>
                  <CButton
                    color="success"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAllTpc}
                    disabled={addingTpc}
                  >
                    <CIcon icon={cilPeople} className="me-1" /> Add All TPC
                  </CButton>
                  <CButton color="success" size="sm" onClick={openAdd}>
                    <CIcon icon={cilPlus} className="me-1" /> Add Employee
                  </CButton>
                </>
              )}
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-4">
              <CSpinner color="success" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-body-secondary small mb-0">
              No salary entries for this period.
              {canEdit && ' Click "Add Employee" to add one.'}
            </p>
          ) : (
            <>
              {/* Status summary */}
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {STATUSES.map((s) =>
                  statusCounts[s] > 0 ? (
                    <CBadge key={s} color={STATUS_COLORS[s]}>
                      {statusCounts[s]} {s}
                    </CBadge>
                  ) : null,
                )}
              </div>

              {/* Table */}
              <CTable small hover responsive className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Employee</CTableHeaderCell>
                    <CTableHeaderCell>Employee ID</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Total Invoice</CTableHeaderCell>
                    <CTableHeaderCell>Remarks</CTableHeaderCell>
                    {canEdit && <CTableHeaderCell>Actions</CTableHeaderCell>}
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {entries.map((entry) => (
                    <CTableRow key={entry.id}>
                      <CTableDataCell className="fw-semibold">{entry.employee_name}</CTableDataCell>
                      <CTableDataCell className="text-body-secondary small">
                        {entry.employee_code}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLORS[entry.status] || 'secondary'}>
                          {entry.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="text-end small fw-semibold">
                        {currency(invoicesById[entry.id] || 0)}
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">
                        {entry.remarks || '—'}
                      </CTableDataCell>
                      {canEdit && (
                        <CTableDataCell>
                          <CButton
                            color="secondary"
                            variant="ghost"
                            size="sm"
                            className="me-1"
                            onClick={() => openEdit(entry)}
                          >
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton
                            color="danger"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(entry)}
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editTarget ? 'Edit Salary Entry' : 'Add Employee'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <CRow className="g-3">
                  <CCol md={12}>
                    <CFormLabel className="fw-semibold">
                      Employee <span className="text-danger">*</span>
                    </CFormLabel>
                    {editTarget ? (
                      <div className="form-control bg-body-secondary">
                        {form.employee_name}
                        {form.employee_code ? ` (${form.employee_code})` : ''}
                      </div>
                    ) : (
                      <CFormSelect
                        value={form.employee_id}
                        onChange={(e) => handleEmployeeChange(e.target.value)}
                      >
                        <option value="">Select employee…</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.employee_name} ({emp.employee_id})
                          </option>
                        ))}
                      </CFormSelect>
                    )}
                  </CCol>

                  <CCol md={6}>
                    <CFormLabel className="fw-semibold">Status</CFormLabel>
                    <CFormSelect
                      value={form.status}
                      onChange={(e) => set('status', e.target.value)}
                    >
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
                <CButton color="secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </CButton>
                <CButton
                  color="primary"
                  onClick={handleSave}
                  disabled={saving || !form.employee_id}
                >
                  {saving && <CSpinner size="sm" className="me-1" />}
                  {editTarget ? 'Save Changes' : 'Add Entry'}
                </CButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Remove Salary Entry</h5>
              </div>
              <div className="modal-body">
                Remove <strong>{deleteTarget.employee_name}</strong> from this period's payroll?
              </div>
              <div className="modal-footer">
                <CButton color="secondary" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </CButton>
                <CButton color="danger" onClick={handleDelete}>
                  Remove
                </CButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

CoreSalaryPanel.propTypes = {
  year: PropTypes.number,
  month: PropTypes.number,
  canEdit: PropTypes.bool,
}

export default CoreSalaryPanel
