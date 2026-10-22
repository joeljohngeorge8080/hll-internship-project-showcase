import React, { useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
import { cilCloudUpload, cilCloudDownload } from '@coreui/icons'
import * as XLSX from 'xlsx'
import * as XLSXStyle from 'xlsx-js-style'

import { parseGstr2bSheet } from '../../../services/gstr2bParser'
import { parseOwnGstReport } from '../../../services/gstOwnReportParser'
import { compareGstSheets } from '../../../services/gstComparison'

const money = (n) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Browser-side wrapper: File → raw rows array, matching the pattern used
// by GstUploadModal.
const readWorkbookRows = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('READ_FAILED'))
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }))
      } catch {
        reject(new Error('READ_FAILED'))
      }
    }
    reader.readAsArrayBuffer(file)
  })

const diffText = (n) => {
  if (!n) return ''
  const sign = n > 0 ? '+' : '−'
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const StatusBadge = ({ status, amountDiff, absentLabel }) => {
  if (status === 'matched') return <CBadge color="success">Matched</CBadge>
  if (status === 'partial') {
    return (
      <CBadge color="warning" className="text-dark">
        Amount differs ({diffText(amountDiff)})
      </CBadge>
    )
  }
  return <CBadge color="danger">{absentLabel}</CBadge>
}

const FilePicker = ({ label, hint, fileName, error, loading, onPick }) => {
  const inputRef = useRef(null)
  return (
    <CCard className="h-100">
      <CCardHeader className="fw-semibold">{label}</CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small mb-3">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="d-none"
          onChange={(e) => {
            const file = e.target.files[0]
            if (file) onPick(file)
            e.target.value = ''
          }}
        />
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <CSpinner size="sm" className="me-1" />
          ) : (
            <CIcon icon={cilCloudUpload} className="me-1" />
          )}
          {fileName ? 'Replace File' : 'Choose File'}
        </CButton>
        {fileName && !error && (
          <div className="small text-body-secondary mt-2">
            <em>{fileName}</em>
          </div>
        )}
        {error && (
          <CAlert color="danger" className="py-2 mt-2 mb-0 small">
            {error}
          </CAlert>
        )}
      </CCardBody>
    </CCard>
  )
}

const Gst2bComparisonPage = () => {
  const [gstr2b, setGstr2b] = useState({ fileName: '', entries: null, error: '', loading: false })
  const [ownReport, setOwnReport] = useState({
    fileName: '',
    entries: null,
    error: '',
    loading: false,
  })
  const [result, setResult] = useState(null)

  const handlePickGstr2b = async (file) => {
    setGstr2b({ fileName: file.name, entries: null, error: '', loading: true })
    setResult(null)
    try {
      const rows = await readWorkbookRows(file)
      const { error, entries } = parseGstr2bSheet(rows)
      if (error) {
        setGstr2b({
          fileName: file.name,
          entries: null,
          loading: false,
          error:
            error === 'HEADER_NOT_FOUND' || error === 'COLUMNS_NOT_FOUND'
              ? 'Could not find the GSTR-2B header row ("GSTIN of supplier"). Make sure this is the unedited GSTR-2B download.'
              : 'Could not read this file.',
        })
        return
      }
      setGstr2b({ fileName: file.name, entries, error: '', loading: false })
    } catch {
      setGstr2b({
        fileName: file.name,
        entries: null,
        loading: false,
        error: 'Could not read the file. Make sure it is a valid Excel file.',
      })
    }
  }

  const handlePickOwnReport = async (file) => {
    setOwnReport({ fileName: file.name, entries: null, error: '', loading: true })
    setResult(null)
    try {
      const rows = await readWorkbookRows(file)
      const { error, entries } = parseOwnGstReport(rows)
      if (error) {
        setOwnReport({
          fileName: file.name,
          entries: null,
          loading: false,
          error:
            'Could not find "GST No" / "Invoice Number" columns. Upload the file from GST Bills → Download Report.',
        })
        return
      }
      setOwnReport({ fileName: file.name, entries, error: '', loading: false })
    } catch {
      setOwnReport({
        fileName: file.name,
        entries: null,
        loading: false,
        error: 'Could not read the file. Make sure it is a valid Excel file.',
      })
    }
  }

  const canCompare = (gstr2b.entries?.length ?? 0) > 0 && (ownReport.entries?.length ?? 0) > 0

  const handleCompare = () => {
    setResult(compareGstSheets(gstr2b.entries, ownReport.entries))
  }

  const handleDownload = () => {
    if (!result) return
    const edge = { style: 'thin', color: { rgb: 'B0B7C3' } }
    const border = { top: edge, bottom: edge, left: edge, right: edge }
    const styles = {
      title: {
        font: { bold: true, sz: 13, color: { rgb: '7F6000' } },
        fill: { fgColor: { rgb: 'FFE699' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      head: {
        font: { bold: true, sz: 10 },
        fill: { fgColor: { rgb: 'FFD966' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border,
      },
      cell: { font: { sz: 10 }, border },
      matched: { font: { sz: 10, color: { rgb: '1E7A34' } }, border },
      partial: { font: { sz: 10, bold: true, color: { rgb: '7F6000' } }, border },
      unmatched: { font: { sz: 10, bold: true, color: { rgb: 'B00020' } }, border },
    }
    const txt = (v, s) => ({ v: v == null || v === '' ? '' : String(v), t: 's', s })
    const num = (v, s) => ({
      v: Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100,
      t: 'n',
      z: '#,##0.00',
      s,
    })
    const styleFor = (status) =>
      status === 'matched'
        ? styles.matched
        : status === 'partial'
          ? styles.partial
          : styles.unmatched
    const statusText = (status, absentLabel) =>
      status === 'matched' ? 'Matched' : status === 'partial' ? 'Amount differs' : absentLabel

    const wb = XLSXStyle.utils.book_new()

    const build2bSheet = () => {
      const headers = [
        'GSTIN',
        'Trade Name',
        'Invoice Number',
        'Invoice Date',
        'Invoice Value',
        'Taxable Value',
        'Difference',
        'Status',
      ]
      const aoa = [
        [
          txt('GSTR-2B vs OUR REPORT — COMPARISON', styles.title),
          ...Array(headers.length - 1).fill(txt('', styles.title)),
        ],
        [],
        headers.map((h) => txt(h, styles.head)),
        ...result.gstr2bRows.map((r) => {
          const s = styleFor(r.status)
          return [
            txt(r.gstin, s),
            txt(r.tradeName, s),
            txt(r.invoiceNumber, s),
            txt(r.invoiceDate, s),
            num(r.invoiceValue, s),
            num(r.taxableValue, s),
            r.status === 'partial' ? num(r.amountDiff, s) : txt('', s),
            txt(statusText(r.status, 'Not present in our report'), s),
          ]
        }),
      ]
      const ws = XLSXStyle.utils.aoa_to_sheet(aoa)
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }))
      XLSXStyle.utils.book_append_sheet(wb, ws, 'GSTR-2B')
    }

    const buildOwnSheet = () => {
      const headers = [
        'GST No',
        'Party Name',
        'Department',
        'Invoice Number',
        'Invoice Date',
        'Total Value',
        'Difference',
        'Status',
      ]
      const aoa = [
        [
          txt('OUR REPORT vs GSTR-2B — COMPARISON', styles.title),
          ...Array(headers.length - 1).fill(txt('', styles.title)),
        ],
        [],
        headers.map((h) => txt(h, styles.head)),
        ...result.ownRows.map((r) => {
          const s = styleFor(r.status)
          return [
            txt(r.gstNo, s),
            txt(r.partyName, s),
            txt(r.department, s),
            txt(r.invoiceNumber, s),
            txt(r.invoiceDate, s),
            num(r.totalValue, s),
            r.status === 'partial' ? num(r.amountDiff, s) : txt('', s),
            txt(statusText(r.status, 'Not present in GSTR-2B'), s),
          ]
        }),
      ]
      const ws = XLSXStyle.utils.aoa_to_sheet(aoa)
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }))
      XLSXStyle.utils.book_append_sheet(wb, ws, 'Our Report')
    }

    build2bSheet()
    buildOwnSheet()
    XLSXStyle.writeFile(wb, `gst-2b-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <>
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">GST 2B Comparison</h4>
          <p className="text-body-secondary mb-0 small">
            Upload the GSTR-2B download and the GST Bills report side by side to check which
            invoices match on GST number + invoice number, and flag any where the total value
            differs (partial match).
          </p>
        </div>
        {result && (
          <CButton color="success" size="sm" onClick={handleDownload}>
            <CIcon icon={cilCloudDownload} className="me-1" /> Download Comparison Report
          </CButton>
        )}
      </div>

      <CRow className="g-3 mb-3">
        <CCol md={6}>
          <FilePicker
            label="GSTR-2B (Government Download)"
            hint='The "Goods and Services Tax - GSTR-2B" Excel file downloaded from the GST portal.'
            fileName={gstr2b.fileName}
            error={gstr2b.error}
            loading={gstr2b.loading}
            onPick={handlePickGstr2b}
          />
        </CCol>
        <CCol md={6}>
          <FilePicker
            label="Our Report (GST Bills)"
            hint="The report exported from Finance → GST Bills → Download Report."
            fileName={ownReport.fileName}
            error={ownReport.error}
            loading={ownReport.loading}
            onPick={handlePickOwnReport}
          />
        </CCol>
      </CRow>

      <div className="mb-4">
        <CButton color="primary" disabled={!canCompare} onClick={handleCompare}>
          Compare
        </CButton>
      </div>

      {result && (
        <>
          <CAlert color="info" className="mb-3">
            GSTR-2B: <strong>{result.summary.gstr2bCount}</strong> invoice(s) · Our Report:{' '}
            <strong>{result.summary.ownCount}</strong> invoice(s) · Matched:{' '}
            <strong>{result.summary.matchedCount}</strong> · Amount differs:{' '}
            <strong>{result.summary.partialCount}</strong> · Only in GSTR-2B:{' '}
            <strong>{result.summary.onlyInGstr2bCount}</strong> · Only in our report:{' '}
            <strong>{result.summary.onlyInOwnCount}</strong>
          </CAlert>
          {result.summary.partialCount > 0 && (
            <CAlert color="warning" className="mb-3">
              <strong>{result.summary.partialCount}</strong> invoice(s) matched on GST number +
              invoice number but have a different total value between the two sheets — check the
              &ldquo;Amount differs&rdquo; rows below.
            </CAlert>
          )}

          <CRow className="g-3">
            <CCol md={6}>
              <CCard>
                <CCardHeader className="fw-semibold">
                  GSTR-2B ({result.gstr2bRows.length})
                </CCardHeader>
                <CCardBody className="p-0">
                  <CTable small hover responsive className="mb-0">
                    <CTableHead color="light">
                      <CTableRow>
                        <CTableHeaderCell>GSTIN</CTableHeaderCell>
                        <CTableHeaderCell>Invoice No</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Value</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Difference</CTableHeaderCell>
                        <CTableHeaderCell>Status</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {result.gstr2bRows.map((r, idx) => (
                        <CTableRow key={idx}>
                          <CTableDataCell className="small">{r.gstin}</CTableDataCell>
                          <CTableDataCell className="small">{r.invoiceNumber}</CTableDataCell>
                          <CTableDataCell className="text-end small">
                            {money(r.invoiceValue)}
                          </CTableDataCell>
                          <CTableDataCell className="text-end small text-warning-emphasis">
                            {diffText(r.amountDiff)}
                          </CTableDataCell>
                          <CTableDataCell>
                            <StatusBadge
                              status={r.status}
                              amountDiff={r.amountDiff}
                              absentLabel="Not in our report"
                            />
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={6}>
              <CCard>
                <CCardHeader className="fw-semibold">
                  Our Report ({result.ownRows.length})
                </CCardHeader>
                <CCardBody className="p-0">
                  <CTable small hover responsive className="mb-0">
                    <CTableHead color="light">
                      <CTableRow>
                        <CTableHeaderCell>GST No</CTableHeaderCell>
                        <CTableHeaderCell>Invoice No</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Value</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Difference</CTableHeaderCell>
                        <CTableHeaderCell>Status</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {result.ownRows.map((r, idx) => (
                        <CTableRow key={idx}>
                          <CTableDataCell className="small">{r.gstNo}</CTableDataCell>
                          <CTableDataCell className="small">{r.invoiceNumber}</CTableDataCell>
                          <CTableDataCell className="text-end small">
                            {money(r.totalValue)}
                          </CTableDataCell>
                          <CTableDataCell className="text-end small text-warning-emphasis">
                            {diffText(r.amountDiff)}
                          </CTableDataCell>
                          <CTableDataCell>
                            <StatusBadge
                              status={r.status}
                              amountDiff={r.amountDiff}
                              absentLabel="Not in GSTR-2B"
                            />
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </>
      )}
    </>
  )
}

export default Gst2bComparisonPage
