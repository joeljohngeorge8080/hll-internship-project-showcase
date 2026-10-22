import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilPencil, cilTrash } from '@coreui/icons'

import { usePermission } from '../../../hooks/usePermission'
import { MODULE } from '../../../constants/modules'
import api from '../../../services/api'
import { localGeneralExpenses } from '../../../services/localGeneralExpenses'
import VarianceBadge from './components/VarianceBadge'

const MONTHS = [
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

const STATUS_COLORS = {
  Pending: 'warning',
  Paid: 'success',
  Overdue: 'danger',
  Cancelled: 'secondary',
}

const currency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0)

const Row = ({ label, children }) => (
  <CRow className="mb-2">
    <CCol sm={4} className="text-body-secondary small fw-semibold">
      {label}
    </CCol>
    <CCol sm={8}>{children}</CCol>
  </CRow>
)

const GeneralExpenseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.GENERAL_EXPENSES, 'edit')

  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/general-expenses/${id}`)
        setExpense(data)
      } catch {
        try {
          setExpense(await localGeneralExpenses.expenses.get(id))
        } catch {
          setExpense(null)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/general-expenses/${id}`)
    } catch (err) {
      if (err.response?.status !== 404) {
        await localGeneralExpenses.expenses.delete(id)
      }
    }
    navigate('/ems/general-expenses')
  }

  if (loading)
    return (
      <div className="text-center py-5">
        <CSpinner />
      </div>
    )
  if (!expense) {
    return (
      <div>
        <CButton
          color="link"
          className="p-0 mb-3"
          onClick={() => navigate('/ems/general-expenses')}
        >
          <CIcon icon={cilArrowLeft} className="me-1" /> Back
        </CButton>
        <p className="text-danger">Expense record not found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <CButton color="link" className="p-0" onClick={() => navigate('/ems/general-expenses')}>
          <CIcon icon={cilArrowLeft} className="me-1" /> Back to Expenses
        </CButton>
        {canEdit && (
          <div className="d-flex gap-2">
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/ems/general-expenses/${id}/edit`)}
            >
              <CIcon icon={cilPencil} className="me-1" /> Edit
            </CButton>
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <CIcon icon={cilTrash} className="me-1" /> Delete
            </CButton>
          </div>
        )}
      </div>

      <CCard style={{ maxWidth: 680 }}>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>{expense.expense_name}</strong>
          <CBadge color={STATUS_COLORS[expense.status] || 'secondary'}>{expense.status}</CBadge>
        </CCardHeader>
        <CCardBody>
          <Row label="Category">
            <CBadge color="info" textColor="dark">
              {expense.category_name}
            </CBadge>
          </Row>
          <Row label="Period">
            {MONTHS[expense.month]} {expense.year}
          </Row>
          <Row label="Frequency">
            <span className="text-body-secondary">{expense.frequency}</span>
          </Row>

          <hr />

          <Row label="Planned Amount">
            <span className="fw-semibold text-primary">{currency(expense.planned_amount)}</span>
          </Row>
          <Row label="Actual Amount">
            <span className="fw-semibold text-info">{currency(expense.actual_amount)}</span>
          </Row>
          <Row label="Variance">
            <VarianceBadge variance={expense.variance} />
            <span className="small text-body-secondary ms-2">
              {expense.variance > 0
                ? 'over budget'
                : expense.variance < 0
                  ? 'under budget'
                  : 'on budget'}
            </span>
          </Row>

          {expense.remarks && (
            <>
              <hr />
              <Row label="Remarks">
                <span className="text-body-secondary">{expense.remarks}</span>
              </Row>
            </>
          )}

          {expense.upload_id && (
            <Row label="Source">
              <CBadge color="secondary">Excel Upload</CBadge>
            </Row>
          )}

          <hr />
          <Row label="Created">
            <span className="small text-body-secondary">
              {new Date(expense.created_at).toLocaleString('en-IN')}
            </span>
          </Row>
          <Row label="Last Updated">
            <span className="small text-body-secondary">
              {new Date(expense.updated_at).toLocaleString('en-IN')}
            </span>
          </Row>
        </CCardBody>
      </CCard>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Expense</h5>
              </div>
              <div className="modal-body">
                Delete <strong>{expense.expense_name}</strong>? This cannot be undone.
              </div>
              <div className="modal-footer">
                <CButton
                  color="secondary"
                  onClick={() => setConfirmDelete(false)}
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

export default GeneralExpenseDetail
