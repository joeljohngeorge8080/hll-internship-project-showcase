import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import { localSalaryDetails } from '../../../../services/localSalaryDetails'
import { localAttendance } from '../../../../services/localAttendance'
import { computeAttendanceDeduction } from '../../../../services/attendanceCalc'
import {
  computeEffectiveCTC,
  OVERRIDABLE_CTC_FIELDS,
  STATE_PT_MAP,
  withHraOaDefaults,
} from '../ctcUtils'

const MONTHS = [
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
]

const _thisYear = new Date().getFullYear()
const _thisMonth = new Date().getMonth() + 1
const YEARS = Array.from({ length: 5 }, (_, i) => _thisYear - 2 + i)

// Manual-input fields that carry forward from the nearest earlier saved
// month when the selected month has no record of its own yet — everything
// editable except Recovery (always attendance/month-specific) and the
// inherently per-month admin fields (TND, TNDW, Invoice No., HC No.,
// Remarks). The override-side equivalent is OVERRIDABLE_CTC_FIELDS, which
// also excludes recovery (see ctcUtils.js).
const CASCADING_INPUT_FIELDS = [
  'idealBasic',
  'da',
  'stateForPT',
  'ptAuto',
  'ptOverride',
  'centreInchargeAllowance',
  'rsoAllowance',
]

// Finds the most recently saved record at or before (year, month), out of
// an employee's full record list — the "latest checkpoint wins" rule also
// used for project pool % adjustments (see localOrgPool.getEffectivePoolPcts).
const findNearestPriorRecord = (records, year, month) => {
  const target = year * 12 + month
  let best = null
  let bestKey = -Infinity
  for (const record of records) {
    const key = record.year * 12 + record.month
    if (key <= target && key > bestKey) {
      best = record
      bestKey = key
    }
  }
  return best
}

// Default inputs for a month with no saved record yet.
const emptyInputs = (daysInMonth, currentSalary) => ({
  idealBasic: currentSalary ? String(currentSalary) : '',
  da: '',
  stateForPT: '',
  ptAuto: true,
  ptOverride: '',
  recovery: '0',
  tnd: String(daysInMonth),
  tndw: '',
  centreInchargeAllowance: '0',
  rsoAllowance: '0',
  invoiceNo: '',
  hcNo: '',
  remarks: '',
})

const inputsFromRecord = (record, daysInMonth) => ({
  idealBasic: String(record.idealBasic ?? ''),
  da: String(record.da ?? ''),
  stateForPT: record.stateForPT || '',
  ptAuto: record.ptAuto !== false,
  ptOverride: record.ptOverride != null ? String(record.ptOverride) : '',
  recovery: String(record.recovery ?? '0'),
  tnd: String(record.tnd ?? daysInMonth),
  tndw: record.tndw != null ? String(record.tndw) : '',
  centreInchargeAllowance: String(record.centreInchargeAllowance ?? '0'),
  rsoAllowance: String(record.rsoAllowance ?? '0'),
  invoiceNo: record.invoiceNo || '',
  hcNo: record.hcNo || '',
  remarks: record.remarks || '',
})

// ─── One editable row: label + a single input/select cell ───────────────────
const InputRow = ({ label, children }) => (
  <CTableRow>
    <CTableDataCell className="text-body-secondary small" style={{ width: '55%' }}>
      {label}
    </CTableDataCell>
    <CTableDataCell>{children}</CTableDataCell>
  </CTableRow>
)
InputRow.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node }

// ─── One auto-calculated row, editable to override the formula result ───────
const CalcRow = ({ label, field, value, overridden, onChange, onReset, bold, sub, disabled }) => (
  <CTableRow>
    <CTableDataCell
      className={sub ? 'small text-body-secondary' : 'small'}
      style={{ width: '55%', paddingLeft: sub ? '1.5rem' : undefined }}
    >
      {label}
      {overridden && (
        <CBadge color="warning" className="ms-1 text-dark" style={{ fontSize: '0.6rem' }}>
          Manual
        </CBadge>
      )}
    </CTableDataCell>
    <CTableDataCell>
      <div className="d-flex align-items-center gap-1">
        <CFormInput
          size="sm"
          type="number"
          step="0.01"
          value={Number(value ?? 0).toFixed(2)}
          onChange={(e) => onChange(field, e.target.value)}
          disabled={disabled}
          className={bold ? 'fw-bold' : ''}
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
    </CTableDataCell>
  </CTableRow>
)
CalcRow.propTypes = {
  label: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  value: PropTypes.number,
  overridden: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  bold: PropTypes.bool,
  sub: PropTypes.bool,
  disabled: PropTypes.bool,
}

// ─── Read-only mirror of a value already editable elsewhere on this sheet
// (PT / Recovery — shown here for context in the deduction breakdown, but
// edited via the Manual Inputs rows above, not here) ─────────────────────────
const ReadOnlyRow = ({ label, value, sub }) => (
  <CTableRow>
    <CTableDataCell
      className={sub ? 'small text-body-secondary' : 'small'}
      style={{ width: '55%', paddingLeft: sub ? '1.5rem' : undefined }}
    >
      {label}
    </CTableDataCell>
    <CTableDataCell>
      ₹{' '}
      {Number(value ?? 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </CTableDataCell>
  </CTableRow>
)
ReadOnlyRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  sub: PropTypes.bool,
}

// ─── Section header row spanning both columns ────────────────────────────────
const SectionRow = ({ label }) => (
  <CTableRow color="light">
    <CTableDataCell colSpan={2} className="fw-semibold small text-uppercase py-1">
      {label}
    </CTableDataCell>
  </CTableRow>
)
SectionRow.propTypes = { label: PropTypes.string.isRequired }

const MonthlySalaryDetailsTab = ({ employeeId, currentSalary, canEdit }) => {
  const [viewYear, setViewYear] = useState(_thisYear)
  const [viewMonth, setViewMonth] = useState(_thisMonth)
  const [inputs, setInputs] = useState(() =>
    emptyInputs(new Date(_thisYear, _thisMonth, 0).getDate(), currentSalary),
  )
  const [hasRecord, setHasRecord] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveMsg, setSaveMsg] = useState('')
  // Sparse map of auto-calculated breakdown fields HR has manually pinned —
  // keyed the same way OVERRIDABLE_CTC_FIELDS/computeEffectiveCTC use.
  // idealHRA/idealOA/actualHRA/actualOA are always present here (see
  // withHraOaDefaults) — for those four, this map isn't an optional
  // override, it's the only source of truth.
  const [overrides, setOverrides] = useState(() => withHraOaDefaults({}))
  // Whole-sheet edit lock, defaults to locked so HR has to deliberately
  // unlock before any cell can change — protects against accidental edits.
  const [editUnlocked, setEditUnlocked] = useState(false)

  // Load (or default) the record for the selected month whenever the
  // employee or the selected month/year changes. Recovery auto-fills from
  // the attendance-computed deduction ONLY when it's still empty/zero —
  // never overwrites a value HR already typed in.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
      const record = await localSalaryDetails.get(employeeId, viewYear, viewMonth)
      let nextInputs
      let nextOverrides
      if (record) {
        nextInputs = inputsFromRecord(record, daysInMonth)
        nextOverrides = withHraOaDefaults(record.ctcOverrides || {})
      } else {
        // No record saved for this month yet — inherit the salary
        // structure (Ideal Basic, DA, PT, allowances, and the manual
        // HRA/OA/etc. overrides) from the nearest earlier saved month, so
        // an edit HR made once keeps applying until a later month is
        // itself explicitly saved. Recovery/TND/TNDW/Invoice/HC/Remarks
        // stay month-specific and are never inherited.
        nextInputs = emptyInputs(daysInMonth, currentSalary)
        nextOverrides = withHraOaDefaults({})
        const allRecords = await localSalaryDetails.listByEmployee(employeeId)
        const prior = findNearestPriorRecord(allRecords, viewYear, viewMonth)
        if (prior) {
          CASCADING_INPUT_FIELDS.forEach((field) => {
            nextInputs[field] =
              field === 'ptAuto' ? prior[field] !== false : String(prior[field] ?? '')
          })
          const priorOverrides = {}
          OVERRIDABLE_CTC_FIELDS.forEach((field) => {
            if (prior.ctcOverrides?.[field] !== undefined) {
              priorOverrides[field] = prior.ctcOverrides[field]
            }
          })
          nextOverrides = withHraOaDefaults(priorOverrides)
        }
      }

      if (!(Number(nextInputs.recovery) > 0)) {
        const summary = await localAttendance.getSummary(employeeId, viewYear, viewMonth)
        const salary = Number(currentSalary) || 0
        if (summary && salary > 0) {
          const workingDays =
            (summary.present_count || 0) +
            (summary.absent_count || 0) +
            (summary.weekly_off_count || 0)
          if (workingDays > 0) {
            const { totalDeduction } = computeAttendanceDeduction({
              salary,
              presentCount: summary.present_count || 0,
              absentCount: summary.absent_count || 0,
              weeklyOffCount: summary.weekly_off_count || 0,
              halfDayCount: summary.half_day_count || 0,
              lateDeductionHours: summary.late_deduction_hours || 0,
              earlyDeductionHours: summary.early_deduction_hours || 0,
            })
            if (totalDeduction > 0) {
              nextInputs.recovery = totalDeduction.toFixed(2)
            }
          }
        }
      }

      if (cancelled) return
      setInputs(nextInputs)
      setOverrides(nextOverrides)
      setHasRecord(!!record)
      setSaveMsg('')
      setEditUnlocked(false)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employeeId, viewYear, viewMonth, currentSalary])

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setInputs((prev) => ({ ...prev, [key]: val }))
  }

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

  const derivedPT = inputs.stateForPT ? (STATE_PT_MAP[inputs.stateForPT] ?? 0) : 0
  const effectivePT = inputs.ptAuto ? derivedPT : Number(inputs.ptOverride) || 0

  const calc = inputs.idealBasic
    ? computeEffectiveCTC(
        {
          idealBasic: Number(inputs.idealBasic),
          da: Number(inputs.da),
          tnd: Number(inputs.tnd),
          tndw: Number(inputs.tndw),
          pt: effectivePT,
          recovery: Number(inputs.recovery),
          centreInchargeAllowance: Number(inputs.centreInchargeAllowance),
          rsoAllowance: Number(inputs.rsoAllowance) || 0,
        },
        overrides,
      )
    : null

  // Pull TND (days in month) / TNDW (days present) from Attendance, same
  // half-day correction SalaryTab.jsx's live calculator already applies.
  const loadFromAttendance = async () => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    let summary = await localAttendance.getSummary(employeeId, viewYear, viewMonth)
    if (!summary) {
      const { items } = await localAttendance.listRecords({
        employeeId,
        year: viewYear,
        month: viewMonth,
        pageSize: 200,
      })
      if (items.length > 0) {
        summary = {
          present_count: items.filter((r) => r.status === 'Present').length,
          half_day_count: items.filter((r) => r.status === 'Half Day').length,
        }
      }
    }
    if (summary) {
      const tndwVal =
        (Number(summary.present_count) || 0) - (Number(summary.half_day_count) || 0) * 0.5
      setInputs((prev) => ({ ...prev, tnd: String(daysInMonth), tndw: String(tndwVal) }))
      setSaveMsg('Loaded TND/TNDW from Attendance. Review and Save to keep it.')
    } else {
      setInputs((prev) => ({ ...prev, tnd: String(daysInMonth) }))
      setSaveMsg('No attendance data found for this month.')
    }
  }

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await localSalaryDetails.upsert(employeeId, viewYear, viewMonth, {
        idealBasic: Number(inputs.idealBasic) || 0,
        da: Number(inputs.da) || 0,
        stateForPT: inputs.stateForPT,
        ptAuto: inputs.ptAuto,
        ptOverride: Number(inputs.ptOverride) || 0,
        recovery: Number(inputs.recovery) || 0,
        tnd: Number(inputs.tnd) || 0,
        tndw: Number(inputs.tndw) || 0,
        centreInchargeAllowance: Number(inputs.centreInchargeAllowance) || 0,
        rsoAllowance: Number(inputs.rsoAllowance) || 0,
        invoiceNo: inputs.invoiceNo,
        hcNo: inputs.hcNo,
        remarks: inputs.remarks,
        ctcOverrides: overrides,
      })
      setHasRecord(true)
      setSaveMsg(`Saved for ${MONTHS[viewMonth - 1]} ${viewYear}.`)
    } catch (err) {
      setSaveMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Sheet-wide: read-only unless both the caller granted edit access AND HR
  // has deliberately flipped the lock switch for this session.
  const fieldsDisabled = !canEdit || !editUnlocked

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <span className="fw-semibold text-body-secondary small">Salary details for:</span>
        <CFormSelect
          size="sm"
          value={viewMonth}
          onChange={(e) => setViewMonth(Number(e.target.value))}
          style={{ width: 140 }}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </CFormSelect>
        <CFormSelect
          size="sm"
          value={viewYear}
          onChange={(e) => setViewYear(Number(e.target.value))}
          style={{ width: 90 }}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </CFormSelect>
        {hasRecord ? (
          <CBadge color="success">Saved</CBadge>
        ) : (
          <CBadge color="secondary">Not yet saved</CBadge>
        )}
        {canEdit && (
          <CFormSwitch
            className="ms-auto"
            label={editUnlocked ? 'Editing unlocked' : 'Editing locked'}
            checked={editUnlocked}
            onChange={(e) => setEditUnlocked(e.target.checked)}
          />
        )}
      </div>

      <CAlert color="secondary" className="small mb-3 py-2">
        A separate, historical record per month — independent of the &ldquo;Salary&rdquo;
        tab&rsquo;s current CTC. Saving here does not change the employee&rsquo;s current salary.
        {canEdit && !editUnlocked && ' Turn on "Editing unlocked" above to make changes.'}
      </CAlert>

      {saveMsg && (
        <CAlert color="info" className="small py-2" dismissible onClose={() => setSaveMsg('')}>
          {saveMsg}
        </CAlert>
      )}

      {loading ? (
        <div className="text-center py-4">
          <CSpinner color="primary" size="sm" />
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="d-flex gap-2 mb-3">
              <CButton
                size="sm"
                color="secondary"
                variant="outline"
                onClick={loadFromAttendance}
                disabled={fieldsDisabled}
              >
                Load TND/TNDW from Attendance
              </CButton>
            </div>
          )}

          <CCard>
            <CCardHeader>
              <strong>
                Monthly Salary Sheet — {MONTHS[viewMonth - 1]} {viewYear}
              </strong>
            </CCardHeader>
            <CCardBody className="p-0">
              <CTable bordered small className="mb-0">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Field</CTableHeaderCell>
                    <CTableHeaderCell>Value</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <SectionRow label="Manual Inputs" />
                  <InputRow label="Ideal Basic (₹)">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.idealBasic}
                      onChange={setField('idealBasic')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="DA (₹)">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.da}
                      onChange={setField('da')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="State (for PT)">
                    <CFormSelect
                      size="sm"
                      value={inputs.stateForPT}
                      onChange={setField('stateForPT')}
                      disabled={fieldsDisabled}
                    >
                      <option value="">— Select —</option>
                      {Object.keys(STATE_PT_MAP).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </CFormSelect>
                  </InputRow>
                  <InputRow label="PT (₹)">
                    <div className="d-flex align-items-center gap-2">
                      <CFormCheck
                        label="Auto"
                        checked={inputs.ptAuto}
                        onChange={setField('ptAuto')}
                        disabled={fieldsDisabled}
                      />
                      <CFormInput
                        size="sm"
                        type="number"
                        value={inputs.ptAuto ? derivedPT : inputs.ptOverride}
                        onChange={setField('ptOverride')}
                        disabled={fieldsDisabled || inputs.ptAuto}
                        style={{ maxWidth: 140 }}
                      />
                    </div>
                  </InputRow>
                  <InputRow label="Recovery (₹)">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.recovery}
                      onChange={setField('recovery')}
                      disabled={fieldsDisabled}
                    />
                    <div className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                      Auto-filled from this month&rsquo;s attendance deduction when left at 0 — edit
                      freely, it won&rsquo;t be overwritten once you&rsquo;ve set a value.
                    </div>
                  </InputRow>
                  <InputRow label="TND — Total Days in Month">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.tnd}
                      onChange={setField('tnd')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="TNDW — Days Present">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.tndw}
                      onChange={setField('tndw')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="Centre Incharge Allowance (₹)">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.centreInchargeAllowance}
                      onChange={setField('centreInchargeAllowance')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="RSO Allowance (₹)">
                    <CFormInput
                      size="sm"
                      type="number"
                      value={inputs.rsoAllowance}
                      onChange={setField('rsoAllowance')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="Invoice No.">
                    <CFormInput
                      size="sm"
                      value={inputs.invoiceNo}
                      onChange={setField('invoiceNo')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="HC No.">
                    <CFormInput
                      size="sm"
                      value={inputs.hcNo}
                      onChange={setField('hcNo')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>
                  <InputRow label="Remarks">
                    <CFormInput
                      size="sm"
                      value={inputs.remarks}
                      onChange={setField('remarks')}
                      disabled={fieldsDisabled}
                    />
                  </InputRow>

                  {calc && (
                    <>
                      {(() => {
                        // Shared props for every overridable auto-calculated
                        // row, so each CalcRow below only names its field.
                        const auto = (field) => ({
                          field,
                          value: calc[field],
                          overridden: overrides[field] !== undefined && overrides[field] !== '',
                          onChange: setOverride,
                          onReset: resetOverride,
                          disabled: fieldsDisabled,
                        })
                        // HRA/OA below are plain manual number fields
                        // backed directly by `overrides` (see
                        // withHraOaDefaults) — no formula behind them at
                        // all, unlike the auto-calculated/override CalcRows
                        // elsewhere on this sheet.
                        return (
                          <>
                            <SectionRow label="Ideal Components" />
                            <InputRow label="Ideal HRA (₹)">
                              <CFormInput
                                size="sm"
                                type="number"
                                step="0.01"
                                value={overrides.idealHRA ?? '0'}
                                onChange={(e) => setOverride('idealHRA', e.target.value)}
                                disabled={fieldsDisabled}
                              />
                            </InputRow>
                            <InputRow label="Ideal OA (₹)">
                              <CFormInput
                                size="sm"
                                type="number"
                                step="0.01"
                                value={overrides.idealOA ?? '0'}
                                onChange={(e) => setOverride('idealOA', e.target.value)}
                                disabled={fieldsDisabled}
                              />
                            </InputRow>
                            <CalcRow label="Ideal Gross" {...auto('idealGross')} bold />

                            <SectionRow label="Actual Components (Prorated)" />
                            <CalcRow label="Actual Basic" {...auto('actualBasic')} />
                            <InputRow label="Actual HRA (₹)">
                              <CFormInput
                                size="sm"
                                type="number"
                                step="0.01"
                                value={overrides.actualHRA ?? '0'}
                                onChange={(e) => setOverride('actualHRA', e.target.value)}
                                disabled={fieldsDisabled}
                              />
                            </InputRow>
                            <InputRow label="Actual OA (₹)">
                              <CFormInput
                                size="sm"
                                type="number"
                                step="0.01"
                                value={overrides.actualOA ?? '0'}
                                onChange={(e) => setOverride('actualOA', e.target.value)}
                                disabled={fieldsDisabled}
                              />
                            </InputRow>
                            <CalcRow label="Actual Gross" {...auto('actualGross')} bold />

                            <SectionRow label="Employee Deductions" />
                            <CalcRow label="EPFO" {...auto('empEPFO')} sub />
                            <CalcRow label="ESIC" {...auto('empESIC')} sub />
                            <ReadOnlyRow label="PT" value={calc.ptAmt} sub />
                            <ReadOnlyRow label="Recovery" value={calc.recoveryAmt} sub />
                            <CalcRow label="LWF" {...auto('empLWF')} sub />
                            <CalcRow label="Group Insurance" {...auto('groupInsurance')} sub />
                            <CalcRow label="Total Deduction" {...auto('totalDeduction')} bold />
                            <CalcRow label="Net Salary" {...auto('netSalary')} bold />

                            <SectionRow label="Employer Contributions" />
                            <CalcRow label="Employer PF" {...auto('employerPF')} sub />
                            <CalcRow label="PF Admin" {...auto('pfAdmin')} sub />
                            <CalcRow label="EDLI" {...auto('edli')} sub />
                            <CalcRow label="Employer ESIC" {...auto('employerESIC')} sub />
                            <CalcRow label="Employer LWF" {...auto('employerLWF')} sub />
                            <CalcRow
                              label="Total Employer Contribution"
                              {...auto('totalEmployerContribution')}
                              bold
                            />

                            <SectionRow label="CTC & Invoice Summary" />
                            <CalcRow label="CTC" {...auto('ctc')} bold />
                            <CalcRow label="Service Charges" {...auto('serviceCharges')} sub />
                            <CalcRow label="Invoice Amount" {...auto('invoiceAmount')} sub />
                            <CalcRow label="IGST" {...auto('igst')} sub />
                            <CalcRow
                              label="Total Invoice Amount"
                              {...auto('totalInvoiceAmount')}
                              bold
                            />
                          </>
                        )
                      })()}
                    </>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>

          {canEdit && (
            <div className="d-flex gap-2 mt-3">
              <CButton color="success" onClick={handleSave} disabled={!inputs.idealBasic || saving}>
                {saving && <CSpinner size="sm" className="me-1" />}
                Save {MONTHS[viewMonth - 1]} {viewYear}
              </CButton>
            </div>
          )}
        </>
      )}
    </>
  )
}

MonthlySalaryDetailsTab.propTypes = {
  employeeId: PropTypes.string.isRequired,
  currentSalary: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  canEdit: PropTypes.bool,
}

export default MonthlySalaryDetailsTab
