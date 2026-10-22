/**
 * OfficerDashboardPage — Project Officer review dashboard.
 *
 * Route: /pms/daily-reports/review
 * Desktop-first table/card list of all submitted/resubmitted reports.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CFormInput,
  CFormSelect,
  CButton,
  CInputGroup,
  CInputGroupText,
  CToaster,
  CToast,
  CToastBody,
  CToastClose,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilFilterX, cilCheckCircle, cilXCircle, cilNotes } from '@coreui/icons'

import ReportCard from './components/ReportCard'
import DeclineReasonModal from './components/DeclineReasonModal'
import StatusBadge from './components/StatusBadge'
import { localReports, REPORT_STATUS } from '../../../services/localReports'

const OfficerDashboardPage = () => {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })
  const [toast, setToast] = useState(null)

  // Decline modal state
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [declineTargetId, setDeclineTargetId] = useState(null)
  const [declineLoading, setDeclineLoading] = useState(false)

  // Approve confirm modal state
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [approveTargetId, setApproveTargetId] = useState(null)
  const [approveLoading, setApproveLoading] = useState(false)

  const loadReports = useCallback(async () => {
    await localReports.seedDemoData()
    const result = await localReports.list({
      search: filters.search,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      pageSize: 100,
    })
    setReports(result.items)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', status: '', dateFrom: '', dateTo: '' })
  }

  const handleCardClick = (id) => {
    navigate(`/pms/daily-reports/review/${id}`)
  }

  // Approve flow
  const handleApproveClick = (id) => {
    setApproveTargetId(id)
    setApproveModalVisible(true)
  }

  const confirmApprove = async () => {
    setApproveLoading(true)
    try {
      await localReports.approve(approveTargetId)
      setToast({ color: 'success', message: 'Report approved and forwarded to backend team' })
      setApproveModalVisible(false)
      setApproveTargetId(null)
      await loadReports()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setApproveLoading(false)
  }

  // Decline flow
  const handleDeclineClick = (id) => {
    setDeclineTargetId(id)
    setDeclineModalVisible(true)
  }

  const confirmDecline = async (reason) => {
    setDeclineLoading(true)
    try {
      await localReports.decline(declineTargetId, 'project_officer', reason)
      setToast({ color: 'warning', message: 'Report declined and sent back to field personnel' })
      setDeclineModalVisible(false)
      setDeclineTargetId(null)
      await loadReports()
    } catch (err) {
      setToast({ color: 'danger', message: err.message })
    }
    setDeclineLoading(false)
  }

  // Stats
  const pendingCount = reports.filter(
    (r) => r.status === REPORT_STATUS.SUBMITTED || r.status === REPORT_STATUS.RESUBMITTED,
  ).length
  const approvedCount = reports.filter((r) => r.status === REPORT_STATUS.APPROVED).length
  const declinedCount = reports.filter((r) => r.status === REPORT_STATUS.DECLINED).length

  return (
    <>
      {/* Header */}
      <div className="mb-3">
        <h4 className="mb-1 fw-semibold">Review Reports</h4>
        <p className="text-body-secondary mb-0 small">
          Review and approve daily reports submitted by field personnel
        </p>
      </div>

      {/* Stats cards */}
      <CRow className="g-3 mb-3">
        <CCol xs={4} md={3}>
          <CCard
            className={`text-center shadow-sm border-top border-3 border-top-warning ${
              filters.status === 'submitted' ? 'bg-warning-subtle' : ''
            }`}
            role="button"
            onClick={() =>
              handleFilterChange('status', filters.status === 'submitted' ? '' : 'submitted')
            }
          >
            <CCardBody className="py-2">
              <div className="fs-4 fw-bold text-warning">{pendingCount}</div>
              <div className="small text-body-secondary">Pending</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={4} md={3}>
          <CCard
            className={`text-center shadow-sm border-top border-3 border-top-success ${
              filters.status === 'approved' ? 'bg-success-subtle' : ''
            }`}
            role="button"
            onClick={() =>
              handleFilterChange('status', filters.status === 'approved' ? '' : 'approved')
            }
          >
            <CCardBody className="py-2">
              <div className="fs-4 fw-bold text-success">{approvedCount}</div>
              <div className="small text-body-secondary">Approved</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={4} md={3}>
          <CCard
            className={`text-center shadow-sm border-top border-3 border-top-danger ${
              filters.status === 'declined' ? 'bg-danger-subtle' : ''
            }`}
            role="button"
            onClick={() =>
              handleFilterChange('status', filters.status === 'declined' ? '' : 'declined')
            }
          >
            <CCardBody className="py-2">
              <div className="fs-4 fw-bold text-danger">{declinedCount}</div>
              <div className="small text-body-secondary">Declined</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Filters */}
      <CCard className="mb-3 shadow-sm">
        <CCardBody className="py-3">
          <CRow className="g-2 align-items-end">
            <CCol xs={12} md={4}>
              <CInputGroup size="sm">
                <CInputGroupText>
                  <CIcon icon={cilSearch} size="sm" />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search topic or personnel..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={2}>
              <CFormSelect
                size="sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="submitted">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="resubmitted">Resubmitted</option>
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={2}>
              <CFormInput
                type="date"
                size="sm"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </CCol>
            <CCol xs={6} md={2}>
              <CFormInput
                type="date"
                size="sm"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </CCol>
            <CCol xs={6} md={2}>
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-100"
              >
                <CIcon icon={cilFilterX} size="sm" className="me-1" />
                Clear
              </CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Report list */}
      {reports.length === 0 ? (
        <CCard className="shadow-sm">
          <CCardBody className="text-center py-5">
            <div className="mb-3 text-body-secondary">
              <CIcon icon={cilNotes} style={{ width: 48, height: 48 }} />
            </div>
            <h5 className="text-body-secondary">No reports to review</h5>
            <p className="text-body-tertiary">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Reports submitted by field personnel will appear here'}
            </p>
          </CCardBody>
        </CCard>
      ) : (
        <div>
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={handleCardClick}
              onApprove={handleApproveClick}
              onDecline={handleDeclineClick}
              showActions
              showPersonnel
            />
          ))}
        </div>
      )}

      {/* Approve confirmation modal */}
      <CModal
        visible={approveModalVisible}
        onClose={() => setApproveModalVisible(false)}
        alignment="center"
      >
        <CModalHeader closeButton>
          <CModalTitle>Confirm Approval</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>
            Are you sure you want to approve this report? It will be forwarded to the backend team
            for settlement processing.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={() => setApproveModalVisible(false)}>
            Cancel
          </CButton>
          <CButton color="success" onClick={confirmApprove} disabled={approveLoading}>
            <CIcon icon={cilCheckCircle} className="me-1" />
            Confirm Approve
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Decline reason modal */}
      <DeclineReasonModal
        visible={declineModalVisible}
        onClose={() => setDeclineModalVisible(false)}
        onConfirm={confirmDecline}
        loading={declineLoading}
      />

      <CToaster placement="top-end">
        {toast && (
          <CToast
            autohide
            delay={3000}
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

export default OfficerDashboardPage
