import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
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
import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import { localRecruitments } from '../../../services/localRecruitments'
import { localRecruitmentDocuments } from '../../../services/localRecruitmentDocuments'
import DocumentLibraryPanel from '../shared/DocumentLibraryPanel'

const RECRUIT_STATUSES = ['Applied', 'Shortlisted', 'Selected', 'Rejected', 'Joined']
const PAYMENT_STATUSES = ['Pending', 'Paid', 'NA']
const ACTIVITY_TYPES = [
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'training', label: 'Training' },
]

const STATUS_COLORS = {
  Applied: 'secondary',
  Shortlisted: 'warning',
  Selected: 'info',
  Rejected: 'danger',
  Joined: 'success',
}
const PAY_COLORS = { Paid: 'success', Pending: 'warning', NA: 'secondary' }

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const EMPTY_FORM = {
  activity_type: 'recruitment',
  candidate_name: '',
  position: '',
  department: '',
  date_applied: '',
  interview_date: '',
  status: 'Applied',
  amount_received: '',
  amount_receivable: '',
  payment_status: 'Pending',
  remarks: '',
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const RecruitModal = ({ form, setForm, editTarget, onSave, onClose, saving, error }) => {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isTraining = form.activity_type === 'training'

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {editTarget ? 'Edit Record' : isTraining ? 'Add Training' : 'Add Candidate'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <div className="modal-body">
            {error && (
              <CAlert color="danger" className="py-2 mb-3">
                {error}
              </CAlert>
            )}

            {/* Basic Details */}
            <p className="fw-semibold text-body-secondary small text-uppercase mb-2 mt-1">
              Basic Details
            </p>
            <CRow className="g-3 mb-3">
              <CCol md={6}>
                <CFormLabel className="fw-semibold">Type</CFormLabel>
                <CFormSelect
                  value={form.activity_type}
                  onChange={(e) => set('activity_type', e.target.value)}
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  {isTraining ? 'Trainee Name' : 'Candidate Name'}{' '}
                  <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  value={form.candidate_name}
                  onChange={(e) => set('candidate_name', e.target.value)}
                  placeholder="Full name"
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel className="fw-semibold">
                  {isTraining ? 'Training Topic' : 'Position Applied'}
                </CFormLabel>
                <CFormInput
                  value={form.position}
                  onChange={(e) => set('position', e.target.value)}
                  placeholder={isTraining ? 'e.g. Excel Fundamentals' : 'e.g. Data Entry Operator'}
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Department</CFormLabel>
                <CFormInput
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                  placeholder="e.g. HR"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Date Applied</CFormLabel>
                <CFormInput
                  type="date"
                  value={form.date_applied}
                  onChange={(e) => set('date_applied', e.target.value)}
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Interview Date</CFormLabel>
                <CFormInput
                  type="date"
                  value={form.interview_date}
                  onChange={(e) => set('interview_date', e.target.value)}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel className="fw-semibold">Status</CFormLabel>
                <CFormSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {RECRUIT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>

            <hr className="my-2" />

            {/* Received Amount */}
            <p className="fw-semibold text-body-secondary small text-uppercase mb-2 mt-3">
              Received Amount
            </p>
            <CRow className="g-3">
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Amount Received (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount_received}
                  onChange={(e) => set('amount_received', e.target.value)}
                  placeholder="0"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Receivable (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount_receivable}
                  onChange={(e) => set('amount_receivable', e.target.value)}
                  placeholder="0"
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel className="fw-semibold">Payment Status</CFormLabel>
                <CFormSelect
                  value={form.payment_status}
                  onChange={(e) => set('payment_status', e.target.value)}
                >
                  {PAYMENT_STATUSES.map((s) => (
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
            <CButton color="primary" onClick={onSave} disabled={saving}>
              {saving && <CSpinner size="sm" className="me-1" />}
              {editTarget ? 'Save Changes' : isTraining ? 'Add Training' : 'Add Candidate'}
            </CButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────
const DeleteModal = ({ target, onConfirm, onClose }) => (
  <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">Delete Record</h5>
        </div>
        <div className="modal-body">
          Delete <strong>{target.candidate_name}</strong>? This cannot be undone.
        </div>
        <div className="modal-footer">
          <CButton color="secondary" onClick={onClose}>
            Cancel
          </CButton>
          <CButton color="danger" onClick={onConfirm}>
            Delete
          </CButton>
        </div>
      </div>
    </div>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────
const RecruitmentPage = () => {
  const canEdit = usePermission(MODULE.RECRUITMENT, 'edit')

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)

  const currentUser = useSelector((s) => s.user)
  const currentUserName = currentUser?.full_name || currentUser?.employee_id || 'Unknown'

  const load = async () => {
    const items = await localRecruitments.list({ search, status: filterStatus })
    setRows(items)
  }

  useEffect(() => {
    let cancelled = false
    localRecruitments.list({ search, status: filterStatus }).then((items) => {
      if (!cancelled) setRows(items)
    })
    return () => {
      cancelled = true
    }
  }, [search, filterStatus])

  const openAdd = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (row) => {
    setEditTarget(row)
    setForm({
      activity_type: row.activity_type || 'recruitment',
      candidate_name: row.candidate_name,
      position: row.position || '',
      department: row.department || '',
      date_applied: row.date_applied || '',
      interview_date: row.interview_date || '',
      status: row.status,
      amount_received: row.amount_received || '',
      amount_receivable: row.amount_receivable || '',
      payment_status: row.payment_status,
      remarks: row.remarks || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.candidate_name.trim()) {
      setFormError(
        form.activity_type === 'training'
          ? 'Trainee name is required'
          : 'Candidate name is required',
      )
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        activity_type: form.activity_type,
        candidate_name: form.candidate_name.trim(),
        position: form.position.trim() || null,
        department: form.department.trim() || null,
        date_applied: form.date_applied || null,
        interview_date: form.interview_date || null,
        status: form.status,
        amount_received: parseFloat(form.amount_received) || 0,
        amount_receivable: parseFloat(form.amount_receivable) || 0,
        payment_status: form.payment_status,
        remarks: form.remarks.trim() || null,
      }
      if (editTarget) {
        await localRecruitments.update(editTarget.id, payload)
      } else {
        await localRecruitments.create(payload)
      }
    } catch (e) {
      setFormError(e.message || 'Save failed')
      setSaving(false)
      return
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await localRecruitments.delete(deleteTarget.id)
    setDeleteTarget(null)
    load()
  }

  const joinedCount = rows.filter((r) => r.status === 'Joined').length
  const activeCount = rows.filter((r) => !['Rejected'].includes(r.status)).length
  const trainingCount = rows.filter((r) => r.activity_type === 'training').length
  const totalReceived = rows.reduce((sum, r) => sum + (Number(r.amount_received) || 0), 0)
  const paymentPendingCount = rows.filter((r) => r.payment_status === 'Pending').length
  const paymentPaidCount = rows.filter((r) => r.payment_status === 'Paid').length
  const paymentNaCount = rows.filter((r) => r.payment_status === 'NA').length

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Recruitment & Training</h4>
          <p className="text-body-secondary mb-0 small">
            Track candidates, trainees, pipeline status, and received amounts.
          </p>
        </div>
        {canEdit && (
          <div className="d-flex gap-2">
            <CButton color="primary" size="sm" onClick={openAdd}>
              <CIcon icon={cilPlus} className="me-1" /> Add Record
            </CButton>
          </div>
        )}
      </div>

      {/* Stats */}
      <CRow className="g-3 mb-4">
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-primary border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Total</div>
              <div className="fw-bold fs-5 text-primary">{rows.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-warning border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Active Pipeline</div>
              <div className="fw-bold fs-5 text-warning">{activeCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-info border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Training</div>
              <div className="fw-bold fs-5 text-info">{trainingCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-success border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Joined</div>
              <div className="fw-bold fs-5 text-success">{joinedCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Stats — payments */}
      <CRow className="g-3 mb-4">
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-success border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Total Received</div>
              <div className="fw-bold fs-5 text-success">{currency(totalReceived)}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-danger border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Payment Pending</div>
              <div className="fw-bold fs-5 text-danger">{paymentPendingCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-success border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Payment Paid</div>
              <div className="fw-bold fs-5 text-success">{paymentPaidCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className="border-top border-top-secondary border-3 text-center">
            <CCardBody className="py-3">
              <div className="small text-body-secondary mb-1">Payment N/A</div>
              <div className="fw-bold fs-5 text-secondary">{paymentNaCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Filters */}
      <CCard className="mb-3">
        <CCardBody>
          <CRow className="g-2">
            <CCol md={6}>
              <CFormLabel className="small fw-semibold">Search</CFormLabel>
              <CFormInput
                size="sm"
                placeholder="Name, position, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel className="small fw-semibold">Status</CFormLabel>
              <CFormSelect
                size="sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                {RECRUIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Table */}
      <CCard>
        <CCardBody className="p-0">
          <CTable small hover responsive className="mb-0">
            <CTableHead color="light">
              <CTableRow>
                <CTableHeaderCell style={{ width: 40 }}>#</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Candidate / Trainee Name</CTableHeaderCell>
                <CTableHeaderCell>Position / Topic</CTableHeaderCell>
                <CTableHeaderCell>Department</CTableHeaderCell>
                <CTableHeaderCell>Date Applied</CTableHeaderCell>
                <CTableHeaderCell>Interview Date</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Received</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Receivable</CTableHeaderCell>
                <CTableHeaderCell>Payment</CTableHeaderCell>
                {canEdit && <CTableHeaderCell>Actions</CTableHeaderCell>}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 && (
                <CTableRow>
                  <CTableDataCell
                    colSpan={canEdit ? 12 : 11}
                    className="text-center text-body-secondary py-5"
                  >
                    No recruitment or training records found.
                    {canEdit && ' Click "Add Record" to get started.'}
                  </CTableDataCell>
                </CTableRow>
              )}
              {rows.map((row, idx) => (
                <CTableRow key={row.id}>
                  <CTableDataCell className="text-body-secondary small">{idx + 1}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={row.activity_type === 'training' ? 'info' : 'primary'}>
                      {row.activity_type === 'training' ? 'Training' : 'Recruitment'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="fw-semibold">{row.candidate_name}</CTableDataCell>
                  <CTableDataCell className="small">{row.position || '—'}</CTableDataCell>
                  <CTableDataCell className="small">{row.department || '—'}</CTableDataCell>
                  <CTableDataCell className="small text-body-secondary">
                    {row.date_applied || '—'}
                  </CTableDataCell>
                  <CTableDataCell className="small text-body-secondary">
                    {row.interview_date || '—'}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={STATUS_COLORS[row.status] || 'secondary'}>{row.status}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-semibold text-success">
                    {currency(row.amount_received)}
                  </CTableDataCell>
                  <CTableDataCell className="text-end fw-semibold text-warning">
                    {currency(row.amount_receivable)}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={PAY_COLORS[row.payment_status] || 'secondary'}>
                      {row.payment_status}
                    </CBadge>
                  </CTableDataCell>
                  {canEdit && (
                    <CTableDataCell>
                      <CButton
                        color="secondary"
                        variant="ghost"
                        size="sm"
                        className="me-1"
                        onClick={() => openEdit(row)}
                        title="Edit"
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(row)}
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
        </CCardBody>
      </CCard>

      <div className="mt-3">
        <DocumentLibraryPanel
          documentsService={localRecruitmentDocuments}
          title="Files"
          canEdit={canEdit}
          currentUser={currentUserName}
        />
      </div>

      {showModal && (
        <RecruitModal
          form={form}
          setForm={setForm}
          editTarget={editTarget}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={formError}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

export default RecruitmentPage
