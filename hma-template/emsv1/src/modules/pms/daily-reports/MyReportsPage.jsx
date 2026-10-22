/**
 * MyReportsPage — Field Personnel's view of their own reports.
 *
 * Route: /pms/daily-reports/history
 * Shows a filterable list of reports with status indicators.
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
  CAlert,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilPlus, cilFilterX, cilNotes } from '@coreui/icons'

import ReportCard from './components/ReportCard'
import { localReports, REPORT_STATUS } from '../../../services/localReports'

const MyReportsPage = () => {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  const loadReports = useCallback(async () => {
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
    // Seed demo data on first visit
    localReports.seedDemoData().then(loadReports)
  }, [loadReports])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setFilters({ search: '', status: '', dateFrom: '', dateTo: '' })
  }

  // Already-loaded reports list has everything needed — avoids a second
  // network round-trip on every card click.
  const handleCardClick = (id) => {
    const report = reports.find((r) => r.id === id)
    if (report?.status === REPORT_STATUS.DECLINED) {
      if (report.report_type === 'task') {
        navigate(`/pms/tasks/report/${report.task_id}/edit/${report.id}`)
      } else {
        navigate(`/pms/daily-reports/${id}/edit`)
      }
    }
  }

  const declinedCount = reports.filter((r) => r.status === REPORT_STATUS.DECLINED).length

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1 fw-semibold">My Reports</h4>
          <p className="text-body-secondary mb-0 small">{total} total reports</p>
        </div>
        <CButton color="primary" onClick={() => navigate('/pms/daily-reports/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          New Report
        </CButton>
      </div>

      {/* Declined alert */}
      {declinedCount > 0 && (
        <CAlert color="danger" className="d-flex align-items-center gap-2 mb-3">
          <strong>{declinedCount}</strong> report(s) were declined and need your attention. Click on
          a declined report to edit and resubmit.
        </CAlert>
      )}

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
                  placeholder="Search bill topic..."
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
                <option value="draft">Draft</option>
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
                placeholder="From"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </CCol>
            <CCol xs={6} md={2}>
              <CFormInput
                type="date"
                size="sm"
                placeholder="To"
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
            <h5 className="text-body-secondary">No reports found</h5>
            <p className="text-body-tertiary mb-3">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Submit your first daily report to get started'}
            </p>
            {!filters.search && !filters.status && (
              <CButton color="primary" onClick={() => navigate('/pms/daily-reports/new')}>
                <CIcon icon={cilPlus} className="me-1" />
                Submit Report
              </CButton>
            )}
          </CCardBody>
        </CCard>
      ) : (
        <div>
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={handleCardClick}
              showPersonnel={false}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default MyReportsPage
