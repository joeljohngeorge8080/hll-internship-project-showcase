import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilPlus } from '@coreui/icons'

import api from '../../../../services/api'
import { localEmployees } from '../../../../services/localEmployees'
import { localAttendance } from '../../../../services/localAttendance'
import { DESIGNATIONS } from '../../../../constants/employeeConstants'
import {
  computeCTC,
  computeEffectiveCTC,
  OVERRIDABLE_CTC_FIELDS,
  STATE_PT_MAP,
  withHraOaDefaults,
} from '../ctcUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, decimals = 2) =>
  Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

// ─── Small breakdown table row, editable to override the formula result ─────
const BreakRow = ({
  label,
  field,
  value,
  overridden,
  onChange,
  onReset,
  sub,
  bold,
  colorClass,
  disabled,
}) => (
  <tr
    className={bold ? 'border-top' : undefined}
    style={sub ? { fontSize: '0.82rem', color: 'var(--cui-secondary-color)' } : {}}
  >
    <td
      className={bold ? 'fw-bold pt-1' : undefined}
      style={{ paddingLeft: sub ? '0.75rem' : undefined, fontSize: bold ? '1rem' : undefined }}
    >
      {label}
      {overridden && (
        <CBadge color="warning" className="ms-1 text-dark" style={{ fontSize: '0.6rem' }}>
          Manual
        </CBadge>
      )}
    </td>
    <td className={bold ? 'text-end pt-1' : 'text-end'}>
      <div className="d-flex align-items-center justify-content-end gap-1">
        <CFormInput
          size="sm"
          type="number"
          step="0.01"
          value={Number(value ?? 0).toFixed(2)}
          onChange={(e) => onChange(field, e.target.value)}
          disabled={disabled}
          className={`text-end fw-semibold ${colorClass || ''}`}
          style={{ maxWidth: 130 }}
        />
        {overridden && !disabled && (
          <CButton
            size="sm"
            color="link"
            className="p-0 text-decoration-none"
            title="Reset to auto-calculated value"
            onClick={() => onReset(field)}
          >
            ↺
          </CButton>
        )}
      </div>
    </td>
  </tr>
)

BreakRow.propTypes = {
  label: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  overridden: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  sub: PropTypes.bool,
  bold: PropTypes.bool,
  colorClass: PropTypes.string,
  disabled: PropTypes.bool,
}

// ─── Read-only mirror of a value already editable elsewhere in this modal
// (CIA, RSO, PT, Recovery — edited via the Manual Inputs fields above, not
// here) ─────────────────────────────────────────────────────────────────────
const ReadOnlyBreakRow = ({ label, value, sub, colorClass }) => (
  <tr style={sub ? { fontSize: '0.82rem', color: 'var(--cui-secondary-color)' } : {}}>
    <td style={{ paddingLeft: sub ? '0.75rem' : undefined }}>{label}</td>
    <td className={`text-end fw-semibold ${colorClass || ''}`}>₹{fmt(value)}</td>
  </tr>
)

ReadOnlyBreakRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  sub: PropTypes.bool,
  colorClass: PropTypes.string,
}

// ─── Plain manual-entry row — no formula behind it, no "Manual"/reset
// affordance (those imply overriding a computed value; HRA/OA aren't
// computed at all, see withHraOaDefaults in ctcUtils.js) ────────────────────
const ManualBreakRow = ({ label, value, onChange, sub, disabled }) => (
  <tr style={sub ? { fontSize: '0.82rem', color: 'var(--cui-secondary-color)' } : {}}>
    <td style={{ paddingLeft: sub ? '0.75rem' : undefined }}>{label}</td>
    <td className="text-end">
      <CFormInput
        size="sm"
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="text-end fw-semibold"
        style={{ maxWidth: 130, marginLeft: 'auto' }}
      />
    </td>
  </tr>
)

ManualBreakRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  sub: PropTypes.bool,
  disabled: PropTypes.bool,
}

// ─── Main Component ───────────────────────────────────────────────────────────
const SalaryTab = ({ employeeId, currentSalary, currentDesignation, canEdit, onSave }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Increment modal state
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [incrementPct, setIncrementPct] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [incDesignation, setIncDesignation] = useState('')

  // ── CTC Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editFormError, setEditFormError] = useState('')

  const [idealBasic, setIdealBasic] = useState('')
  const [da, setDA] = useState('')
  const [stateForPT, setStateForPT] = useState('')
  const [tnd, setTnd] = useState('30')
  const [tndw, setTndw] = useState('')
  const [ptOverride, setPtOverride] = useState('')
  const [ptAuto, setPtAuto] = useState(true)
  const [recovery, setRecovery] = useState('0')
  const [centreInchargeAllowance, setCentreInchargeAllowance] = useState('0')
  const [rsoAllowance, setRsoAllowance] = useState('0')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [hcNo, setHcNo] = useState('')
  const [editRemarks, setEditRemarks] = useState('')
  const [editEffectiveDate, setEditEffectiveDate] = useState('')
  const [editDesignation, setEditDesignation] = useState('')
  // Sparse map of auto-calculated breakdown fields manually pinned to a
  // value — keyed the same way OVERRIDABLE_CTC_FIELDS/computeEffectiveCTC use.
  // idealHRA/idealOA/actualHRA/actualOA are always present here (see
  // withHraOaDefaults) — for those four, this map isn't an optional
  // override, it's the only source of truth (matches MonthlySalaryDetailsTab).
  const [overrides, setOverrides] = useState(() => withHraOaDefaults({}))

  // ── Attendance auto-fetch state
  const _now = new Date()
  const [payrollMonth, setPayrollMonth] = useState(_now.getMonth() + 1)
  const [payrollYear, setPayrollYear] = useState(_now.getFullYear())
  const [attLoading, setAttLoading] = useState(false)
  const [attSource, setAttSource] = useState(null) // 'api' | 'local' | 'none'

  const salary = Number(currentSalary)

  // Auto-increment preview
  const preview = incrementPct
    ? {
        pct: Number(incrementPct),
        amount: ((salary * Number(incrementPct)) / 100).toFixed(2),
        newSalary: (salary + (salary * Number(incrementPct)) / 100).toFixed(2),
      }
    : null

  // PT logic
  const derivedPT = stateForPT ? (STATE_PT_MAP[stateForPT] ?? 0) : 0
  const effectivePT = ptAuto ? derivedPT : Number(ptOverride) || 0

  // Live CTC calculation — any field in `overrides` wins over the formula,
  // and cascades into whatever totals depend on it.
  const calc = idealBasic
    ? computeEffectiveCTC(
        {
          idealBasic: Number(idealBasic),
          da: Number(da),
          tnd: Number(tnd),
          tndw: Number(tndw) || 0,
          pt: effectivePT,
          recovery: Number(recovery) || 0,
          centreInchargeAllowance: Number(centreInchargeAllowance) || 0,
          rsoAllowance: Number(rsoAllowance) || 0,
        },
        overrides,
      )
    : null

  const setOverride = (field, value) => {
    if (!OVERRIDABLE_CTC_FIELDS.includes(field)) return
    setOverrides((prev) => ({ ...prev, [field]: value }))
  }

  const resetOverride = (field) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  // Fetch salary history
  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/employees/${employeeId}/salary-history`)
      setHistory(data)
    } catch {
      const local = await localEmployees.getById(employeeId)
      setHistory(local?.salary_history || [])
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    Promise.resolve().then(() => fetchHistory())
  }, [fetchHistory])

  // ── Auto-fetch TND / TNDW from attendance ─────────────────────────────────
  const fetchAttendanceForMonth = useCallback(
    async (year, month) => {
      setAttLoading(true)
      setAttSource(null)
      const daysInMonth = new Date(year, month, 0).getDate()
      try {
        const { data } = await api.get(
          `/employees/${employeeId}/attendance-summary?year=${year}&month=${month}`,
        )
        // present_count already includes half-day records as full days (per buildSummary).
        // Correct TNDW: subtract 0.5 per half day (not add).
        const tndwVal = (Number(data.present_count) || 0) - (Number(data.half_day_count) || 0) * 0.5
        setTnd(String(daysInMonth))
        setTndw(String(tndwVal))
        setAttSource('api')
      } catch {
        // Resolve the employee code (e.g. "EMP2408") from the local store
        // because attendance summaries are indexed by employee_id CODE, not UUID
        const localEmp = await localEmployees.getById(employeeId)
        const empCode = localEmp?.employee_id || employeeId

        // Try summary by code first
        let summary = await localAttendance.getSummary(empCode, year, month)

        // If still not found, try by UUID as fallback
        if (!summary) {
          summary = await localAttendance.getSummary(employeeId, year, month)
        }

        // If still not found, try computing from raw daily records
        if (!summary) {
          const { items } = await localAttendance.listRecords({
            employeeId: empCode,
            year,
            month,
            pageSize: 200,
          })
          if (items.length > 0) {
            const presentCount = items.filter((r) => r.status === 'Present').length
            const halfDayCount = items.filter((r) => r.status === 'Half Day').length
            summary = { present_count: presentCount, half_day_count: halfDayCount }
          }
        }

        if (summary) {
          // present_count from buildSummary already includes half days as full days.
          // Correct TNDW: subtract 0.5 per half day.
          const tndwVal =
            (Number(summary.present_count) || 0) - (Number(summary.half_day_count) || 0) * 0.5
          setTnd(String(daysInMonth))
          setTndw(String(tndwVal))
          setAttSource('local')
        } else {
          setTnd(String(daysInMonth))
          setTndw('')
          setAttSource('none')
        }
      } finally {
        setAttLoading(false)
      }
    },
    [employeeId],
  )

  // Open Edit Modal — auto-loads current month attendance
  const openEditModal = () => {
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()

    // Prefer the ideal basic from the last history entry's CTC breakdown;
    // fall back to current_salary (which also stores idealBasic since the fix).
    const lastEntry = history.length ? history[history.length - 1] : null
    const prevIdealBasic =
      lastEntry?.ctc_breakdown?.ideal_basic != null ? lastEntry.ctc_breakdown.ideal_basic : salary
    const prevDA = lastEntry?.ctc_breakdown?.ideal_da != null ? lastEntry.ctc_breakdown.ideal_da : 0
    // HRA/OA are manual now — carry the last saved values forward instead of
    // silently zeroing them out (they'd otherwise recompute from the new
    // Basic the moment the modal opens).
    const prevHraOa = {
      idealHRA: lastEntry?.ctc_breakdown?.ideal_hra,
      idealOA: lastEntry?.ctc_breakdown?.ideal_oa,
      actualHRA: lastEntry?.ctc_breakdown?.actual_hra,
      actualOA: lastEntry?.ctc_breakdown?.actual_oa,
    }

    setIdealBasic(String(prevIdealBasic))
    setDA(String(prevDA))
    setStateForPT('')
    setTnd(String(new Date(y, m, 0).getDate()))
    setTndw('')
    setPtOverride('')
    setPtAuto(true)
    setRecovery('0')
    setCentreInchargeAllowance('0')
    setRsoAllowance('0')
    setInvoiceNo('')
    setHcNo('')
    setEditRemarks('')
    setEditEffectiveDate('')
    setEditDesignation('')
    setEditFormError('')
    setOverrides(withHraOaDefaults(prevHraOa))
    setPayrollMonth(m)
    setPayrollYear(y)
    setAttSource(null)
    setShowEditModal(true)
    // Auto-fetch attendance for current month
    fetchAttendanceForMonth(y, m)
  }

  // Submit CTC-based salary update
  const handleCTCSave = async (e) => {
    e.preventDefault()
    setEditFormError('')
    if (!idealBasic || Number(idealBasic) <= 0) {
      setEditFormError('Please enter a valid Ideal Basic salary')
      return
    }
    if (!editEffectiveDate) {
      setEditFormError('Effective date is required')
      return
    }
    if (!calc) return

    setEditSubmitting(true)
    const payload = {
      new_salary: calc.idealBasic,
      effective_date: editEffectiveDate,
      remarks: editRemarks || undefined,
      new_designation: editDesignation.trim() || undefined,
      ctc_breakdown: {
        ideal_basic: calc.idealBasic,
        ideal_da: calc.idealDA,
        ideal_hra: calc.idealHRA,
        ideal_oa: calc.idealOA,
        centre_incharge_allowance: calc.cia,
        rso_allowance: calc.rso,
        ideal_gross: calc.idealGross,
        tnd: calc.tnd,
        tndw: calc.tndw,
        actual_basic: calc.actualBasic,
        actual_da: calc.actualDA,
        actual_hra: calc.actualHRA,
        actual_oa: calc.actualOA,
        actual_gross: calc.actualGross,
        emp_epfo: calc.empEPFO,
        emp_esic: calc.empESIC,
        pt: calc.ptAmt,
        recovery: calc.recoveryAmt,
        emp_lwf: calc.empLWF,
        group_insurance: calc.groupInsurance,
        total_deduction: calc.totalDeduction,
        net_salary: calc.netSalary,
        employer_pf: calc.employerPF,
        pf_admin: calc.pfAdmin,
        edli: calc.edli,
        employer_esic: calc.employerESIC,
        employer_lwf: calc.employerLWF,
        total_employer_contribution: calc.totalEmployerContribution,
        ctc: calc.ctc,
        service_charges: calc.serviceCharges,
        invoice_amount: calc.invoiceAmount,
        igst: calc.igst,
        total_invoice_amount: calc.totalInvoiceAmount,
        invoice_no: invoiceNo || undefined,
        hc_no: hcNo || undefined,
      },
    }
    try {
      await api.post(`/employees/${employeeId}/salary-update`, payload)
    } catch {
      try {
        await localEmployees.updateSalaryDirect(employeeId, payload)
      } catch (localErr) {
        setEditFormError(localErr.message || 'Failed to update salary')
        setEditSubmitting(false)
        return
      }
    }
    await fetchHistory()
    setShowEditModal(false)
    onSave()
    setEditSubmitting(false)
  }

  // Submit increment
  const handleApplyIncrement = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!effectiveDate) {
      setFormError('Effective date is required')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/employees/${employeeId}/salary-increment`, {
        increment_percentage: Number(incrementPct),
        effective_date: effectiveDate,
        remarks: remarks || undefined,
        new_designation: incDesignation.trim() || undefined,
      })
    } catch {
      try {
        await localEmployees.applySalaryIncrement(employeeId, {
          increment_percentage: Number(incrementPct),
          effective_date: effectiveDate,
          remarks: remarks || undefined,
          new_designation: incDesignation.trim() || undefined,
        })
      } catch (localErr) {
        setFormError(localErr.message || 'Failed to apply increment')
        setSubmitting(false)
        return
      }
    }
    await fetchHistory()
    setShowModal(false)
    setRemarks('')
    setEffectiveDate('')
    setIncrementPct('')
    setIncDesignation('')
    onSave()
    setSubmitting(false)
  }

  // Derive the ideal CTC from current_salary (which stores idealBasic)
  const derivedCTC = salary > 0 ? computeCTC({ idealBasic: salary, tnd: 30, tndw: 30 }).ctc : null

  return (
    <>
      {/* ── Current Salary Card ─────────────────────────────────────────── */}
      <CCard className="mb-4 border-0 bg-body-secondary">
        <CCardBody>
          <CRow className="align-items-center">
            <CCol>
              <small className="text-body-secondary">Current Basic Salary (Ideal)</small>
              <div className="d-flex align-items-baseline gap-3 flex-wrap">
                <h3 className="mb-0 text-success fw-bold">
                  ₹{salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                {derivedCTC != null && (
                  <span
                    className="text-body-secondary"
                    style={{
                      borderLeft: '1px solid var(--cui-border-color)',
                      paddingLeft: '0.75rem',
                    }}
                  >
                    <small>Ideal CTC (full attendance): </small>
                    <span className="fw-semibold text-body">
                      ₹{Number(derivedCTC).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
              </div>
            </CCol>
            {canEdit && (
              <CCol xs="auto" className="d-flex gap-2">
                <CButton color="secondary" onClick={openEditModal}>
                  <CIcon icon={cilPencil} className="me-1" />
                  Edit Salary
                </CButton>
                <CButton color="primary" onClick={() => setShowModal(true)}>
                  <CIcon icon={cilPlus} className="me-1" />
                  Apply Increment
                </CButton>
              </CCol>
            )}
          </CRow>
        </CCardBody>
      </CCard>

      {/* ── Salary History ──────────────────────────────────────────────── */}
      <CCard>
        <CCardHeader>
          <strong>Salary Increment History</strong>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-body-secondary">No salary changes recorded.</p>
          ) : (
            <CTable hover responsive>
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Date</CTableHeaderCell>
                  <CTableHeaderCell>Previous Salary</CTableHeaderCell>
                  <CTableHeaderCell>Increment %</CTableHeaderCell>
                  <CTableHeaderCell>Increment Amount</CTableHeaderCell>
                  <CTableHeaderCell>New Basic Salary</CTableHeaderCell>
                  <CTableHeaderCell>CTC</CTableHeaderCell>
                  <CTableHeaderCell>Basic Salary</CTableHeaderCell>
                  <CTableHeaderCell>Effective Date</CTableHeaderCell>
                  <CTableHeaderCell>Designation</CTableHeaderCell>
                  <CTableHeaderCell>Remarks</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {history.map((h) => (
                  <CTableRow key={h.id}>
                    <CTableDataCell>
                      {new Date(h.created_at).toLocaleDateString('en-IN')}
                    </CTableDataCell>
                    <CTableDataCell>
                      ₹{Number(h.previous_salary).toLocaleString('en-IN')}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="info">{h.increment_percentage}%</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="text-success">
                      +₹{Number(h.increment_amount).toLocaleString('en-IN')}
                    </CTableDataCell>
                    <CTableDataCell className="fw-semibold">
                      ₹
                      {Number(h.new_salary).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </CTableDataCell>
                    <CTableDataCell className="fw-semibold text-success">
                      {h.ctc_breakdown?.ctc != null
                        ? `₹${Number(h.ctc_breakdown.ctc).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </CTableDataCell>
                    <CTableDataCell>
                      {(() => {
                        const basic = h.ctc_breakdown?.ideal_basic ?? h.ideal_basic ?? null
                        return basic != null
                          ? `₹${Number(basic).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'
                      })()}
                    </CTableDataCell>
                    <CTableDataCell>{h.effective_date}</CTableDataCell>
                    <CTableDataCell>
                      {h.designation_changed_to ? (
                        <CBadge color="primary" shape="rounded-pill">
                          {h.designation_changed_to}
                        </CBadge>
                      ) : (
                        '—'
                      )}
                    </CTableDataCell>
                    <CTableDataCell>{h.remarks || '—'}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* ══ CTC CALCULATOR — Edit Salary Modal ═════════════════════════════ */}
      <CModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        backdrop="static"
        size="xl"
      >
        <CModalHeader>
          <CModalTitle>Edit Salary — CTC Calculator</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleCTCSave}>
          <CModalBody>
            {editFormError && <CAlert color="danger">{editFormError}</CAlert>}

            {/* ── Manual Inputs ─────────────────────────────────────────── */}
            <h6
              className="text-body-secondary text-uppercase fw-bold mb-1"
              style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}
            >
              Manual Inputs
            </h6>
            <hr className="mt-1 mb-3" />

            <CRow className="g-3 mb-4">
              <CCol md={3}>
                <CFormLabel className="fw-semibold">
                  Ideal Basic (₹) <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="any"
                  value={idealBasic}
                  onChange={(e) => setIdealBasic(e.target.value)}
                  placeholder="e.g. 14937.64"
                  required
                />
                {calc && (
                  <small className="text-body-secondary">
                    HRA: ₹{fmt(calc.idealHRA)}&nbsp;|&nbsp;OA: ₹{fmt(calc.idealOA)}
                  </small>
                )}
              </CCol>

              <CCol md={3}>
                <CFormLabel className="fw-semibold">DA (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="any"
                  value={da}
                  onChange={(e) => setDA(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </CCol>

              <CCol md={3}>
                <CFormLabel className="fw-semibold">State (for PT)</CFormLabel>
                <CFormSelect
                  value={stateForPT}
                  onChange={(e) => {
                    setStateForPT(e.target.value)
                    setPtAuto(true)
                  }}
                >
                  <option value="">— Select State —</option>
                  {Object.keys(STATE_PT_MAP).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={3}>
                <CFormLabel className="fw-semibold">
                  PT (₹){' '}
                  {ptAuto && stateForPT && (
                    <CBadge color="info" className="ms-1" style={{ fontSize: '0.68rem' }}>
                      Auto
                    </CBadge>
                  )}
                </CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="1"
                  value={ptAuto && stateForPT ? String(derivedPT) : ptOverride}
                  onChange={(e) => {
                    setPtAuto(false)
                    setPtOverride(e.target.value)
                  }}
                  placeholder="Professional Tax"
                />
                <small className="text-body-secondary">
                  {ptAuto && stateForPT
                    ? `Auto from state: ₹${derivedPT}`
                    : 'Type to override manually'}
                </small>
              </CCol>

              <CCol md={3}>
                <CFormLabel className="fw-semibold">Recovery (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                  placeholder="e.g. 1024"
                />
              </CCol>

              {/* ── Attendance Month Picker + TND/TNDW ──────────────────── */}
              <CCol md={12}>
                <div className="rounded border p-3" style={{ background: 'var(--cui-body-bg)' }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                    <span className="fw-semibold" style={{ fontSize: '0.84rem' }}>
                      Attendance for Payroll Month:
                    </span>
                    {/* Month */}
                    <CFormSelect
                      size="sm"
                      style={{ width: 140 }}
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(Number(e.target.value))}
                    >
                      {[
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
                      ].map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </CFormSelect>
                    {/* Year */}
                    <CFormSelect
                      size="sm"
                      style={{ width: 100 }}
                      value={payrollYear}
                      onChange={(e) => setPayrollYear(Number(e.target.value))}
                    >
                      {[-2, -1, 0, 1].map((d) => {
                        const y = new Date().getFullYear() + d
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        )
                      })}
                    </CFormSelect>
                    {/* Load button */}
                    <CTooltip content="Fetch TND & TNDW from the attendance sheet for this month">
                      <CButton
                        size="sm"
                        color="info"
                        variant="outline"
                        disabled={attLoading}
                        onClick={() => fetchAttendanceForMonth(payrollYear, payrollMonth)}
                      >
                        {attLoading ? (
                          <>
                            <CSpinner size="sm" className="me-1" />
                            Loading…
                          </>
                        ) : (
                          '⟳ Load from Attendance'
                        )}
                      </CButton>
                    </CTooltip>
                    {/* Source badge */}
                    {attSource === 'api' && (
                      <CBadge color="success">✓ Fetched from attendance</CBadge>
                    )}
                    {attSource === 'local' && (
                      <CBadge color="warning" className="text-dark">
                        ⚠ From local cache
                      </CBadge>
                    )}
                    {attSource === 'none' && (
                      <CBadge color="danger">No attendance data found — enter manually</CBadge>
                    )}
                  </div>

                  <CRow className="g-3">
                    <CCol md={3}>
                      <CFormLabel className="fw-semibold">
                        TND — Total Days in Month
                        {attSource && attSource !== 'none' && (
                          <CBadge color="info" className="ms-1" style={{ fontSize: '0.65rem' }}>
                            Auto
                          </CBadge>
                        )}
                      </CFormLabel>
                      <CFormInput
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={tnd}
                        onChange={(e) => setTnd(e.target.value)}
                        placeholder="30"
                      />
                      <small className="text-body-secondary">Override if needed</small>
                    </CCol>

                    <CCol md={3}>
                      <CFormLabel className="fw-semibold">
                        TNDW — Days Present
                        {attSource && attSource !== 'none' && (
                          <CBadge color="info" className="ms-1" style={{ fontSize: '0.65rem' }}>
                            Auto
                          </CBadge>
                        )}
                      </CFormLabel>
                      <CFormInput
                        type="number"
                        min="0"
                        max="31"
                        step="0.5"
                        value={tndw}
                        onChange={(e) => setTndw(e.target.value)}
                        placeholder="e.g. 29"
                      />
                      <small className="text-body-secondary">
                        {attSource && attSource !== 'none'
                          ? 'Present + 0.5×Half-Day (override if needed)'
                          : 'Enter manually'}
                      </small>
                    </CCol>

                    {calc && tndw && (
                      <CCol md={3} className="d-flex align-items-end">
                        <div className="p-2 rounded bg-body-secondary w-100">
                          <div style={{ fontSize: '0.75rem' }} className="text-body-secondary">
                            Actual Basic (prorated)
                          </div>
                          <div className="fw-bold text-success" style={{ fontSize: '1rem' }}>
                            ₹{fmt(calc.actualBasic)}
                          </div>
                          <div style={{ fontSize: '0.72rem' }} className="text-body-secondary">
                            = ₹{fmt(calc.idealBasic)} × {tndw}/{tnd}
                          </div>
                        </div>
                      </CCol>
                    )}
                  </CRow>
                </div>
              </CCol>

              <CCol md={2}>
                <CFormLabel className="fw-semibold">Centre Incharge Allow. (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={centreInchargeAllowance}
                  onChange={(e) => setCentreInchargeAllowance(e.target.value)}
                  placeholder="0"
                />
              </CCol>

              <CCol md={2}>
                <CFormLabel className="fw-semibold">RSO Allowance (₹)</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={rsoAllowance}
                  onChange={(e) => setRsoAllowance(e.target.value)}
                  placeholder="0"
                />
              </CCol>

              <CCol md={2}>
                <CFormLabel className="fw-semibold">Invoice No.</CFormLabel>
                <CFormInput
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g. TNM/123/JUL2026"
                />
              </CCol>

              <CCol md={2}>
                <CFormLabel className="fw-semibold">HC No.</CFormLabel>
                <CFormInput
                  type="number"
                  min="0"
                  value={hcNo}
                  onChange={(e) => setHcNo(e.target.value)}
                  placeholder="e.g. 94194"
                />
              </CCol>
            </CRow>

            {/* ── Auto-calculated Breakdown ──────────────────────────────── */}
            {calc && (
              <>
                <h6
                  className="text-body-secondary text-uppercase fw-bold mb-1"
                  style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}
                >
                  Auto-calculated Breakdown
                </h6>
                <hr className="mt-1 mb-3" />

                {(() => {
                  // Shared props for every overridable auto-calculated row,
                  // so each BreakRow below only names its field.
                  const auto = (field) => ({
                    field,
                    value: calc[field],
                    overridden: overrides[field] !== undefined && overrides[field] !== '',
                    onChange: setOverride,
                    onReset: resetOverride,
                    disabled: !canEdit,
                  })
                  return (
                    <CRow className="g-3">
                      {/* Ideal Components */}
                      <CCol md={4}>
                        <div className="border rounded p-3">
                          <div
                            className="fw-semibold text-body-secondary mb-2"
                            style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}
                          >
                            Ideal Components
                          </div>
                          <table className="w-100" style={{ fontSize: '0.84rem' }}>
                            <tbody>
                              <ReadOnlyBreakRow label="Ideal Basic" value={calc.idealBasic} />
                              <ReadOnlyBreakRow label="+ DA" value={calc.idealDA} sub />
                              <ManualBreakRow
                                label="+ HRA"
                                value={overrides.idealHRA ?? '0'}
                                onChange={(v) => setOverride('idealHRA', v)}
                                disabled={!canEdit}
                                sub
                              />
                              <ManualBreakRow
                                label="+ OA"
                                value={overrides.idealOA ?? '0'}
                                onChange={(v) => setOverride('idealOA', v)}
                                disabled={!canEdit}
                                sub
                              />
                              {calc.cia > 0 && (
                                <ReadOnlyBreakRow
                                  label="+ Centre Incharge Allow."
                                  value={calc.cia}
                                  sub
                                />
                              )}
                              {calc.rso > 0 && (
                                <ReadOnlyBreakRow label="+ RSO Allowance" value={calc.rso} sub />
                              )}
                              <BreakRow label="Ideal Gross" {...auto('idealGross')} bold />
                            </tbody>
                          </table>
                        </div>
                      </CCol>

                      {/* Actual (prorated) */}
                      <CCol md={4}>
                        <div className="border rounded p-3">
                          <div
                            className="fw-semibold text-body-secondary mb-2"
                            style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}
                          >
                            Actual (Prorated — {tndw || 0}/{tnd} days)
                          </div>
                          <table className="w-100" style={{ fontSize: '0.84rem' }}>
                            <tbody>
                              <BreakRow label="Actual Basic" {...auto('actualBasic')} />
                              <BreakRow label="+ DA" {...auto('actualDA')} sub />
                              <ManualBreakRow
                                label="+ HRA"
                                value={overrides.actualHRA ?? '0'}
                                onChange={(v) => setOverride('actualHRA', v)}
                                disabled={!canEdit}
                                sub
                              />
                              <ManualBreakRow
                                label="+ OA"
                                value={overrides.actualOA ?? '0'}
                                onChange={(v) => setOverride('actualOA', v)}
                                disabled={!canEdit}
                                sub
                              />
                              {calc.cia > 0 && (
                                <ReadOnlyBreakRow
                                  label="+ Centre Incharge Allow."
                                  value={calc.cia}
                                  sub
                                />
                              )}
                              {calc.rso > 0 && (
                                <ReadOnlyBreakRow label="+ RSO Allowance" value={calc.rso} sub />
                              )}
                              <BreakRow label="Actual Gross" {...auto('actualGross')} bold />
                            </tbody>
                          </table>
                        </div>
                      </CCol>

                      {/* Employee Deductions */}
                      <CCol md={4}>
                        <div className="border rounded p-3">
                          <div
                            className="fw-semibold text-body-secondary mb-2"
                            style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}
                          >
                            Employee Deductions
                          </div>
                          <table className="w-100" style={{ fontSize: '0.84rem' }}>
                            <tbody>
                              <BreakRow
                                label="EPFO (12% of Actual Basic)"
                                {...auto('empEPFO')}
                                sub
                              />
                              <BreakRow
                                label={`ESIC (0.75%)${calc.idealGross >= 21000 ? ' — N/A' : ''}`}
                                {...auto('empESIC')}
                                sub
                              />
                              <ReadOnlyBreakRow
                                label="Professional Tax (PT)"
                                value={calc.ptAmt}
                                sub
                              />
                              <ReadOnlyBreakRow label="Recovery" value={calc.recoveryAmt} sub />
                              <BreakRow label="Employee LWF" {...auto('empLWF')} sub />
                              <BreakRow
                                label={`Group Insurance${calc.idealGross < 21000 ? ' — N/A' : ''}`}
                                {...auto('groupInsurance')}
                                sub
                              />
                              <BreakRow
                                label="Total Deduction"
                                {...auto('totalDeduction')}
                                colorClass="text-danger"
                                bold
                              />
                              <BreakRow
                                label="Net Salary"
                                {...auto('netSalary')}
                                colorClass="text-success"
                                bold
                              />
                            </tbody>
                          </table>
                        </div>
                      </CCol>

                      {/* Employer Contributions */}
                      <CCol md={4}>
                        <div className="border rounded p-3">
                          <div
                            className="fw-semibold text-body-secondary mb-2"
                            style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}
                          >
                            Employer Contributions
                          </div>
                          <table className="w-100" style={{ fontSize: '0.84rem' }}>
                            <tbody>
                              <BreakRow label="Employer PF (12%)" {...auto('employerPF')} sub />
                              <BreakRow label="PF Admin (0.50%)" {...auto('pfAdmin')} sub />
                              <BreakRow label="EDLI (0.50%)" {...auto('edli')} sub />
                              <BreakRow
                                label={`Employer ESIC (3.25%)${calc.idealGross >= 21000 ? ' — N/A' : ''}`}
                                {...auto('employerESIC')}
                                sub
                              />
                              <BreakRow label="Employer LWF" {...auto('employerLWF')} sub />
                              <BreakRow
                                label="Total Employer Contribution"
                                {...auto('totalEmployerContribution')}
                                bold
                              />
                            </tbody>
                          </table>
                        </div>
                      </CCol>

                      {/* CTC & Invoice Summary */}
                      <CCol md={8}>
                        <div className="border rounded p-3 h-100">
                          <div
                            className="fw-semibold text-body-secondary mb-2"
                            style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}
                          >
                            CTC &amp; Invoice Summary
                          </div>
                          <CRow className="g-0">
                            <CCol md={6} className="pe-3">
                              <table className="w-100" style={{ fontSize: '0.84rem' }}>
                                <tbody>
                                  <ReadOnlyBreakRow label="Actual Gross" value={calc.actualGross} />
                                  <ReadOnlyBreakRow
                                    label="+ Total Employer Contribution"
                                    value={calc.totalEmployerContribution}
                                  />
                                  <BreakRow
                                    label="CTC"
                                    {...auto('ctc')}
                                    colorClass="text-success"
                                    bold
                                  />
                                </tbody>
                              </table>
                            </CCol>
                            <CCol md={6} className="ps-3 border-start">
                              <table className="w-100" style={{ fontSize: '0.84rem' }}>
                                <tbody>
                                  <BreakRow
                                    label="Service Charges (1.50%)"
                                    {...auto('serviceCharges')}
                                  />
                                  <BreakRow label="Invoice Amount" {...auto('invoiceAmount')} />
                                  <BreakRow label="+ IGST (18%)" {...auto('igst')} />
                                  <BreakRow
                                    label="Total Invoice Amount"
                                    {...auto('totalInvoiceAmount')}
                                    colorClass="text-primary"
                                    bold
                                  />
                                </tbody>
                              </table>
                            </CCol>
                          </CRow>
                        </div>
                      </CCol>
                    </CRow>
                  )
                })()}
              </>
            )}

            {/* ── Admin Fields ───────────────────────────────────────────── */}
            <h6
              className="text-body-secondary text-uppercase fw-bold mb-1 mt-4"
              style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}
            >
              Admin Fields
            </h6>
            <hr className="mt-1 mb-3" />

            <CRow className="g-3">
              <CCol md={4}>
                <CFormLabel className="fw-semibold">
                  Effective Date <span className="text-danger">*</span>
                </CFormLabel>
                <CFormInput
                  type="date"
                  value={editEffectiveDate}
                  onChange={(e) => setEditEffectiveDate(e.target.value)}
                  required
                />
              </CCol>

              <CCol md={4}>
                <CFormLabel className="fw-semibold">New Designation</CFormLabel>
                <CFormSelect
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                >
                  <option value="">— Keep current ({currentDesignation || 'unchanged'}) —</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={12}>
                <CFormLabel className="fw-semibold">Remarks</CFormLabel>
                <CFormTextarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Optional remarks for this salary change"
                />
              </CCol>
            </CRow>
          </CModalBody>

          <CModalFooter>
            <CButton
              color="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={editSubmitting}
            >
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={editSubmitting || !calc}>
              {editSubmitting && <CSpinner size="sm" className="me-2" />}
              Save Salary (CTC: ₹{calc ? fmt(calc.ctc) : '—'})
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ══ Increment Modal ═════════════════════════════════════════════════ */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>Apply Salary Increment</CModalTitle>
        </CModalHeader>
        <CForm onSubmit={handleApplyIncrement}>
          <CModalBody>
            {formError && <CAlert color="danger">{formError}</CAlert>}

            <div className="mb-3">
              <CFormLabel>Current Salary (CTC)</CFormLabel>
              <p className="fw-bold text-success">
                ₹{salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="incPct">Increment Percentage *</CFormLabel>
              <CFormInput
                id="incPct"
                type="number"
                min="0.01"
                step="0.01"
                value={incrementPct}
                onChange={(e) => setIncrementPct(e.target.value)}
                placeholder="e.g. 7.5"
                required
              />
            </div>

            {preview && (
              <CCard className="mb-3 border-0 bg-body-secondary">
                <CCardBody className="py-2">
                  <CRow>
                    <CCol xs={6}>
                      <small className="text-body-secondary">Increment Amount</small>
                      <p className="mb-0 fw-semibold text-success">
                        +₹{Number(preview.amount).toLocaleString('en-IN')}
                      </p>
                    </CCol>
                    <CCol xs={6}>
                      <small className="text-body-secondary">New Salary (CTC)</small>
                      <p className="mb-0 fw-bold">
                        ₹{Number(preview.newSalary).toLocaleString('en-IN')}
                      </p>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            )}

            <div className="mb-3">
              <CFormLabel htmlFor="effDate">Effective Date *</CFormLabel>
              <CFormInput
                id="effDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="incDesignation">
                New Designation
                <span className="text-body-secondary ms-2" style={{ fontSize: '0.78rem' }}>
                  (leave blank to keep current: {currentDesignation || '—'})
                </span>
              </CFormLabel>
              <CFormSelect
                id="incDesignation"
                value={incDesignation}
                onChange={(e) => setIncDesignation(e.target.value)}
              >
                <option value="">— Keep current ({currentDesignation || 'unchanged'}) —</option>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </CFormSelect>
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="remarks">Remarks</CFormLabel>
              <CFormTextarea
                id="remarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional remarks for this increment"
              />
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </CButton>
            <CButton color="primary" type="submit" disabled={submitting}>
              {submitting && <CSpinner size="sm" className="me-2" />}
              Apply Increment
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}

SalaryTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  currentSalary: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  currentDesignation: PropTypes.string,
  canEdit: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default SalaryTab
