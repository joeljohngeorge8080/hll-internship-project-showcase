import React, { useEffect, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilCloudUpload, cilFile } from '@coreui/icons'
import { useNavigate } from 'react-router-dom'

import { usePermission } from '../../../../hooks/usePermission'
import { MODULE } from '../../../../constants/modules'
import api from '../../../../services/api'
import { localGeneralExpenses } from '../../../../services/localGeneralExpenses'
import UploadHistoryTable from './UploadHistoryTable'

const thisYear = new Date().getFullYear()
const thisMonth = new Date().getMonth() + 1

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const YEARS = [thisYear - 1, thisYear, thisYear + 1]

const TEMPLATE_HEADERS = [
  'Category',
  'Expense Name',
  'Frequency',
  'Planned Amount',
  'Actual Amount',
  'Status',
  'Remarks',
]

const ExpenseUpload = () => {
  const navigate = useNavigate()
  const canEdit = usePermission(MODULE.GENERAL_EXPENSES, 'edit')
  const fileRef = useRef(null)

  const [month, setMonth] = useState(thisMonth)
  const [year, setYear] = useState(thisYear)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [uploads, setUploads] = useState([])

  const loadUploads = async () => {
    try {
      const { data } = await api.get('/general-expenses/uploads')
      setUploads(data)
    } catch {
      setUploads(await localGeneralExpenses.uploads.list())
    }
  }

  useEffect(() => {
    loadUploads()
  }, [])

  if (!canEdit) {
    return (
      <CAlert color="warning">
        You do not have permission to upload expense files. Contact HR.
      </CAlert>
    )
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f && !f.name.match(/\.(xlsx|xls)$/i)) {
      setError('Only .xlsx and .xls files are accepted')
      setFile(null)
      return
    }
    setError('')
    setFile(f || null)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Select an Excel file first')
      return
    }
    setUploading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('month', month)
    formData.append('year', year)

    try {
      const { data } = await api.post('/general-expenses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      loadUploads()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Check the file format and try again.')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    const csv = [
      TEMPLATE_HEADERS.join(','),
      'House Rent,Office Rent,Monthly,50000,50000,Paid,',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general_expenses_template_${year}_${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <CButton color="link" className="p-0" onClick={() => navigate('/ems/general-expenses')}>
          <CIcon icon={cilArrowLeft} className="me-1" /> Back
        </CButton>
        <strong className="fs-5">Upload Monthly Expenses</strong>
      </div>

      <CRow className="g-3">
        <CCol lg={7}>
          <CCard>
            <CCardHeader>
              <strong>Upload Excel File</strong>
            </CCardHeader>
            <CCardBody>
              {error && (
                <CAlert color="danger" dismissible onClose={() => setError('')}>
                  {error}
                </CAlert>
              )}
              {result && (
                <CAlert color="success">
                  <strong>{result.file_name}</strong> uploaded successfully. {result.row_count}{' '}
                  records created.{' '}
                  {result.error_log && (
                    <details className="mt-2">
                      <summary className="text-warning small">Some rows had errors</summary>
                      <pre className="small mt-1">{result.error_log}</pre>
                    </details>
                  )}
                </CAlert>
              )}

              <CRow className="g-3 mb-3">
                <CCol sm={6}>
                  <CFormLabel className="fw-semibold">Month</CFormLabel>
                  <CFormSelect value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol sm={6}>
                  <CFormLabel className="fw-semibold">Year</CFormLabel>
                  <CFormSelect value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              <div className="mb-3">
                <CFormLabel className="fw-semibold">Excel File (.xlsx / .xls)</CFormLabel>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="form-control"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="mt-2 d-flex align-items-center gap-2">
                    <CIcon icon={cilFile} />
                    <span className="small">{file.name}</span>
                    <CBadge color="info">{(file.size / 1024).toFixed(1)} KB</CBadge>
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <CButton color="primary" onClick={handleUpload} disabled={uploading || !file}>
                  {uploading ? (
                    <CSpinner size="sm" className="me-1" />
                  ) : (
                    <CIcon icon={cilCloudUpload} className="me-1" />
                  )}
                  Upload
                </CButton>
                <CButton color="secondary" variant="outline" onClick={downloadTemplate}>
                  Download Template
                </CButton>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={5}>
          <CCard>
            <CCardHeader>
              <strong>Required Columns</strong>
            </CCardHeader>
            <CCardBody>
              <p className="text-body-secondary small mb-2">
                Your Excel file must have these columns in the first row:
              </p>
              <ul className="small mb-3">
                {TEMPLATE_HEADERS.map((h) => (
                  <li key={h}>
                    <code>{h}</code>
                    {h === 'Planned Amount' || h === 'Expense Name' || h === 'Category' ? ' *' : ''}
                  </li>
                ))}
              </ul>
              <p className="text-body-secondary small mb-1">
                <strong>Frequency:</strong> Monthly / Quarterly / Annual / One-time
              </p>
              <p className="text-body-secondary small mb-0">
                <strong>Status:</strong> Pending / Paid / Overdue / Cancelled
              </p>
              <hr />
              <p className="text-body-secondary small mb-0">
                New categories in the sheet are created automatically. Month and year come from the
                form above, not the file.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard className="mt-3">
        <CCardHeader>
          <strong>Upload History</strong>
        </CCardHeader>
        <CCardBody>
          <UploadHistoryTable uploads={uploads} />
        </CCardBody>
      </CCard>
    </>
  )
}

export default ExpenseUpload
