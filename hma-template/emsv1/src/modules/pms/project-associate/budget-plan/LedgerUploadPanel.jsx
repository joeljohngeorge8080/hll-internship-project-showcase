import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilWarning, cilX } from '@coreui/icons'
import { listSheets, parseSheet } from '../../../../services/projectLedgerParser'
import { localProjectLedger } from '../../../../services/localProjectLedger'
import { localBudgetPlan, LEDGER_TASK_NAME } from '../../../../services/localBudgetPlan'
import { normalizeActivityText } from './activityOptions'

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)

const PHASE_LABELS = {
  design: 'Design',
  implementation: 'Implementation',
  monitoring: 'Monitoring',
}
const phaseLabel = (p) => PHASE_LABELS[p] || p || '—'
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN')

const LedgerUploadPanel = ({ project, plan, canEdit, currentUser, onPlanChange }) => {
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [sheets, setSheets] = useState([])
  const [sheetName, setSheetName] = useState('')
  const [listingError, setListingError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseErrors, setParseErrors] = useState([])
  const [notice, setNotice] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [collapseError, setCollapseError] = useState('')
  const fileInputRef = useRef(null)

  const [existing, setExisting] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    localProjectLedger.get(project.id).then((ledger) => {
      if (!cancelled) setExisting(ledger)
    })
    return () => {
      cancelled = true
    }
  }, [project.id, reloadToken])

  if (!canEdit || plan.status !== 'submitted') return null

  const resetWizard = () => {
    setStep(0)
    setFile(null)
    setSheets([])
    setSheetName('')
    setListingError('')
    setParseErrors([])
  }

  const handleStart = () => {
    resetWizard()
    setUploading(true)
  }

  const handleFileSelected = async (e) => {
    const picked = e.dataTransfer?.files[0] || e.target.files[0]
    if (!picked) return
    if (!picked.name.match(/\.(xlsx|xls)$/i)) {
      setListingError('Only .xlsx or .xls files are accepted.')
      return
    }
    setFile(picked)
    setListingError('')
    try {
      const list = await listSheets(picked)
      setSheets(list)
      setStep(1)
    } catch (err) {
      setListingError(err.message)
    }
  }

  // Choosing a sheet parses, silently maps any activity the parser couldn't
  // resolve to "Other" (named after its own raw text so nothing is lost),
  // saves immediately, and lands the PO straight on the full data view — no
  // separate confirm/import step.
  const handlePickSheet = async (name) => {
    setSheetName(name)
    setParsing(true)
    setParseErrors([])
    try {
      const { rows, errors, warnings, ambiguousDates } = await parseSheet(file, name)
      if (errors.length > 0) {
        setParseErrors(errors)
        return
      }
      const overrides = { ...(existing?.activity_overrides || {}) }
      rows.forEach((row) => {
        if (row.activity) return
        const key = normalizeActivityText(row.activityRaw)
        if (!overrides[key]) overrides[key] = { value: 'other', other: row.activityRaw }
      })
      const finalRows = rows.map((row) => {
        if (row.activity) return { ...row, activityOther: '' }
        const eff = overrides[normalizeActivityText(row.activityRaw)]
        return { ...row, activity: eff.value, activityOther: eff.other }
      })
      await localProjectLedger.save(project.id, {
        sourceFile: file.name,
        sourceSheet: name,
        rows: finalRows,
        uploadedBy: currentUser,
        activityOverrides: overrides,
      })
      setReloadToken((t) => t + 1)
      setNotice({ rowCount: finalRows.length, warnings, ambiguousDates })
      setUploading(false)
    } catch (err) {
      setParseErrors([err.message])
    } finally {
      setParsing(false)
    }
  }

  const handleRemove = async () => {
    await localProjectLedger.remove(project.id)
    setReloadToken((t) => t + 1)
    setRemoveConfirm(false)
  }

  const handleCollapse = async (month, amount) => {
    setCollapseError('')
    try {
      onPlanChange(await localBudgetPlan.collapseLedgerTotal(project.id, month, amount))
    } catch (e) {
      setCollapseError(e.message)
    }
  }

  const ledgerMonths = localProjectLedger.monthsWithDataOf(existing)

  if (uploading) {
    return (
      <CCard className="mb-3">
        <CCardHeader className="fw-semibold d-flex justify-content-between align-items-center">
          <span>Project Ledger Upload</span>
          <CButton size="sm" color="secondary" variant="ghost" onClick={() => setUploading(false)}>
            <CIcon icon={cilX} />
          </CButton>
        </CCardHeader>
        <CCardBody>
          {step === 0 && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFileSelected(e)
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--cui-border-color)',
                  borderRadius: 8,
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--cui-tertiary-bg, #f8f9fa)',
                }}
              >
                <CIcon icon={cilCloudUpload} style={{ width: 32, height: 32, opacity: 0.4 }} />
                <div className="mt-2 fw-semibold">
                  {file
                    ? file.name
                    : 'Drop the project account Excel file here, or click to browse'}
                </div>
                <div className="text-body-secondary small mt-1">Accepts .xlsx and .xls</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              </div>
              {listingError && (
                <CAlert color="danger" className="mt-3 small">
                  {listingError}
                </CAlert>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="small text-body-secondary mb-2">
                This workbook has {sheets.length} sheets. Pick the one that belongs to{' '}
                <strong>{project.name || project.project_title || 'this project'}</strong>.
              </div>
              <CTable hover responsive small>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Sheet</CTableHeaderCell>
                    <CTableHeaderCell>Rows</CTableHeaderCell>
                    <CTableHeaderCell />
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {sheets.map((s) => (
                    <CTableRow key={s.name}>
                      <CTableDataCell>{s.name}</CTableDataCell>
                      <CTableDataCell>{s.dataRowCount}</CTableDataCell>
                      <CTableDataCell>
                        {s.hasActivityColumn ? (
                          <CButton
                            size="sm"
                            color="primary"
                            variant="outline"
                            disabled={parsing}
                            onClick={() => handlePickSheet(s.name)}
                          >
                            {parsing && sheetName === s.name && (
                              <CSpinner size="sm" className="me-1" />
                            )}
                            Choose
                          </CButton>
                        ) : (
                          <span className="text-body-tertiary small">
                            <CIcon icon={cilWarning} className="me-1" />
                            No Activity column
                          </span>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
              {parseErrors.length > 0 && (
                <CAlert color="danger" className="small">
                  {parseErrors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </CAlert>
              )}
              <CButton size="sm" color="secondary" variant="outline" onClick={() => setStep(0)}>
                ← Back
              </CButton>
            </>
          )}
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard className="mb-3">
      <CCardHeader className="fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          Project Ledger
          {existing && (
            <div className="small text-body-secondary fw-normal">
              Uploaded {new Date(existing.uploaded_at).toLocaleDateString('en-IN')} by{' '}
              {existing.uploaded_by} · sheet &quot;{existing.source_sheet}&quot;
            </div>
          )}
        </div>
        <div className="d-flex gap-2">
          <CButton size="sm" color="primary" variant="outline" onClick={handleStart}>
            <CIcon icon={cilCloudUpload} className="me-1" />
            {existing ? 'Re-upload' : 'Upload Ledger'}
          </CButton>
          {existing && (
            <CButton
              size="sm"
              color="danger"
              variant="ghost"
              onClick={() => setRemoveConfirm(true)}
            >
              Remove
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        {!existing && (
          <div className="small text-body-secondary">
            Upload the officer&apos;s Excel account sheet to see every transaction. Each
            month&apos;s total can then be collapsed into the actual phase from here.
          </div>
        )}

        {notice && (
          <CAlert color="success" dismissible onClose={() => setNotice(null)} className="small">
            Loaded {notice.rowCount} row(s) with an Activity value.
            {notice.warnings.length > 0 && (
              <>
                {' '}
                {notice.warnings.length} row(s) were excluded (missing date, non-numeric amount, or
                no Activity value):
                <ul className="mb-0 mt-1">
                  {notice.warnings.slice(0, 8).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {notice.warnings.length > 8 && <li>…and {notice.warnings.length - 8} more</li>}
                </ul>
              </>
            )}
          </CAlert>
        )}

        {notice?.ambiguousDates?.length > 0 && (
          <CAlert color="warning" dismissible className="small">
            <CIcon icon={cilWarning} className="me-1" />
            {notice.ambiguousDates.length} row(s) have a date from an Excel date cell where
            day/month could be swapped — Excel decides this itself based on the sheet author's
            locale, before this app ever sees the file, so please verify these against the source
            sheet (flagged with <CIcon icon={cilWarning} className="text-warning" size="sm" />{' '}
            below):
            <ul className="mb-0 mt-1">
              {notice.ambiguousDates.slice(0, 8).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {notice.ambiguousDates.length > 8 && (
                <li>…and {notice.ambiguousDates.length - 8} more</li>
              )}
            </ul>
          </CAlert>
        )}

        {existing &&
          ledgerMonths.map((month) => {
            const rows = localProjectLedger.rowsForMonthOf(existing, month, {
              includeCommitted: true,
            })
            const total = rows.filter((r) => !r.committed).reduce((s, r) => s + r.amount, 0)
            const monthEntry = plan.months.find((m) => m.month === month)
            const inPlan = !!monthEntry
            const editable = inPlan && !monthEntry.approved
            const collapsedTask = monthEntry?.tasks.find(
              (t) => t.added_in_actual && t.name === LEDGER_TASK_NAME,
            )
            const collapsedAmount = collapsedTask?.subtasks[0]?.actual_amount || 0
            const isStale = collapsedTask && Math.abs(collapsedAmount - total) > 0.005

            return (
              <div key={month} className="mb-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <span className="fw-semibold">
                    {month} {!inPlan && <span className="text-warning small">(outside plan)</span>}
                  </span>
                  {inPlan && (
                    <div className="d-flex align-items-center gap-2">
                      {collapsedTask && (
                        <span className={`small ${isStale ? 'text-warning' : 'text-success'}`}>
                          {isStale
                            ? `Actual shows ${fmt(collapsedAmount)} — out of date`
                            : `Reflected in actual: ${fmt(collapsedAmount)}`}
                        </span>
                      )}
                      {monthEntry.approved && (
                        <span className="badge text-bg-success" style={{ fontSize: '0.62rem' }}>
                          Approved — locked
                        </span>
                      )}
                      <CButton
                        size="sm"
                        color={isStale ? 'warning' : 'primary'}
                        variant="outline"
                        disabled={!editable}
                        title={
                          monthEntry.approved
                            ? 'Un-approve this month in the actual phase before collapsing'
                            : undefined
                        }
                        onClick={() => handleCollapse(month, total)}
                      >
                        {collapsedTask ? 'Re-collapse to actual' : 'Collapse to actual'}
                      </CButton>
                    </div>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <CTable small responsive className="mb-1">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell className="small">Date</CTableHeaderCell>
                        <CTableHeaderCell className="small">Particulars</CTableHeaderCell>
                        <CTableHeaderCell className="small text-end">Amount</CTableHeaderCell>
                        <CTableHeaderCell className="small">Budget Head</CTableHeaderCell>
                        <CTableHeaderCell className="small">Activity</CTableHeaderCell>
                        <CTableHeaderCell className="small">Phase</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {rows.map((r, i) => (
                        <CTableRow
                          key={i}
                          className={r.committed ? 'text-body-tertiary' : undefined}
                        >
                          <CTableDataCell className="small">
                            {fmtDate(r.date)}
                            {r.dateAmbiguous && (
                              <CIcon
                                icon={cilWarning}
                                className="ms-1 text-warning"
                                size="sm"
                                title="Excel's own date cell may have swapped day/month for this row — please verify against the source sheet."
                              />
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="small">
                            {r.particulars || '—'}
                            {r.committed && (
                              <span
                                className="badge text-bg-secondary ms-1"
                                style={{ fontSize: '0.6rem' }}
                              >
                                committed
                              </span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="small text-end">
                            {fmt(r.amount)}
                          </CTableDataCell>
                          <CTableDataCell className="small">{r.budgetHead || '—'}</CTableDataCell>
                          <CTableDataCell className="small">{r.activityLabel}</CTableDataCell>
                          <CTableDataCell className="small">{phaseLabel(r.phase)}</CTableDataCell>
                        </CTableRow>
                      ))}
                      <CTableRow className="fw-semibold">
                        <CTableDataCell colSpan={2} className="small text-end">
                          Month total{rows.some((r) => r.committed) ? ' (excludes committed)' : ''}
                        </CTableDataCell>
                        <CTableDataCell className="small text-end">{fmt(total)}</CTableDataCell>
                        <CTableDataCell colSpan={3} />
                      </CTableRow>
                    </CTableBody>
                  </CTable>
                </div>
              </div>
            )
          })}

        {collapseError && <div className="text-danger small mt-2">{collapseError}</div>}
      </CCardBody>

      <CModal
        visible={removeConfirm}
        onClose={() => setRemoveConfirm(false)}
        alignment="center"
        size="sm"
      >
        <CModalHeader>
          <CModalTitle>Remove uploaded ledger?</CModalTitle>
        </CModalHeader>
        <CModalBody className="small">
          This deletes the uploaded ledger for this project. Actual entries already collapsed into
          the plan are not affected. This cannot be undone.
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setRemoveConfirm(false)}
          >
            Cancel
          </CButton>
          <CButton color="danger" size="sm" onClick={handleRemove}>
            Remove
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  )
}

LedgerUploadPanel.propTypes = {
  project: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  currentUser: PropTypes.string,
  onPlanChange: PropTypes.func.isRequired,
}

export default LedgerUploadPanel
