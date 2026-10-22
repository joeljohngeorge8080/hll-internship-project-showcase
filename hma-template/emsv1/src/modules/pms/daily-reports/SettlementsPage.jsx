/**
 * SettlementsPage — Backend Team view for processing approved field bills.
 *
 * Route: /pms/settlements
 *
 * Tabs:
 *  • Pending Settlement — approved bills awaiting processing
 *  • Settled — already marked as settled, ready for merged report
 *
 * Actions:
 *  • "Mark as Settled" per bill
 *  • "Create Merged Report" — opens modal to bundle settled bills
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CBadge,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilCheckCircle, cilMoney, cilClock, cilFile, cilNotes } from '@coreui/icons'

import { localReports, REPORT_STATUS } from '../../../services/localReports'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const SettlementsPage = () => {
  const [activeTab, setActiveTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [approvedBills, setApprovedBills] = useState([])
  const [settledBills, setSettledBills] = useState([])

  // Modals
  const [settleModalVisible, setSettleModalVisible] = useState(false)
  const [settleTargetId, setSettleTargetId] = useState(null)
  const [settleLoading, setSettleLoading] = useState(false)

  const [toast, setToast] = useState(null)

  const loadData = useCallback(async () => {
    await localReports.seedDemoData()
    const q = search.toLowerCase()

    const [approvedResult, settledResult] = await Promise.all([
      localReports.list({ status: REPORT_STATUS.APPROVED, pageSize: 200 }),
      localReports.list({ status: REPORT_STATUS.SETTLED, pageSize: 200 }),
    ])

    const filterFn = (r) =>
      !q ||
      r.submitted_by_name?.toLowerCase().includes(q) ||
      r.bill_topic?.toLowerCase().includes(q)

    setApprovedBills(approvedResult.items.filter(filterFn))
    setSettledBills(settledResult.items.filter(filterFn))
  }, [search])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Settle single bill ────────────────────────────────────────────────────
  const handleSettleClick = (id) => {
    setSettleTargetId(id)
    setSettleModalVisible(true)
  }

  const confirmSettle = async () => {
    setSettleLoading(true)
    try {
      await localReports.markSettled(settleTargetId)
      setToast({ color: 'success', message: 'Bill marked as settled' })
      setSettleModalVisible(false)
      setSettleTargetId(null)
      await loadData()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setSettleLoading(false)
  }

  const totalApprovedAmt = approvedBills.reduce((s, b) => s + (b.amount || 0), 0)
  const totalSettledAmt = settledBills.reduce((s, b) => s + (b.amount || 0), 0)

  const BillTable = ({ bills, showSettleBtn }) =>
    bills.length === 0 ? (
      <div className="text-center py-5 text-body-secondary">
        <div className="mb-2 text-body-secondary">
          <CIcon
            icon={showSettleBtn ? cilFile : cilCheckCircle}
            style={{ width: 40, height: 40 }}
          />
        </div>
        <h6 className="text-body-secondary">
          {showSettleBtn ? 'No pending bills' : 'No settled bills yet'}
        </h6>
        <p className="small text-body-tertiary mb-0">
          {showSettleBtn
            ? 'Approved bills from Project Officer will appear here'
            : 'Mark approved bills as settled to see them here'}
        </p>
      </div>
    ) : (
      <div className="table-responsive">
        <CTable hover align="middle" className="mb-0">
          <CTableHead className="text-body-secondary bg-body-tertiary">
            <CTableRow>
              <CTableHeaderCell>Personnel</CTableHeaderCell>
              <CTableHeaderCell>Bill Topic</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
              <CTableHeaderCell>Date</CTableHeaderCell>
              <CTableHeaderCell>Approved At</CTableHeaderCell>
              {showSettleBtn && <CTableHeaderCell className="text-center">Action</CTableHeaderCell>}
              {!showSettleBtn && (
                <CTableHeaderCell className="text-center">Settled At</CTableHeaderCell>
              )}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {bills.map((bill) => (
              <CTableRow key={bill.id}>
                <CTableDataCell>
                  <div className="fw-medium">{bill.submitted_by_name}</div>
                </CTableDataCell>
                <CTableDataCell>
                  <div className="text-truncate" style={{ maxWidth: 260 }}>
                    {bill.bill_topic}
                  </div>
                  {bill.task_title && (
                    <div className="small text-info d-flex align-items-center gap-1">
                      <CIcon icon={cilNotes} size="sm" />
                      {bill.task_title}
                    </div>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-end fw-semibold">
                  {formatCurrency(bill.amount)}
                </CTableDataCell>
                <CTableDataCell className="small">{formatDate(bill.report_date)}</CTableDataCell>
                <CTableDataCell className="small text-body-secondary">
                  {bill.reviewed_at
                    ? new Date(bill.reviewed_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </CTableDataCell>
                {showSettleBtn && (
                  <CTableDataCell className="text-center">
                    <CButton color="primary" size="sm" onClick={() => handleSettleClick(bill.id)}>
                      <CIcon icon={cilCheckCircle} className="me-1" size="sm" />
                      Mark Settled
                    </CButton>
                  </CTableDataCell>
                )}
                {!showSettleBtn && (
                  <CTableDataCell className="text-center small text-body-secondary">
                    {bill.settled_at
                      ? new Date(bill.settled_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </CTableDataCell>
                )}
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
    )

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 className="fw-semibold mb-1">Settlements</h4>
          <p className="text-body-secondary mb-0 small">Process and settle approved field bills</p>
        </div>
      </div>

      {/* Summary cards */}
      <CRow className="g-3 mb-4">
        <CCol xs={12} md={4}>
          <CCard className="shadow-sm border-top border-3 border-top-warning h-100">
            <CCardBody className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-warning-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 48, height: 48 }}
              >
                <CIcon icon={cilClock} className="text-warning" />
              </div>
              <div>
                <div className="fs-4 fw-bold">{approvedBills.length}</div>
                <div className="small text-body-secondary">Pending Settlement</div>
                <div className="small fw-semibold text-warning">
                  {formatCurrency(totalApprovedAmt)}
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={4}>
          <CCard className="shadow-sm border-top border-3 border-top-primary h-100">
            <CCardBody className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 48, height: 48 }}
              >
                <CIcon icon={cilMoney} className="text-primary" />
              </div>
              <div>
                <div className="fs-4 fw-bold">{settledBills.length}</div>
                <div className="small text-body-secondary">Settled Bills</div>
                <div className="small fw-semibold text-primary">
                  {formatCurrency(totalSettledAmt)}
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={4}>
          <CCard className="shadow-sm border-top border-3 border-top-success h-100">
            <CCardBody className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-success-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 48, height: 48 }}
              >
                <CIcon icon={cilFile} className="text-success" />
              </div>
              <div>
                <div className="fs-4 fw-bold">
                  {formatCurrency(totalApprovedAmt + totalSettledAmt)}
                </div>
                <div className="small text-body-secondary">Total in Pipeline</div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Search */}
      <CCard className="shadow-sm mb-3">
        <CCardBody className="py-3">
          <CInputGroup size="sm">
            <CInputGroupText>
              <CIcon icon={cilSearch} size="sm" />
            </CInputGroupText>
            <CFormInput
              placeholder="Search by personnel name or bill topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CInputGroup>
        </CCardBody>
      </CCard>

      {/* Tabs */}
      <CCard className="shadow-sm">
        <CCardHeader className="pb-0">
          <CNav variant="underline">
            <CNavItem>
              <CNavLink
                active={activeTab === 'pending'}
                onClick={() => setActiveTab('pending')}
                style={{ cursor: 'pointer' }}
              >
                Pending Settlement
                {approvedBills.length > 0 && (
                  <CBadge color="warning" className="ms-2">
                    {approvedBills.length}
                  </CBadge>
                )}
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 'settled'}
                onClick={() => setActiveTab('settled')}
                style={{ cursor: 'pointer' }}
              >
                Settled
                {settledBills.length > 0 && (
                  <CBadge color="primary" className="ms-2">
                    {settledBills.length}
                  </CBadge>
                )}
              </CNavLink>
            </CNavItem>
          </CNav>
        </CCardHeader>
        <CCardBody className="p-0">
          <CTabContent>
            <CTabPane visible={activeTab === 'pending'}>
              <BillTable bills={approvedBills} showSettleBtn={true} />
            </CTabPane>
            <CTabPane visible={activeTab === 'settled'}>
              <BillTable bills={settledBills} showSettleBtn={false} />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>

      {/* Mark as Settled confirmation modal */}
      <CModal
        visible={settleModalVisible}
        onClose={() => setSettleModalVisible(false)}
        alignment="center"
      >
        <CModalHeader closeButton>
          <CModalTitle>Confirm Settlement</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            Mark this bill as <strong>Settled</strong>? It will be moved to the Settled tab.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            onClick={() => setSettleModalVisible(false)}
            disabled={settleLoading}
          >
            Cancel
          </CButton>
          <CButton color="primary" onClick={confirmSettle} disabled={settleLoading}>
            {settleLoading ? (
              <>
                <CSpinner size="sm" className="me-1" /> Processing...
              </>
            ) : (
              <>
                <CIcon icon={cilCheckCircle} className="me-1" />
                Mark as Settled
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Toast */}
      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3500}
            visible
            color={toast.color}
            className="text-white"
            onClose={() => setToast(null)}
          >
            <div className="d-flex">
              <CToastBody>{toast.message}</CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        )}
      </CToaster>
    </>
  )
}

export default SettlementsPage
