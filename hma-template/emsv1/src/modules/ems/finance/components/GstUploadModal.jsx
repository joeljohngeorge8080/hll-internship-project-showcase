import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import * as XLSX from 'xlsx'

import { parseGstSheet } from '../../../../services/gstSheetParser'
import { localGstBills } from '../../../../services/localGstBills'
import { classifyGstin } from '../../../../services/gstCalculations'

// Browser-side wrapper: File → raw rows array for parseGstSheet.
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

/**
 * A row is a true duplicate only when gstNo, invoiceNumber, gstRate AND
 * totalValue all match an existing entry.
 * - Same invoice + different GST rate → separate line item, import it.
 * - Same invoice + same rate + different total → amended/corrected bill, import it.
 */
const dupKey = (x) =>
  `${(x.gstNo || '').toUpperCase()}|${(x.invoiceNumber || '').toUpperCase()}|${String(x.gstRate ?? '').trim()}|${String(x.totalValue ?? '').trim()}`

const GstUploadModal = ({
  visible,
  onClose,
  onImported,
  uploadedBy = '',
  projectId = null,
  defaultDepartment = '',
  defaultVertical = '',
}) => {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [parsedEntries, setParsedEntries] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  const reset = () => {
    setParsedEntries(null)
    setError('')
    setFileName('')
    setSkipDuplicates(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    setParsedEntries(null)
    setError('')
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Only .xlsx and .xls files are accepted.')
      return
    }
    setBusy(true)
    setFileName(file.name)
    try {
      const rows = await readWorkbookRows(file)
      const result = parseGstSheet(rows)
      if (result.error === 'HEADER_NOT_FOUND') {
        setError(
          'Could not find the header row. The sheet must use the standard expenditure-statement columns ("SL NO" … "Is it GST Bill ?").',
        )
      } else if (result.entries.length === 0) {
        setError('No GST bills found in this file (no rows with "Is it GST Bill ?" = Yes).')
      } else {
        const existingKeys = new Set(
          localGstBills.entries
            .list()
            .filter((x) => x.gstNo && x.invoiceNumber)
            .map(dupKey),
        )
        setParsedEntries(
          result.entries.map((en) => ({
            ...en,
            // Sheets uploaded from a project's Financials tab or HR Admin
            // don't always fill in Department/Vertical — default them so
            // CSR eligibility and department filters still work correctly.
            department: en.department || defaultDepartment,
            vertical: en.vertical || defaultVertical,
            duplicate: Boolean(en.gstNo && en.invoiceNumber && existingKeys.has(dupKey(en))),
          })),
        )
      }
    } catch {
      setError('Could not read the file. Make sure it is a valid Excel file.')
    } finally {
      setBusy(false)
    }
  }

  const dupCount = parsedEntries ? parsedEntries.filter((x) => x.duplicate).length : 0
  const importCount = parsedEntries ? parsedEntries.length - (skipDuplicates ? dupCount : 0) : 0
  const invalidGstCount = parsedEntries
    ? parsedEntries.filter((x) => classifyGstin(x.gstNo) === 'invalid').length
    : 0

  // Rows whose GST No fails format/checksum validation. One invalid row
  // blocks the whole file — fix the Excel and re-upload.
  const invalidRows = parsedEntries
    ? parsedEntries
        .map((x, i) => ({ ...x, rowNo: i + 1 }))
        .filter((x) => classifyGstin(x.gstNo) === 'invalid')
    : []

  const handleImport = () => {
    if (invalidGstCount > 0) {
      setError('Cannot import while there are invalid GST numbers.')
      return
    }
    const toImport = parsedEntries
      .filter((x) => !(skipDuplicates && x.duplicate))
      .map(({ duplicate: _duplicate, ...rest }) => rest)
    if (toImport.length === 0) {
      setError('Nothing to import — every row is a duplicate of an existing entry.')
      return
    }
    const batch = localGstBills.batches.create({ fileName, uploadedBy, projectId })
    localGstBills.entries.createMany(batch.id, toImport, projectId)
    reset()
    onImported()
    onClose()
  }

  return (
    <CModal size="xl" scrollable visible={visible} onClose={close}>
      <CModalHeader>
        <CModalTitle>Upload GST bills Excel</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CFormInput
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          disabled={busy}
          className="mb-3"
        />
        {busy && <CSpinner size="sm" className="me-2" />}
        {error && <CAlert color="danger">{error}</CAlert>}

        {parsedEntries && (
          <>
            <p className="mb-2">
              Found <strong>{parsedEntries.length}</strong> GST bill(s) in <em>{fileName}</em>.
              {dupCount > 0 && (
                <>
                  {' '}
                  <span className="text-danger">{dupCount}</span> look like duplicates of existing
                  entries (same GST No + Invoice Number).
                </>
              )}
            </p>
            {invalidRows.length > 0 && (
              <CAlert color="danger">
                <strong>
                  {invalidRows.length} row(s) have an invalid GST No — this file cannot be imported.
                </strong>{' '}
                Fix these rows in the Excel and upload it again:
                <ul className="mb-0 mt-1">
                  {invalidRows.map((x) => (
                    <li key={x.rowNo}>
                      Row {x.rowNo} — {x.partyName || 'Unknown party'}
                      {x.invoiceNumber ? ` (Invoice ${x.invoiceNumber})` : ''}:{' '}
                      {x.gstNo ? `"${x.gstNo}" is not a valid GSTIN` : 'GST No is missing'}
                    </li>
                  ))}
                </ul>
              </CAlert>
            )}
            {dupCount > 0 && (
              <CFormCheck
                id="gst-skip-dups"
                label={`Skip the ${dupCount} duplicate row(s)`}
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mb-2"
              />
            )}
            <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
              <table className="table table-bordered table-sm align-middle mb-0">
                <thead>
                  <tr>
                    {[
                      '#',
                      'Department',
                      'Vertical',
                      'Party Name',
                      'GST No',
                      'Invoice Date',
                      'Invoice Number',
                      'Total Value',
                      'GST Rate %',
                      'CESS %',
                      'Duplicate?',
                    ].map((h) => (
                      <th key={h} className="table-light text-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedEntries.map((x, i) => (
                    <tr
                      key={`${dupKey(x)}-${i}`}
                      className={
                        classifyGstin(x.gstNo) === 'invalid'
                          ? 'table-danger'
                          : x.duplicate
                            ? 'table-warning'
                            : undefined
                      }
                    >
                      <td>{i + 1}</td>
                      <td>{x.department}</td>
                      <td>{x.vertical}</td>
                      <td>{x.partyName}</td>
                      <td className="text-nowrap">
                        {x.gstNo}
                        {classifyGstin(x.gstNo) === 'invalid' && (
                          <div className="text-danger small">Invalid GST No</div>
                        )}
                      </td>
                      <td className="text-nowrap">{x.invoiceDate}</td>
                      <td>{x.invoiceNumber}</td>
                      <td className={x.needsAttention ? 'table-danger text-end' : 'text-end'}>
                        {x.totalValue}
                      </td>
                      <td className="text-end">{x.gstRate}</td>
                      <td className="text-end">{x.cessRate}</td>
                      <td>{x.duplicate ? 'Yes' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={close}>
          Cancel
        </CButton>
        <CButton
          color="primary"
          onClick={handleImport}
          disabled={!parsedEntries || busy || invalidRows.length > 0}
        >
          Import {parsedEntries ? `${importCount} row(s)` : ''}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

GstUploadModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func.isRequired,
  uploadedBy: PropTypes.string,
  projectId: PropTypes.string,
  defaultDepartment: PropTypes.string,
  defaultVertical: PropTypes.string,
}

export default GstUploadModal
