/**
 * BackendReportsPage — Backend team approved reports view.
 *
 * Route: /pms/daily-reports/approved
 * Read-only table with dual file counts and CSV export.
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  CCard,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CFormInput,
  CRow,
  CCol,
  CInputGroup,
  CInputGroupText,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSearch,
  cilCloudDownload,
  cilSpreadsheet,
  cilPaperclip,
  cilImage,
  cilNotes,
  cilCheckCircle,
} from '@coreui/icons'

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

const formatDateTime = (isoStr) => {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

const BackendReportsPage = () => {
  const [reports, setReports] = useState([])
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadReports = useCallback(async () => {
    await localReports.seedDemoData()
    const result = await localReports.list({
      search,
      status: REPORT_STATUS.APPROVED,
      dateFrom,
      dateTo,
      pageSize: 200,
    })
    setReports(result.items)
  }, [search, dateFrom, dateTo])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const totalAmount = reports.reduce((sum, r) => sum + (r.amount || 0), 0)

  const handleExportCSV = () => {
    if (reports.length === 0) return

    const headers = [
      'Personnel',
      'Bill Topic',
      'Amount (INR)',
      'Report Date',
      'Time',
      'Approved At',
      'Linked Task',
      'Notes',
      'Geo Photos',
      'Bills',
    ]
    const rows = reports.map((r) => [
      r.submitted_by_name,
      r.bill_topic,
      r.amount,
      r.report_date,
      r.report_time,
      r.reviewed_at,
      r.task_title || '',
      r.notes || '',
      r.geo_photos?.length || 0,
      r.bill_uploads?.length || 0,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')

    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `approved_reports_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAttachment = (att) => {
    const link = document.createElement('a')
    link.href = att.file_url
    link.download = att.file_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1 fw-semibold">Approved Reports</h4>
          <p className="text-body-secondary mb-0 small">
            {reports.length} approved reports • Total: {formatCurrency(totalAmount)}
          </p>
        </div>
        <CButton
          color="success"
          variant="outline"
          onClick={handleExportCSV}
          disabled={reports.length === 0}
        >
          <CIcon icon={cilSpreadsheet} className="me-1" />
          Export CSV
        </CButton>
      </div>

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
                  placeholder="Search personnel or topic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </CInputGroup>
            </CCol>
            <CCol xs={6} md={3}>
              <CFormInput
                type="date"
                size="sm"
                placeholder="From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </CCol>
            <CCol xs={6} md={3}>
              <CFormInput
                type="date"
                size="sm"
                placeholder="To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* Table */}
      <CCard className="shadow-sm">
        <CCardBody className="p-0">
          {reports.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-3 text-body-secondary">
                <CIcon icon={cilCheckCircle} style={{ width: 48, height: 48 }} />
              </div>
              <h5 className="text-body-secondary">No approved reports yet</h5>
              <p className="text-body-tertiary">
                Approved reports from the Project Officer will appear here
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
                    <CTableHeaderCell>Approved</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Photos</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Bills</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {reports.map((report) => (
                    <CTableRow key={report.id}>
                      <CTableDataCell>
                        <div className="fw-medium">{report.submitted_by_name}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="text-truncate" style={{ maxWidth: '250px' }}>
                          {report.bill_topic}
                        </div>
                        {report.task_title && (
                          <div className="small text-info d-flex align-items-center gap-1">
                            <CIcon icon={cilNotes} size="sm" />
                            {report.task_title}
                          </div>
                        )}
                        {report.notes && (
                          <div
                            className="small text-body-tertiary text-truncate"
                            style={{ maxWidth: '250px' }}
                          >
                            {report.notes}
                          </div>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-semibold">
                        {formatCurrency(report.amount)}
                      </CTableDataCell>
                      <CTableDataCell className="small">
                        {formatDate(report.report_date)}
                        <br />
                        <span className="text-body-tertiary">{report.report_time}</span>
                      </CTableDataCell>
                      <CTableDataCell className="small">
                        {formatDateTime(report.reviewed_at)}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {report.geo_photos?.length > 0 ? (
                          <div className="d-inline-flex align-items-center gap-1">
                            <CIcon icon={cilImage} size="sm" />
                            <CBadge color="info" shape="rounded-pill" className="small">
                              {report.geo_photos.length}
                            </CBadge>
                          </div>
                        ) : (
                          <span className="text-body-tertiary">—</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        {report.bill_uploads?.length > 0 ? (
                          <div className="d-inline-flex align-items-center gap-1">
                            <CIcon icon={cilPaperclip} size="sm" />
                            <CBadge color="primary" shape="rounded-pill" className="small">
                              {report.bill_uploads.length}
                            </CBadge>
                            <CButton
                              color="primary"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                report.bill_uploads.forEach((a) => handleDownloadAttachment(a))
                              }
                              title="Download bills"
                            >
                              <CIcon icon={cilCloudDownload} size="sm" />
                            </CButton>
                          </div>
                        ) : (
                          <span className="text-body-tertiary">—</span>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default BackendReportsPage
