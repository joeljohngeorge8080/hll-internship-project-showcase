import React, { useState, useEffect } from 'react'
import {
  CAlert,
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CBadge,
  CSpinner,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilFile } from '@coreui/icons'
import supabase from '../../../services/supabase'
import { localOrgPool } from '../../../services/localOrgPool'
import BookExpenseModal from './BookExpenseModal'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

const APPROVAL_BADGE_COLOR = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
}

// ─── Expense Pool Card (shared HR / Admin / Core expense-adding card) ─────────
// The "Add New Expense" flow itself lives in BookExpenseModal.jsx — this
// component now only owns the trigger button and the list of already-booked
// expenses.
const ExpensePoolCard = ({
  poolType,
  poolLabel,
  poolFundLabel,
  hrRevenueTotal,
  lsgbRevenueTotal,
  hrRevenueBreakdown,
  getAdminPoolBalance,
  expenseDropdownItems,
  onPickExpense,
  employeeCheckboxItems,
  onBulkAddEmployees,
  getAllEmployees,
  getExpenses,
  addExpense,
  removeExpense,
  updateExpense,
  getPoolBalance,
  onExpenseChanged,
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [allExpenses, setAllExpenses] = useState([])
  const [receiptUrls, setReceiptUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const reload = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const expenses = await getExpenses()
      setAllExpenses(expenses)
      const urls = {}
      await Promise.all(
        expenses
          .filter((e) => e.receipt_storage_path)
          .map(async (e) => {
            urls[e.id] = await localOrgPool.getExpenseReceiptUrl(e)
          }),
      )
      setReceiptUrls(urls)
    } catch (err) {
      setLoadError(err.message || `Failed to load ${poolLabel} expenses`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload() // eslint-disable-line react-hooks/set-state-in-effect

    // Own subscription (separate from the parent page's wallet-balance one)
    // since this card's booked-expense list isn't touched by the parent's
    // reload(). Channel name is per-poolType — HR/Admin/Core cards all mount
    // at once (CTabPane keeps inactive tabs mounted), so each needs its own.
    const channel = supabase
      .channel(`expense-pool-card-${poolType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_expenses' }, reload)
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemove = async (id) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    await removeExpense(id)
    await reload()
    if (onExpenseChanged) onExpenseChanged()
  }

  const openAdd = () => {
    setEditingExpense(null)
    setModalOpen(true)
  }

  const openEdit = (exp) => {
    setEditingExpense(exp)
    setModalOpen(true)
  }

  const handleSaved = async () => {
    await reload()
    if (onExpenseChanged) await onExpenseChanged()
  }

  return (
    <CCard className="shadow-sm border-top border-4 border-top-success mb-4">
      <CCardHeader className="bg-transparent fw-semibold pt-3 d-flex justify-content-between align-items-center">
        <div>
          <span>Manage Organization-Wide {poolLabel} Expenses</span>
          {poolType === 'hr' && (
            <div
              className="text-body-secondary mt-1"
              style={{ fontSize: '0.75rem', fontWeight: 'normal' }}
            >
              (Note: The HR expenses here represent the total HR amounts from all projects)
            </div>
          )}
        </div>
        <CBadge color="success" shape="rounded-pill">
          {allExpenses.length} Total Expenses
        </CBadge>
      </CCardHeader>
      <CCardBody>
        <div className="mb-4">
          <CButton size="sm" color="success" onClick={openAdd} id={`btn-add-${poolType}-expense`}>
            <CIcon icon={cilPlus} className="me-1" />
            Add New {poolLabel} Expense
          </CButton>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <CSpinner size="sm" />
          </div>
        ) : loadError ? (
          <CAlert color="danger" className="small mb-0">
            Couldn't load {poolLabel} expenses — {loadError}
          </CAlert>
        ) : allExpenses.length === 0 ? (
          <div className="text-center text-body-tertiary small py-4 bg-light rounded border border-dashed">
            No {poolLabel} expenses recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <CTable hover responsive small className="align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Date</CTableHeaderCell>
                  <CTableHeaderCell>Category / Vendor</CTableHeaderCell>
                  <CTableHeaderCell>Revenue Sources</CTableHeaderCell>
                  <CTableHeaderCell>Payment Mode</CTableHeaderCell>
                  <CTableHeaderCell>Approval</CTableHeaderCell>
                  <CTableHeaderCell>Receipt</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {allExpenses.map((exp) => {
                  const multi = (exp.revenue_sources?.length || 0) > 1
                  return (
                    <CTableRow key={exp.id}>
                      <CTableDataCell
                        className="text-body-secondary"
                        style={{ fontSize: '0.82rem' }}
                      >
                        {fmtDate(exp.date)}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="fw-semibold">{exp.label}</div>
                        <div className="text-body-secondary" style={{ fontSize: '0.78rem' }}>
                          {exp.vendor}
                          {exp.notes && ` · ${exp.notes}`}
                          {exp.bill_no && ` · Bill #${exp.bill_no}`}
                        </div>
                        <div className="text-body-tertiary" style={{ fontSize: '0.75rem' }}>
                          Distributed across {exp.project_allocations?.length || 0} active
                          project(s)
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex flex-wrap gap-1">
                          {exp.revenue_sources?.includes('hr_revenue') && (
                            <CBadge
                              color="info"
                              shape="rounded-pill"
                              style={{ fontSize: '0.65rem' }}
                            >
                              HR Revenue{multi ? ` ${exp.hr_revenue_pct}%` : ''}
                            </CBadge>
                          )}
                          {exp.revenue_sources?.includes('project_pool') && (
                            <CBadge
                              color="success"
                              shape="rounded-pill"
                              style={{ fontSize: '0.65rem' }}
                            >
                              {poolFundLabel}
                              {multi ? ` ${exp.project_pool_pct}%` : ''}
                            </CBadge>
                          )}
                          {exp.revenue_sources?.includes('admin_pool') && (
                            <CBadge
                              color="dark"
                              shape="rounded-pill"
                              style={{ fontSize: '0.65rem' }}
                            >
                              Admin 5% Share{multi ? ` ${exp.admin_share_pct}%` : ''}
                            </CBadge>
                          )}
                          {exp.revenue_sources?.includes('lsgb_revenue') && (
                            <CBadge
                              color="warning"
                              shape="rounded-pill"
                              style={{ fontSize: '0.65rem' }}
                            >
                              LSGB Revenue{multi ? ` ${exp.lsgb_revenue_pct}%` : ''}
                            </CBadge>
                          )}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell style={{ fontSize: '0.82rem' }}>
                        {exp.payment_mode || '—'}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={APPROVAL_BADGE_COLOR[exp.approval_status] || 'secondary'}>
                          {exp.approval_status || 'Pending'}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        {receiptUrls[exp.id] ? (
                          <a
                            href={receiptUrls[exp.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={exp.receipt_file_name}
                          >
                            <CIcon icon={cilFile} />
                          </a>
                        ) : (
                          <span className="text-body-tertiary">—</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-bold text-success">
                        {fmt(exp.amount)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end">
                        <CButton
                          color="secondary"
                          variant="ghost"
                          size="sm"
                          title="Edit Expense"
                          onClick={() => openEdit(exp)}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          title="Remove Expense"
                          onClick={() => handleRemove(exp.id)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </div>
        )}
      </CCardBody>

      <BookExpenseModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        poolType={poolType}
        poolLabel={poolLabel}
        poolFundLabel={poolFundLabel}
        hrRevenueTotal={hrRevenueTotal}
        lsgbRevenueTotal={lsgbRevenueTotal}
        hrRevenueBreakdown={hrRevenueBreakdown}
        getAdminPoolBalance={getAdminPoolBalance}
        expenseDropdownItems={expenseDropdownItems}
        onPickExpense={onPickExpense}
        employeeCheckboxItems={employeeCheckboxItems}
        onBulkAddEmployees={onBulkAddEmployees}
        getAllEmployees={getAllEmployees}
        getPoolBalance={getPoolBalance}
        addExpense={addExpense}
        updateExpense={updateExpense}
        onDelete={removeExpense}
        editingExpense={editingExpense}
        onSaved={handleSaved}
      />
    </CCard>
  )
}

export default ExpensePoolCard
